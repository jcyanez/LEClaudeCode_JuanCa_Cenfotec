import type { Bd } from './bd.js'

export interface Migracion {
  nombre: string
  subir(bd: Bd): void
  bajar(bd: Bd): void
}

function asegurarRegistro(bd: Bd): void {
  bd.exec(
    `CREATE TABLE IF NOT EXISTS migraciones (
       nombre   TEXT PRIMARY KEY,
       instante TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  )
}

/** Aplica en orden las migraciones aún no registradas. Devuelve los nombres aplicados. */
export function aplicarMigraciones(bd: Bd, migraciones: Migracion[]): string[] {
  asegurarRegistro(bd)
  const registradas = new Set(
    bd
      .prepare('SELECT nombre FROM migraciones')
      .all()
      .map((fila) => (fila as { nombre: string }).nombre),
  )
  const aplicadas: string[] = []
  for (const migracion of migraciones) {
    if (registradas.has(migracion.nombre)) continue
    bd.transaction(() => {
      migracion.subir(bd)
      bd.prepare('INSERT INTO migraciones (nombre) VALUES (?)').run(migracion.nombre)
    })()
    aplicadas.push(migracion.nombre)
  }
  return aplicadas
}

/** Revierte la última migración registrada. Devuelve su nombre, o null si no hay ninguna. */
export function revertirUltimaMigracion(bd: Bd, migraciones: Migracion[]): string | null {
  asegurarRegistro(bd)
  const ultima = bd
    .prepare('SELECT nombre FROM migraciones ORDER BY rowid DESC LIMIT 1')
    .get() as { nombre: string } | undefined
  if (!ultima) return null
  const migracion = migraciones.find((m) => m.nombre === ultima.nombre)
  if (!migracion) {
    throw new Error(`La migración registrada «${ultima.nombre}» no está en la lista`)
  }
  bd.transaction(() => {
    migracion.bajar(bd)
    bd.prepare('DELETE FROM migraciones WHERE nombre = ?').run(migracion.nombre)
  })()
  return migracion.nombre
}
