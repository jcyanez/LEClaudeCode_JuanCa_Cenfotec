import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { EnviarCorreo } from '../../avisos/avisos.js'
import { crearAvisos } from '../../avisos/avisos.js'
import type { Bd } from '../../base/bd.js'
import {
  abrirVenta,
  crearSemana,
  eliminarFuncion,
  fijarPrecios,
  funcionesDeSemana,
  modificarFuncion,
  peliculas,
  preciosVigentes,
  programarFuncion,
  registrarPelicula,
  semanas,
  type DatosFuncion,
} from '../../cartelera/cartelera.js'
import {
  correoDelDistribuidor,
  entradasPorCategoriaYCanal,
  enviarReporte,
  enviosDeReporte,
  fijarCorreoDelDistribuidor,
  ocupacionDeFunciones,
  reporteMensual,
} from '../../salidas/salidas.js'
import { cancelarFuncion } from '../../venta/venta.js'
import { exigirOperador } from './operadores-sesion.js'

function ahoraServidor(): string {
  return new Date().toISOString().slice(0, 19)
}

function textoDe(body: unknown, clave: string): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const valor = (body as Record<string, unknown>)[clave]
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined
}

/** Los campos de una función que pueden venir en el cuerpo, sin inventar ninguno. */
function cambiosDeFuncion(body: unknown): Partial<DatosFuncion> {
  const cuerpo = (body ?? {}) as Record<string, unknown>
  const cambios: Partial<DatosFuncion> = {}
  if (typeof cuerpo.peliculaId === 'number') cambios.peliculaId = cuerpo.peliculaId
  if (typeof cuerpo.salaId === 'number') cambios.salaId = cuerpo.salaId
  if (typeof cuerpo.semanaId === 'number') cambios.semanaId = cuerpo.semanaId
  if (typeof cuerpo.fecha === 'string') cambios.fecha = cuerpo.fecha
  if (typeof cuerpo.horaInicio === 'string') cambios.horaInicio = cuerpo.horaInicio
  return cambios
}

/**
 * Las rutas de las pantallas de la dueña (T21): cargar la cartelera —películas,
 * semanas, funciones— (RF-1 a RF-5), fijar precios (RF-6), cancelar funciones
 * (RF-23), mantener el correo del distribuidor (RF-29), ver el reporte del mes
 * y reenviarlo a mano (RF-27, RF-28) y las dos consultas (RF-30, RF-31).
 *
 * Cada una exige el permiso que le corresponde por puesto (RF-32, RF-33): la
 * cancelación es la única que taquilla también puede hacer (RN-52). Ninguna
 * regla de negocio vive acá: el margen de 20 minutos, el plazo de cancelación
 * y los precios los arbitran Cartelera y Venta.
 */
