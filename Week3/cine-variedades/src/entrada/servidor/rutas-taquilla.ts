import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { crearAvisos } from '../../avisos/avisos.js'
import type { Bd } from '../../base/bd.js'
import {
  butacasDe,
  detalleFuncion,
  enVenta,
  funcionesEnVenta,
  precio,
  type CategoriaPrecio,
} from '../../cartelera/cartelera.js'
import { tomadas, type Motivo } from '../../ocupacion/ocupacion.js'
import { cierreDeCaja } from '../../salidas/salidas.js'
import {
  anular,
  buscarCompra,
  buscarReserva,
  convertir,
  jornadaDe,
  liberarReserva,
  marcarDevolucionEntregada,
  venderEnTaquilla,
  type ButacaElegida,
} from '../../venta/venta.js'
import { exigirOperador } from './operadores-sesion.js'

function ahoraServidor(): string {
  return new Date().toISOString().slice(0, 19)
}

/** Los precios que aplican a una función según su categoría base (RN-13, RN-14). */
function preciosDe(bd: Bd, funcionId: number, categoriaBase: CategoriaPrecio): Record<string, number> {
  if (categoriaBase === 'miercoles') {
    return { miercoles: precio(bd, funcionId, 'miercoles') }
  }
  return { general: precio(bd, funcionId, 'general'), estudiante: precio(bd, funcionId, 'estudiante') }
}

/**
 * El mapa de taquilla muestra los cuatro estados de RN-17 (RN-57, CA-9): quien
 * atiende necesita saber si una butaca está reservada por un estudiante que
 * todavía puede presentarse. Es el recorte contrario al del mapa público, y
 * lo hace Entrada —no Ocupación, que siempre devuelve el motivo real
 * (DISENO.md).
 */
const ESTADO_POR_MOTIVO: Record<Motivo, 'bloqueada' | 'reservada' | 'vendida'> = {
  bloqueo: 'bloqueada',
  reserva: 'reservada',
  venta: 'vendida',
}

const CATEGORIAS: CategoriaPrecio[] = ['general', 'estudiante', 'miercoles']

function butacasElegidasDeCuerpo(body: unknown): ButacaElegida[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const { butacas } = body as Record<string, unknown>
  if (!Array.isArray(butacas) || butacas.length === 0) return undefined
  const elegidas: ButacaElegida[] = []
  for (const cruda of butacas) {
    if (typeof cruda !== 'object' || cruda === null) return undefined
    const { butacaId, categoria } = cruda as Record<string, unknown>
    if (typeof butacaId !== 'number') return undefined
    if (typeof categoria !== 'string' || !CATEGORIAS.includes(categoria as CategoriaPrecio)) return undefined
    elegidas.push({ butacaId, categoria: categoria as CategoriaPrecio })
  }
  return elegidas
}

/**
 * Las rutas de la pantalla de taquilla (T20): el mapa con el detalle real, la
 * venta presencial con categoría por butaca, la conversión de reservas, la
 * anulación con motivo, la devolución entregada en efectivo y el cierre de
 * caja de la jornada. Cada una exige un operador identificado y con permiso
 * (RF-32, RF-33); ninguna regla de negocio vive acá (DISENO.md): esta capa
 * compone, recorta y traduce.
 */
