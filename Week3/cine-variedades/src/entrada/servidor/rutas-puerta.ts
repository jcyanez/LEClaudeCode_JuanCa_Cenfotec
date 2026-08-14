import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Bd } from '../../base/bd.js'
import { funcionesEnRango } from '../../cartelera/cartelera.js'
import { buscarCompraPorContacto, jornadaDe, rangoDeJornada, validar } from '../../venta/venta.js'
import { exigirOperador } from './operadores-sesion.js'

function ahoraServidor(): string {
  return new Date().toISOString().slice(0, 19)
}

/**
 * Las rutas de la puerta (T21): validar una compra por su número (RF-19) y
 * buscarla por nombre o correo cuando el número está mal dictado (RF-18).
 * Los rechazos —número inexistente, de otra función, entradas ya usadas,
 * función cancelada, compra anulada— son clases propias de Venta y los
 * traduce el manejador de errores de T18 (RF-20, tabla de errores).
 */
export function registrarRutasPuerta(app: FastifyInstance, bd: Bd): void {
  app.get<{ Querystring: { jornada?: string } }>(
    '/api/puerta/funciones',
    { preHandler: exigirOperador('validar') },
    async (request) => {
      // Qué funciones caen en una jornada lo decide Venta, que es donde vive
      // el corte de las 06:00 (RN-10, CA-8): la función de las 23:00 del
      // viernes sigue siendo del viernes cuando se valida a las 00:15.
      const jornada = request.query.jornada ?? jornadaDe(ahoraServidor())
      const { desde, hasta } = rangoDeJornada(jornada)
      return funcionesEnRango(bd, desde, hasta)
    },
  )

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/puerta/funciones/:id/validacion',
    { preHandler: exigirOperador('validar') },
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const numero = ((request.body ?? {}) as Record<string, unknown>).numero
      if (typeof numero !== 'string' || numero.trim() === '') {
        return reply.status(400).send({ mensaje: 'Hace falta el número de compra' })
      }
      return validar(
        bd,
        Number(request.params.id),
        numero.trim().toUpperCase(),
        request.operador!.id,
        ahoraServidor(),
      )
    },
  )

  app.get<{ Querystring: { contacto?: string } }>(
    '/api/puerta/compras',
    { preHandler: exigirOperador('validar') },
    async (request, reply) => {
      const contacto = request.query.contacto?.trim()
      if (contacto === undefined || contacto === '') {
        return reply.status(400).send({ mensaje: 'Escribí un nombre o un correo para buscar' })
      }
      return buscarCompraPorContacto(bd, contacto)
    },
  )
}
