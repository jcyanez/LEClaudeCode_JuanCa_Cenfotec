import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { crearAvisos } from '../../avisos/avisos.js'
import type { Bd } from '../../base/bd.js'
import { butacasDe, detalleFuncion, enVenta, funcionesEnVenta, precio, type CategoriaPrecio } from '../../cartelera/cartelera.js'
import { tomadas } from '../../ocupacion/ocupacion.js'
import { bloquear, bloqueoVigente, pagar, reservar, type Contacto } from '../../venta/venta.js'
import { sesionAnonimaDe } from './compradores-sesion.js'

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

function contactoDeCuerpo(body: unknown): Contacto | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const { nombre, correo, telefono } = body as Record<string, unknown>
  if (typeof nombre !== 'string' || typeof correo !== 'string' || typeof telefono !== 'string') return undefined
  return { nombre, correo, telefono }
}

function butacaIdsDeCuerpo(body: unknown): number[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const { butacaIds } = body as Record<string, unknown>
  if (!Array.isArray(butacaIds) || butacaIds.length === 0) return undefined
  if (!butacaIds.every((id) => typeof id === 'number')) return undefined
  return butacaIds
}

/**
 * Las rutas de la web pública (T19): cartelera y mapa de butacas, sin
 * exigir identificarse (RN-55, RF-32); el flujo de bloqueo → pago →
 * número; y la reserva de estudiante. Ninguna regla de negocio vive acá
 * (DISENO.md): todo lo decide Venta o Cartelera, esta capa solo compone y
 * traduce.
 */
export function registrarRutasPublicas(app: FastifyInstance, bd: Bd): void {
  app.get('/api/cartelera', async () => {
    const ahora = ahoraServidor()
    return funcionesEnVenta(bd, ahora).map((funcion) => ({
      ...funcion,
      precios: preciosDe(bd, funcion.funcionId, funcion.categoriaBase),
    }))
  })

  app.get<{ Params: { id: string } }>('/api/funciones/:id/mapa', async (request, reply) => {
    const funcionId = Number(request.params.id)
    const detalle = detalleFuncion(bd, funcionId)
    if (detalle === undefined) {
      return reply.status(404).send({ mensaje: 'No existe esa función' })
    }
    const ahora = ahoraServidor()
    // El mapa público solo distingue libre / no disponible (RN-56, CA-9):
    // Entrada es quien compone Cartelera (butacasDe) con Ocupación (tomadas)
    // y recorta el detalle, nunca los componentes de dominio.
    const ocupadas = new Set(tomadas(bd, funcionId, ahora).map((butaca) => butaca.butacaId))
    const mapa = butacasDe(bd, detalle.salaId).map((butaca) => ({
      butacaId: butaca.id,
      etiqueta: butaca.etiqueta,
      estado: ocupadas.has(butaca.id) ? ('no-disponible' as const) : ('libre' as const),
    }))
    return {
      funcion: detalle,
      precios: preciosDe(bd, funcionId, detalle.categoriaBase),
      enVenta: enVenta(bd, funcionId, ahora),
      mapa,
    }
  })

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/funciones/:id/bloqueo',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const funcionId = Number(request.params.id)
      const butacaIds = butacaIdsDeCuerpo(request.body)
      if (butacaIds === undefined) {
        return reply.status(400).send({ mensaje: 'Elegí al menos una butaca' })
      }
      const sesion = sesionAnonimaDe(request, reply)
      const ahora = ahoraServidor()
      return bloquear(bd, funcionId, butacaIds, sesion, ahora)
    },
  )

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/funciones/:id/pago',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const funcionId = Number(request.params.id)
      const sesion = sesionAnonimaDe(request, reply)
      const ahora = ahoraServidor()
      const bloqueo = bloqueoVigente(bd, funcionId, sesion, ahora)
      if (bloqueo === undefined) {
        return reply.status(410).send({ mensaje: 'Se venció el tiempo. Las butacas volvieron a estar libres' })
      }
      const contacto = contactoDeCuerpo(request.body)
      if (contacto === undefined) {
        return reply.status(400).send({ mensaje: 'La compra por internet necesita nombre, correo y teléfono' })
      }
      const avisos = crearAvisos(bd, ahora)
      return pagar(bd, avisos, bloqueo, contacto, ahora)
    },
  )

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/funciones/:id/reserva',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const funcionId = Number(request.params.id)
      const butacaIds = butacaIdsDeCuerpo(request.body)
      if (butacaIds === undefined) {
        return reply.status(400).send({ mensaje: 'Elegí al menos una butaca' })
      }
      const contacto = contactoDeCuerpo(request.body)
      if (contacto === undefined) {
        return reply.status(400).send({ mensaje: 'La reserva necesita nombre, correo y teléfono' })
      }
      const ahora = ahoraServidor()
      const avisos = crearAvisos(bd, ahora)
      return reservar(bd, avisos, funcionId, butacaIds, contacto, ahora)
    },
  )
}
