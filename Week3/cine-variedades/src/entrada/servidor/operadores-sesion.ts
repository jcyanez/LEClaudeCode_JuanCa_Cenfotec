import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Bd } from '../../base/bd.js'
import { identificar, puede, type Operacion, type OperadorIdentificado } from '../../operadores/operadores.js'

declare module 'fastify' {
  interface FastifyRequest {
    operador?: OperadorIdentificado
  }
}

const COOKIE_OPERADOR = 'operador_sesion'

/**
 * Abre y cierra la sesión de un operador (decisión de DISENO.md: PIN corto,
 * sesión que se cierra al terminar la jornada). El operador completo viaja
 * firmado en la cookie —sin guardar nada en el servidor—, así que no hace
 * falta una tabla de sesiones ni volver a consultar Operadores en cada
 * pedido.
 */
export function registrarSesionOperador(app: FastifyInstance, bd: Bd): void {
  app.post<{ Body: { pin?: string } }>('/api/operadores/sesion', async (request, reply) => {
    const pin = request.body?.pin
    if (typeof pin !== 'string' || pin.trim() === '') {
      return reply.status(400).send({ mensaje: 'Hace falta un PIN' })
    }
    const operador = identificar(bd, pin)
    if (operador === undefined) {
      return reply.status(401).send({ mensaje: 'PIN incorrecto' })
    }
    reply.setCookie(COOKIE_OPERADOR, JSON.stringify(operador), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      signed: true,
    })
    return operador
  })

  // Quién está operando ahora (RF-32): la pantalla lo necesita para mostrarlo
  // y para no volver a pedir el PIN en cada recarga. No abre ninguna sesión:
  // solo lee la que ya venga firmada en la cookie.
  app.get('/api/operadores/sesion', async (request, reply) => {
    const operador = operadorDeLaSesion(request)
    if (operador === undefined) {
      return reply.status(401).send({ mensaje: 'Hace falta identificarse con un PIN' })
    }
    return operador
  })

  app.delete('/api/operadores/sesion', async (_request, reply) => {
    reply.clearCookie(COOKIE_OPERADOR, { path: '/' })
    return reply.status(204).send()
  })
}

/** El operador de la sesión actual, si la cookie es válida y no fue alterada. */
export function operadorDeLaSesion(request: FastifyRequest): OperadorIdentificado | undefined {
  const cruda = request.cookies[COOKIE_OPERADOR]
  if (cruda === undefined) return undefined
  const { valid, value } = request.unsignCookie(cruda)
  if (!valid || value === null) return undefined
  try {
    return JSON.parse(value) as OperadorIdentificado
  } catch {
    return undefined
  }
}

/**
 * Exige un operador identificado y con permiso antes de una operación
 * interna (RF-32); la web pública nunca usa esto (RN-55). No decide ningún
 * permiso por su cuenta: delega en `puede` de Operadores (DISENO.md).
 */
export function exigirOperador(operacion: Operacion) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const operador = operadorDeLaSesion(request)
    if (operador === undefined) {
      await reply.status(401).send({ mensaje: 'Hace falta identificarse con un PIN' })
      return
    }
    if (!puede(operador, operacion)) {
      await reply.status(403).send({ mensaje: 'Este puesto no puede hacer esa operación' })
      return
    }
    request.operador = operador
  }
}