export function registrarRutasTaquilla(app: FastifyInstance, bd: Bd): void {
  app.get('/api/taquilla/funciones', { preHandler: exigirOperador('vender') }, async () => {
    const ahora = ahoraServidor()
    return funcionesEnVenta(bd, ahora).map((funcion) => ({
      ...funcion,
      precios: preciosDe(bd, funcion.funcionId, funcion.categoriaBase),
    }))
  })

  app.get<{ Params: { id: string } }>(
    '/api/taquilla/funciones/:id/mapa',
    { preHandler: exigirOperador('vender') },
    async (request, reply) => {
      const funcionId = Number(request.params.id)
      const detalle = detalleFuncion(bd, funcionId)
      if (detalle === undefined) {
        return reply.status(404).send({ mensaje: 'No existe esa función' })
      }
      const ahora = ahoraServidor()
      const tomada = new Map(tomadas(bd, funcionId, ahora).map((butaca) => [butaca.butacaId, butaca]))
      const mapa = butacasDe(bd, detalle.salaId).map((butaca) => {
        const ocupacion = tomada.get(butaca.id)
        return {
          butacaId: butaca.id,
          etiqueta: butaca.etiqueta,
          estado: ocupacion === undefined ? ('libre' as const) : ESTADO_POR_MOTIVO[ocupacion.motivo],
          // El número le sirve a quien atiende para encontrar la reserva o la
          // compra; la referencia de un bloqueo es la sesión anónima de quien
          // compra por internet (RN-55) y nunca sale de la capa de entrada.
          numero: ocupacion === undefined || ocupacion.motivo === 'bloqueo' ? null : ocupacion.referencia,
        }
      })
      return {
        funcion: detalle,
        precios: preciosDe(bd, funcionId, detalle.categoriaBase),
        enVenta: enVenta(bd, funcionId, ahora),
        mapa,
      }
    },
  )

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/taquilla/funciones/:id/venta',
    { preHandler: exigirOperador('vender') },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const butacas = butacasElegidasDeCuerpo(request.body)
      if (butacas === undefined) {
        return reply.status(400).send({ mensaje: 'Elegí al menos una butaca y su categoría de precio' })
      }
      return venderEnTaquilla(bd, Number(request.params.id), butacas, request.operador!.id, ahoraServidor())
    },
  )

  app.get<{ Params: { numero: string } }>(
    '/api/taquilla/reservas/:numero',
    { preHandler: exigirOperador('convertir-reserva') },
    async (request, reply) => {
      const reserva = buscarReserva(bd, request.params.numero, ahoraServidor())
      if (reserva === undefined) {
        return reply.status(404).send({ mensaje: `No encontramos ninguna reserva con el número ${request.params.numero}` })
      }
      return reserva
    },
  )

  app.post<{ Params: { numero: string }; Body: unknown }>(
    '/api/taquilla/reservas/:numero/conversion',
    { preHandler: exigirOperador('convertir-reserva') },
    async (request: FastifyRequest<{ Params: { numero: string }; Body: unknown }>, reply: FastifyReply) => {
      const cuerpo = (request.body ?? {}) as Record<string, unknown>
      if (typeof cuerpo.conCarne !== 'boolean') {
        return reply.status(400).send({ mensaje: 'Hace falta decir si presentó el carné de estudiante' })
      }
      return convertir(bd, request.params.numero, cuerpo.conCarne, request.operador!.id, ahoraServidor())
    },
  )

  app.delete<{ Params: { numero: string } }>(
    '/api/taquilla/reservas/:numero',
    { preHandler: exigirOperador('convertir-reserva') },
    async (request, reply) => {
      // Quien no presenta carné y no acepta pagar general: las butacas vuelven
      // a estar libres en el acto y no queda registro (RN-32, RN-33, RN-34).
      liberarReserva(bd, request.params.numero)
      return reply.status(204).send()
    },
  )

  app.get<{ Params: { numero: string } }>(
    '/api/taquilla/compras/:numero',
    { preHandler: exigirOperador('anular-compra') },
    async (request, reply) => {
      const compra = buscarCompra(bd, request.params.numero)
      if (compra === undefined) {
        return reply.status(404).send({ mensaje: `No encontramos ninguna compra con el número ${request.params.numero}` })
      }
      return compra
    },
  )

  app.post<{ Params: { numero: string }; Body: unknown }>(
    '/api/taquilla/compras/:numero/anulacion',
    { preHandler: exigirOperador('anular-compra') },
    async (request: FastifyRequest<{ Params: { numero: string }; Body: unknown }>, reply: FastifyReply) => {
      const motivo = ((request.body ?? {}) as Record<string, unknown>).motivo
      if (typeof motivo !== 'string' || motivo.trim() === '') {
        // RN-40 pide registrar por qué se anuló; sin motivo no hay nada que registrar.
        return reply.status(400).send({ mensaje: 'Hace falta el motivo de la anulación' })
      }
      anular(bd, request.params.numero, request.operador!.id, motivo.trim(), ahoraServidor())
      return buscarCompra(bd, request.params.numero)
    },
  )

  app.post<{ Params: { numero: string } }>(
    '/api/taquilla/compras/:numero/devolucion-entregada',
    { preHandler: exigirOperador('entregar-devolucion') },
    async (request) => {
      marcarDevolucionEntregada(bd, request.params.numero, request.operador!.id, ahoraServidor())
      return buscarCompra(bd, request.params.numero)
    },
  )

  app.get<{ Querystring: { jornada?: string } }>(
    '/api/taquilla/cierre-caja',
    { preHandler: exigirOperador('cierre-caja') },
    async (request) => {
      // La jornada en curso la decide Venta con el corte de las 06:00 (RN-10,
      // RN-11): esta capa no vuelve a hacer esa cuenta.
      const jornada = request.query.jornada ?? jornadaDe(ahoraServidor())
      return cierreDeCaja(bd, jornada)
    },
  )
}
