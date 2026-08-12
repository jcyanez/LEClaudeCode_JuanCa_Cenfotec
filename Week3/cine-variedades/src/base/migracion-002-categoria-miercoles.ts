import type { Migracion } from './migraciones.js'

/**
 * El esquema inicial dejó el CHECK de `entrada.categoria` en dos valores,
 * pero el glosario de ESPECIFICACION.md define tres categorías de precio
 * (general, estudiante, miércoles) y REG-1 congela la categoría de cada
 * butaca. SQLite no altera un CHECK: se reconstruye la tabla.
 */
function reconstruirEntrada(bd: Parameters<Migracion['subir']>[0], categorias: string): void {
  bd.exec(`
    CREATE TABLE entrada_nueva (
      id                INTEGER PRIMARY KEY,
      compra_id         INTEGER NOT NULL REFERENCES compra (id),
      butaca_id         INTEGER NOT NULL REFERENCES butaca (id),
      categoria         TEXT    NOT NULL CHECK (categoria IN (${categorias})),
      monto             INTEGER NOT NULL,
      usada_instante    TEXT,
      usada_operador_id INTEGER REFERENCES operador (id)
    );
    INSERT INTO entrada_nueva SELECT * FROM entrada;
    DROP TABLE entrada;
    ALTER TABLE entrada_nueva RENAME TO entrada;
  `)
}

export const migracion002CategoriaMiercoles: Migracion = {
  nombre: '002-categoria-miercoles',

  subir(bd) {
    reconstruirEntrada(bd, `'general', 'estudiante', 'miercoles'`)
  },

  bajar(bd) {
    reconstruirEntrada(bd, `'general', 'estudiante'`)
  },
}
