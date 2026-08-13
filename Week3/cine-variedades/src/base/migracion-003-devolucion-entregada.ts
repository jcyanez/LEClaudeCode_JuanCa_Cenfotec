import type { Migracion } from './migraciones.js'

/**
 * REG-4 pide guardar quién anuló o canceló, cuándo y por qué; REG-5 pide,
 * por separado, quién entregó la devolución en efectivo, cuándo y en qué
 * jornada (RF-25). Son dos eventos que pueden ocurrir en instantes distintos
 * —se anula hoy, se entrega la plata mañana—, y el esquema inicial solo
 * dejó un juego de columnas (`reversa_*`) para el primero. Se agregan
 * columnas propias para el segundo, sin tocar `reversa_*` (RN-40, RN-41).
 */
export const migracion003DevolucionEntregada: Migracion = {
  nombre: '003-devolucion-entregada',

  subir(bd) {
    bd.exec(`
      ALTER TABLE compra ADD COLUMN entrega_operador_id INTEGER REFERENCES operador (id);
      ALTER TABLE compra ADD COLUMN entrega_instante TEXT;
      ALTER TABLE compra ADD COLUMN entrega_jornada TEXT;
    `)
  },

  bajar(bd) {
    bd.exec(`
      ALTER TABLE compra DROP COLUMN entrega_jornada;
      ALTER TABLE compra DROP COLUMN entrega_instante;
      ALTER TABLE compra DROP COLUMN entrega_operador_id;
    `)
  },
}
