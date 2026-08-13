import type { Bd } from '../base/bd.js'

/**
 * Contrato fijo de Avisos (fijado en T9, implementado acá): encolar acepta
 * siempre, nunca falla ni bloquea a quien llama (RNF-5). No sabe qué es una
 * compra, una función ni un reporte: solo destinatario, asunto, cuerpo y un
 * adjunto ya armados (límite de DISENO.md).
 */
export interface Avisos {
  encolar(destinatario: string, asunto: string, cuerpo: string, adjunto?: unknown): void
}

function adjuntoATexto(adjunto: unknown): string | null {
  if (adjunto === undefined || adjunto === null) return null
  return typeof adjunto === 'string' ? adjunto : JSON.stringify(adjunto)
}

/**
 * Pone un correo en la cola, pendiente de envío (RNF-5): un INSERT simple
 * que no puede fallar por nada que dependa de la red o de un proveedor. El
 * envío en sí ocurre después, al procesar los pendientes.
 */
function encolarUno(
  bd: Bd,
  destinatario: string,
  asunto: string,
  cuerpo: string,
  adjunto: unknown,
  ahora: string,
): void {
  bd.prepare(
    `INSERT INTO aviso (destinatario, asunto, cuerpo, adjunto, creado_instante, intentos, proximo_intento, estado)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'pendiente')`,
  ).run(destinatario, asunto, cuerpo, adjuntoATexto(adjunto), ahora, ahora)
}

/**
 * Fábrica del contrato de Avisos: `ahora` viene de quien compone (Entrada o
 * Salidas), porque este componente tampoco mira el reloj. Cada llamada a
 * `encolar` escribe con el mismo instante de creación de esta fábrica.
 */
export function crearAvisos(bd: Bd, ahora: string): Avisos {
  return {
    encolar(destinatario, asunto, cuerpo, adjunto) {
      encolarUno(bd, destinatario, asunto, cuerpo, adjunto, ahora)
    },
  }
}

/** El método único al que se aísla cualquier proveedor de correo (decisión de DISENO.md). */
export interface EnviarCorreo {
  (destinatario: string, asunto: string, cuerpo: string, adjunto: string | null): Promise<boolean>
}

export interface ResultadoProcesar {
  enviados: number
  reintentados: number
  fallidos: number
}

interface FilaAvisoPendiente {
  id: number
  destinatario: string
  asunto: string
  cuerpo: string
  adjunto: string | null
  creadoInstante: string
  intentos: number
}

const MINUTOS_24_HORAS = 24 * 60

function sumarMinutos(instante: string, minutos: number): string {
  const fecha = new Date(`${instante}Z`)
  fecha.setUTCMinutes(fecha.getUTCMinutes() + minutos)
  return fecha.toISOString().slice(0, 19)
}

function minutosEntre(desde: string, hasta: string): number {
  return (new Date(`${hasta}Z`).getTime() - new Date(`${desde}Z`).getTime()) / 60_000
}

/**
 * Procesa los avisos pendientes que ya llegaron a su próximo intento
 * (RN-48). El que sale bien queda enviado; el que falla reintenta con
 * espaciado creciente —duplica la espera en cada vuelta, decisión de
 * DISENO.md— hasta que el siguiente intento caería más allá de las 24
 * horas desde que se encoló, momento en que queda fallido y visible.
 * Nunca vuelve a tocar un aviso ya enviado o fallido. Quien lo llama
 * periódicamente es el Reloj (T17); si no corre, los avisos simplemente
 * esperan en la cola (decisión 4 de DISENO.md).
 */
export async function procesarPendientes(
  bd: Bd,
  ahora: string,
  enviar: EnviarCorreo,
): Promise<ResultadoProcesar> {
  const pendientes = bd
    .prepare(
      `SELECT id, destinatario, asunto, cuerpo, adjunto,
              creado_instante AS creadoInstante, intentos
       FROM aviso WHERE estado = 'pendiente' AND proximo_intento <= ?
       ORDER BY id`,
    )
    .all(ahora) as FilaAvisoPendiente[]

  const resultado: ResultadoProcesar = { enviados: 0, reintentados: 0, fallidos: 0 }

  for (const fila of pendientes) {
    const salioBien = await enviar(fila.destinatario, fila.asunto, fila.cuerpo, fila.adjunto)
    if (salioBien) {
      bd.prepare(`UPDATE aviso SET estado = 'enviado' WHERE id = ?`).run(fila.id)
      resultado.enviados++
      continue
    }
    const intentos = fila.intentos + 1
    const proximoIntento = sumarMinutos(ahora, 2 ** intentos)
    if (minutosEntre(fila.creadoInstante, proximoIntento) > MINUTOS_24_HORAS) {
      bd.prepare(`UPDATE aviso SET estado = 'fallido', intentos = ? WHERE id = ?`).run(intentos, fila.id)
      resultado.fallidos++
    } else {
      bd.prepare(`UPDATE aviso SET intentos = ?, proximo_intento = ? WHERE id = ?`).run(
        intentos,
        proximoIntento,
        fila.id,
      )
      resultado.reintentados++
    }
  }

  return resultado
}
