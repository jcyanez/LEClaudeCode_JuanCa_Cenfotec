import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import {
  ButacasYaTomadas,
  CompraAnulada,
  CompraInexistente,
  EntradaYaUsada,
  FuncionCancelada,
  NumeroDeOtraFuncion,
} from '../../venta/venta.js'

function tieneCodigoPropio(error: Error): error is FastifyError {
  return typeof (error as Partial<FastifyError>).statusCode === 'number'
}

/**
 * Traduce los rechazos de los componentes de dominio a la tabla de errores
 * de DISENO.md (RF-32 pide identificarse antes de operar; el resto de las
 * reglas ya decidieron qué pasó, acá solo se les da forma de respuesta).
 * Ninguna regla de negocio se agrega ni se repite acá.
 *
 * Límite conocido: los rechazos que no tienen clase propia (la mayoría de
 * los componentes de dominio) son `Error` simples con su mensaje ya en
 * español (DISENO.md: "ningún mensaje dice error inesperado"). No hay forma
 * de distinguir uno de estos de un error de programación real sin envolver
 * cada `throw new Error(...)` ya escrito en T1–T17, así que ambos caen acá
 * como 400. Se documenta como límite en STATUS.md.
 */
export function manejarErrorDeDominio(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error)

  if (error instanceof ButacasYaTomadas) {
    reply.status(409).send({ error: 'ButacasYaTomadas', mensaje: error.message, butacaIds: error.butacaIds })
    return
  }
  if (error instanceof CompraInexistente) {
    reply.status(404).send({ error: 'CompraInexistente', mensaje: error.message, numero: error.numero })
    return
  }
  if (error instanceof NumeroDeOtraFuncion) {
    reply.status(409).send({ error: 'NumeroDeOtraFuncion', mensaje: error.message, funcionId: error.funcionId })
    return
  }
  if (error instanceof EntradaYaUsada) {
    reply.status(409).send({
      error: 'EntradaYaUsada',
      mensaje: error.message,
      usadaInstante: error.usadaInstante,
      usadaOperadorId: error.usadaOperadorId,
    })
    return
  }
  if (error instanceof FuncionCancelada) {
    reply.status(410).send({ error: 'FuncionCancelada', mensaje: error.message, funcionId: error.funcionId })
    return
  }
  if (error instanceof CompraAnulada) {
    reply.status(409).send({ error: 'CompraAnulada', mensaje: error.message })
    return
  }
  if (tieneCodigoPropio(error)) {
    reply.status(error.statusCode ?? 500).send({ mensaje: error.message })
    return
  }

  reply.status(400).send({ mensaje: error.message })
}
