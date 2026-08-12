import type { Migracion } from './migraciones.js'
import { migracion001EsquemaInicial } from './migracion-001-esquema-inicial.js'

/** Lista ordenada de migraciones del esquema. */
export const listaMigraciones: Migracion[] = [migracion001EsquemaInicial]
