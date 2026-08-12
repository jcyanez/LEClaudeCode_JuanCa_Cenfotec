import Database from 'better-sqlite3'

export type Bd = Database.Database

/**
 * Abre la base de datos SQLite del sistema. Sin ruta, abre una en memoria
 * (para pruebas). WAL y claves foráneas son decisiones de T0 registradas
 * en DISENO.md («Otras decisiones»).
 */
export function abrirBd(ruta = ':memory:'): Bd {
  const bd = new Database(ruta)
  bd.pragma('journal_mode = WAL')
  bd.pragma('foreign_keys = ON')
  return bd
}
