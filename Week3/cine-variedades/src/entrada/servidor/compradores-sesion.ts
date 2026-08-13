import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

const COOKIE_SESION_ANONIMA = 'sesion_anonima'

/**
 * La sesión anónima de quien compra por internet (decisión de DISENO.md:
 * identificador anónimo en el navegador, sin cuenta — RN-55). Se crea sola
 * en la primera visita y es a quien pertenece un bloqueo (RF-10).
 */
export function sesionAnonimaDe(request: FastifyRequest, reply: FastifyReply): string {
  const existente = request.cookies[COOKIE_SESION_ANONIMA]
  if (existente !== undefined) return existente
  const nueva = randomUUID()
  reply.setCookie(COOKIE_SESION_ANONIMA, nueva, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
  })
  return nueva
}