export function registrarRutasAdministracion(app: FastifyInstance, bd: Bd, enviarCorreo: EnviarCorreo): void {
  app.get('/api/administracion/peliculas', { preHandler: exigirOperador('cargar-cartelera') }, async () =>
    peliculas(bd),
  )

  app.post<{ Body: unknown }>(
    '/api/administracion/peliculas',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const titulo = textoDe(request.body, 'titulo')
      const duracionMinutos = ((request.body ?? {}) as Record<string, unknown>).duracionMinutos
      if (titulo === undefined || typeof duracionMinutos !== 'number') {
        return reply.status(400).send({ mensaje: 'La película necesita título y duración en minutos' })
      }
      return { id: registrarPelicula(bd, titulo, duracionMinutos) }
    },
  )

  app.get('/api/administracion/semanas', { preHandler: exigirOperador('cargar-cartelera') }, async () =>
    semanas(bd),
  )

  app.post<{ Body: unknown }>(
    '/api/administracion/semanas',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const juevesInicio = textoDe(request.body, 'juevesInicio')
      if (juevesInicio === undefined) {
        return reply.status(400).send({ mensaje: 'Hace falta el jueves en que empieza la semana' })
      }
      return { semanaId: crearSemana(bd, juevesInicio, ahoraServidor().slice(0, 10)) }
    },
  )

  app.post<{ Params: { id: string } }>(
    '/api/administracion/semanas/:id/apertura',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request) => {
      abrirVenta(bd, Number(request.params.id))
      return { semanaId: Number(request.params.id), abiertaAVenta: true }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/api/administracion/semanas/:id/funciones',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request) => funcionesDeSemana(bd, Number(request.params.id)),
  )

  app.post<{ Body: unknown }>(
    '/api/administracion/funciones',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const datos = cambiosDeFuncion(request.body)
      const completos =
        datos.peliculaId !== undefined &&
        datos.salaId !== undefined &&
        datos.semanaId !== undefined &&
        datos.fecha !== undefined &&
        datos.horaInicio !== undefined
      if (!completos) {
        return reply.status(400).send({ mensaje: 'Una función necesita película, sala, semana, fecha y hora' })
      }
      return { funcionId: programarFuncion(bd, datos as DatosFuncion) }
    },
  )

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/administracion/funciones/:id',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => {
      modificarFuncion(bd, Number(request.params.id), cambiosDeFuncion(request.body), ahoraServidor())
      return { funcionId: Number(request.params.id) }
    },
  )

  app.delete<{ Params: { id: string } }>(
    '/api/administracion/funciones/:id',
    { preHandler: exigirOperador('cargar-cartelera') },
    async (request, reply) => {
      eliminarFuncion(bd, Number(request.params.id), ahoraServidor())
      return reply.status(204).send()
    },
  )

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/administracion/funciones/:id/cancelacion',
    { preHandler: exigirOperador('cancelar-funcion') },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const motivo = textoDe(request.body, 'motivo')
      if (motivo === undefined) {
        // RN-41 y REG-4 piden registrar por qué se canceló.
        return reply.status(400).send({ mensaje: 'Hace falta el motivo de la cancelación' })
      }
      const ahora = ahoraServidor()
      return cancelarFuncion(bd, crearAvisos(bd, ahora), Number(request.params.id), request.operador!.id, motivo, ahora)
    },
  )

  app.get<{ Querystring: { fecha?: string } }>(
    '/api/administracion/precios',
    { preHandler: exigirOperador('fijar-precios') },
    async (request, reply) => {
      const vigentes = preciosVigentes(bd, request.query.fecha ?? ahoraServidor().slice(0, 10))
      if (vigentes === undefined) {
        return reply.status(404).send({ mensaje: 'Todavía no hay precios fijados' })
      }
      return vigentes
    },
  )

  app.post<{ Body: unknown }>(
    '/api/administracion/precios',
    { preHandler: exigirOperador('fijar-precios') },
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const cuerpo = (request.body ?? {}) as Record<string, unknown>
      const desde = textoDe(request.body, 'desde')
      if (typeof cuerpo.general !== 'number' || typeof cuerpo.estudiante !== 'number' || desde === undefined) {
        return reply.status(400).send({ mensaje: 'Hacen falta el precio general, el de estudiante y desde cuándo rigen' })
      }
      fijarPrecios(bd, cuerpo.general, cuerpo.estudiante, desde)
      return preciosVigentes(bd, desde)
    },
  )

  app.get(
    '/api/administracion/distribuidor',
    { preHandler: exigirOperador('mantener-correo-distribuidor') },
    async () => ({ correo: correoDelDistribuidor(bd) ?? null }),
  )

  app.put<{ Body: unknown }>(
    '/api/administracion/distribuidor',
    { preHandler: exigirOperador('mantener-correo-distribuidor') },
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const correo = textoDe(request.body, 'correo')
      if (correo === undefined) {
        return reply.status(400).send({ mensaje: 'El correo del distribuidor no puede quedar vacío' })
      }
      fijarCorreoDelDistribuidor(bd, correo)
      return { correo }
    },
  )

  app.get<{ Params: { mes: string } }>(
    '/api/administracion/reporte/:mes',
    { preHandler: exigirOperador('consultar-reporte') },
    async (request) => ({
      mes: request.params.mes,
      detalle: reporteMensual(bd, request.params.mes),
      // Los intentos previos quedan a la vista para que un fallo se note y se
      // pueda reenviar a mano (RF-28, RN-48, REG-7).
      envios: enviosDeReporte(bd, request.params.mes),
      destinatario: correoDelDistribuidor(bd) ?? null,
    }),
  )

  app.post<{ Params: { mes: string } }>(
    '/api/administracion/reporte/:mes/envio',
    { preHandler: exigirOperador('consultar-reporte') },
    async (request, reply) => {
      const destinatario = correoDelDistribuidor(bd)
      if (destinatario === undefined) {
        return reply.status(400).send({ mensaje: 'Primero hace falta el correo del distribuidor (RF-29)' })
      }
      return enviarReporte(bd, enviarCorreo, request.params.mes, destinatario, ahoraServidor())
    },
  )

  app.get<{ Querystring: { desde?: string; hasta?: string } }>(
    '/api/administracion/ocupacion',
    { preHandler: exigirOperador('consultar-reporte') },
    async (request, reply) => {
      const { desde, hasta } = request.query
      if (desde === undefined || hasta === undefined) {
        return reply.status(400).send({ mensaje: 'Elegí desde qué fecha y hasta cuál' })
      }
      return ocupacionDeFunciones(bd, desde, hasta)
    },
  )

  app.get<{ Querystring: { desde?: string; hasta?: string } }>(
    '/api/administracion/categorias',
    { preHandler: exigirOperador('consultar-reporte') },
    async (request, reply) => {
      const { desde, hasta } = request.query
      if (desde === undefined || hasta === undefined) {
        return reply.status(400).send({ mensaje: 'Elegí desde qué fecha y hasta cuál' })
      }
      return entradasPorCategoriaYCanal(bd, desde, hasta)
    },
  )
}
