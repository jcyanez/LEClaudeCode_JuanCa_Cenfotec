import type { Migracion } from './migraciones.js'
import { migracion001EsquemaInicial } from './migracion-001-esquema-inicial.js'
import { migracion002CategoriaMiercoles } from './migracion-002-categoria-miercoles.js'

/** Lista ordenada de migraciones del esquema. */
export const listaMigraciones: Migracion[] = [
  migracion001EsquemaInicial,
  migracion002CategoriaMiercoles,
]
