import type { Bd } from '../base/bd.js'

export type Motivo = 'bloqueo' | 'reserva' | 'venta'

export interface ButacaTomada {
  butacaId: number
  motivo: Motivo
  referencia: string
}

export type ResultadoTomar = { tomadas: true } | { tomadas: false; seAdelantaron: number[] }

/**
 * Toma un grupo de butacas de una función, todas o ninguna (RN-22).
 * `ahora` viene de quien llama: este componente no mira el reloj (DISENO.md).
 */
export function tomar(
  bd: Bd,
  funcionId: number,
  butacaIds: number[],
  motivo: Motivo,
  referencia: string,
  ahora: string,
  vence: string | null = null,
): ResultadoTomar {
  const borrarVencida = bd.prepare(
    `DELETE FROM ocupacion
     WHERE funcion_id = ? AND butaca_id = ? AND vence IS NOT NULL AND vence <= ?`,
  )
  const insertar = bd.prepare(
    `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia, vence)
     VALUES (?, ?, ?, ?, ?)`,
  )
  try {
    bd.transaction(() => {
      for (const butacaId of butacaIds) {
        borrarVencida.run(funcionId, butacaId, ahora)
        insertar.run(funcionId, butacaId, motivo, referencia, vence)
      }
    })()
  } catch (error) {
    if (esChoqueDeUnicidad(error)) {
      return { tomadas: false, seAdelantaron: seAdelantaron(bd, funcionId, butacaIds, ahora) }
    }
    throw error
  }
  return { tomadas: true }
}

function esChoqueDeUnicidad(error: unknown): boolean {
  return (
    error instanceof Error && (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

/**
 * Borra todas las filas de una referencia: anulación, cancelación o reserva
 * no convertida (RN-40, RN-41, RN-32).
 */
export function liberar(bd: Bd, referencia: string): void {
  bd.prepare(`DELETE FROM ocupacion WHERE referencia = ?`).run(referencia)
}

/**
 * Cambia el motivo de todas las filas de una referencia (bloqueo/reserva → venta)
 * en un solo UPDATE: la butaca nunca queda libre en el medio (RN-26, RN-31).
 * La venta no vence, así que el vencimiento se limpia.
 */
export function cambiarMotivo(
  bd: Bd,
  referencia: string,
  nuevoMotivo: Motivo,
  nuevaReferencia: string,
): void {
  bd.prepare(
    `UPDATE ocupacion SET motivo = ?, referencia = ?, vence = NULL WHERE referencia = ?`,
  ).run(nuevoMotivo, nuevaReferencia, referencia)
}

/**
 * Borra las filas vencidas al instante `ahora` y devuelve cuántas (REG-8).
 * Es limpieza, no corrección: si no corre, nada se rompe, porque `tomar`
 * borra las vencidas en el camino (decisión 4 de DISENO.md).
 */
export function barrer(bd: Bd, ahora: string): number {
  return bd
    .prepare(`DELETE FROM ocupacion WHERE vence IS NOT NULL AND vence <= ?`)
    .run(ahora).changes
}

/** Si la función tiene alguna butaca tomada y sin vencer; lo consulta Cartelera para RF-4. */
export function tieneTomadas(bd: Bd, funcionId: number, ahora: string): boolean {
  const fila = bd
    .prepare(
      `SELECT 1 FROM ocupacion
       WHERE funcion_id = ? AND (vence IS NULL OR vence > ?)
       LIMIT 1`,
    )
    .get(funcionId, ahora)
  return fila !== undefined
}

/** Cuáles de las butacas pedidas ya están tomadas y sin vencer al instante `ahora`. */
function seAdelantaron(bd: Bd, funcionId: number, butacaIds: number[], ahora: string): number[] {
  const marcadores = butacaIds.map(() => '?').join(', ')
  return bd
    .prepare(
      `SELECT butaca_id AS butacaId
       FROM ocupacion
       WHERE funcion_id = ? AND butaca_id IN (${marcadores})
         AND (vence IS NULL OR vence > ?)
       ORDER BY butaca_id`,
    )
    .all(funcionId, ...butacaIds, ahora)
    .map((fila) => (fila as { butacaId: number }).butacaId)
}

/** Butacas tomadas de una función, sin las vencidas al instante `ahora` (RN-17 a RN-20). */
export function tomadas(bd: Bd, funcionId: number, ahora: string): ButacaTomada[] {
  return bd
    .prepare(
      `SELECT butaca_id AS butacaId, motivo, referencia
       FROM ocupacion
       WHERE funcion_id = ? AND (vence IS NULL OR vence > ?)
       ORDER BY butaca_id`,
    )
    .all(funcionId, ahora) as ButacaTomada[]
}
