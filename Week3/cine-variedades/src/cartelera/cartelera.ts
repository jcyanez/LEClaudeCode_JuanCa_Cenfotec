import type { Bd } from '../base/bd.js'

/** Las dos salas del cine, un dato fijo del negocio (RN-1, RN-2). */
const SALAS = [
  { nombre: 'Sala 1', filas: 10, butacasPorFila: 12 },
  { nombre: 'Sala 2', filas: 6, butacasPorFila: 10 },
] as const

const LETRA_A = 'A'.charCodeAt(0)

export interface Butaca {
  id: number
  fila: string
  numero: number
  /** Cómo se nombra en el mapa y en voz alta: `A1`, `F7` (RN-2). */
  etiqueta: string
}

/** Todas las butacas de una sala, ordenadas por fila y número (RN-2, RF-9). */
export function butacasDe(bd: Bd, salaId: number): Butaca[] {
  return bd
    .prepare(
      `SELECT id, fila, numero FROM butaca WHERE sala_id = ? ORDER BY fila, numero`,
    )
    .all(salaId)
    .map((fila) => {
      const b = fila as { id: number; fila: string; numero: number }
      return { ...b, etiqueta: `${b.fila}${b.numero}` }
    })
}

export interface Pelicula {
  id: number
  titulo: string
  duracionMinutos: number
}

/** Registra una película; el título y la duración en minutos son obligatorios (RN-4, RF-1). */
export function registrarPelicula(bd: Bd, titulo: string, duracionMinutos: number): number {
  const tituloLimpio = titulo.trim()
  if (tituloLimpio === '') {
    throw new Error('La película necesita un título')
  }
  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
    throw new Error('La duración debe ser un número entero de minutos mayor que cero')
  }
  const resultado = bd
    .prepare(`INSERT INTO pelicula (titulo, duracion_minutos) VALUES (?, ?)`)
    .run(tituloLimpio, duracionMinutos)
  return Number(resultado.lastInsertRowid)
}

/** Las películas registradas, con su duración (RN-4). */
export function peliculas(bd: Bd): Pelicula[] {
  return bd
    .prepare(
      `SELECT id, titulo, duracion_minutos AS duracionMinutos FROM pelicula ORDER BY id`,
    )
    .all() as Pelicula[]
}

/**
 * Crea las dos salas con sus 180 butacas fijas, una sola vez: si ya existen,
 * no hace nada. Las butacas son inmutables después de creadas (RN-1).
 */
export function sembrarSalas(bd: Bd): void {
  const yaHaySalas = bd.prepare(`SELECT 1 FROM sala LIMIT 1`).get() !== undefined
  if (yaHaySalas) return

  const insertarSala = bd.prepare(
    `INSERT INTO sala (nombre, filas, butacas_por_fila) VALUES (?, ?, ?)`,
  )
  const insertarButaca = bd.prepare(
    `INSERT INTO butaca (sala_id, fila, numero) VALUES (?, ?, ?)`,
  )
  bd.transaction(() => {
    for (const sala of SALAS) {
      const salaId = Number(
        insertarSala.run(sala.nombre, sala.filas, sala.butacasPorFila).lastInsertRowid,
      )
      for (let fila = 0; fila < sala.filas; fila++) {
        for (let numero = 1; numero <= sala.butacasPorFila; numero++) {
          insertarButaca.run(salaId, String.fromCharCode(LETRA_A + fila), numero)
        }
      }
    }
  })()
}
