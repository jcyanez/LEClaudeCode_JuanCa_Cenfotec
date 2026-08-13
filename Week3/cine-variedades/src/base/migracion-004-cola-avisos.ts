import type { Migracion } from './migraciones.js'

/**
 * La cola propia de Avisos (T14): no es una de las 13 entidades del modelo
 * de dominio de DISENO.md porque Avisos no sabe qué es una compra ni un
 * reporte, solo destinatario, asunto, cuerpo y adjunto ya armados. Necesita
 * su propia tabla para que un reintento sobreviva un reinicio del proceso
 * durante las 24 horas que dura (RN-48).
 */
export const migracion004ColaAvisos: Migracion = {
  nombre: '004-cola-avisos',

  subir(bd) {
    bd.exec(`
      CREATE TABLE aviso (
        id               INTEGER PRIMARY KEY,
        destinatario     TEXT    NOT NULL,
        asunto           TEXT    NOT NULL,
        cuerpo           TEXT    NOT NULL,
        adjunto          TEXT,
        creado_instante  TEXT    NOT NULL,
        intentos         INTEGER NOT NULL DEFAULT 0,
        proximo_intento  TEXT    NOT NULL,
        estado           TEXT    NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente', 'enviado', 'fallido'))
      );
    `)
  },

  bajar(bd) {
    bd.exec(`DROP TABLE aviso;`)
  },
}
