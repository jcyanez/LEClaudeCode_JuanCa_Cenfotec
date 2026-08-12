import type { Migracion } from './migraciones.js'

/**
 * Esquema inicial: las 13 entidades del modelo de datos de DISENO.md.
 * Convenciones: nombres en español sin acentos, snake_case, montos en
 * céntimos enteros, fechas `AAAA-MM-DD` y horas/instantes como texto ISO.
 * Compra y reserva viven en tablas separadas (decisión del modelo), y la
 * unicidad sobre (funcion, butaca) en `ocupacion` es donde vive RNF-4.
 */
export const migracion001EsquemaInicial: Migracion = {
  nombre: '001-esquema-inicial',

  subir(bd) {
    bd.exec(`
      CREATE TABLE sala (
        id               INTEGER PRIMARY KEY,
        nombre           TEXT    NOT NULL UNIQUE,
        filas            INTEGER NOT NULL,
        butacas_por_fila INTEGER NOT NULL
      );

      CREATE TABLE butaca (
        id      INTEGER PRIMARY KEY,
        sala_id INTEGER NOT NULL REFERENCES sala (id),
        fila    TEXT    NOT NULL,
        numero  INTEGER NOT NULL,
        UNIQUE (sala_id, fila, numero)
      );

      CREATE TABLE pelicula (
        id               INTEGER PRIMARY KEY,
        titulo           TEXT    NOT NULL,
        duracion_minutos INTEGER NOT NULL
      );

      CREATE TABLE semana_cartelera (
        id              INTEGER PRIMARY KEY,
        jueves_inicio   TEXT    NOT NULL UNIQUE,
        abierta_a_venta INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE operador (
        id         INTEGER PRIMARY KEY,
        nombre     TEXT NOT NULL,
        puesto     TEXT NOT NULL CHECK (puesto IN ('dueña', 'taquilla', 'puerta')),
        credencial TEXT NOT NULL
      );

      CREATE TABLE funcion (
        id                 INTEGER PRIMARY KEY,
        pelicula_id        INTEGER NOT NULL REFERENCES pelicula (id),
        sala_id            INTEGER NOT NULL REFERENCES sala (id),
        semana_id          INTEGER NOT NULL REFERENCES semana_cartelera (id),
        fecha              TEXT    NOT NULL,
        hora_inicio        TEXT    NOT NULL,
        estado             TEXT    NOT NULL DEFAULT 'programada'
                           CHECK (estado IN ('programada', 'cancelada')),
        cancelada_operador INTEGER REFERENCES operador (id),
        cancelada_instante TEXT,
        cancelada_jornada  TEXT,
        cancelada_motivo   TEXT
      );

      CREATE TABLE precio_vigente (
        id               INTEGER PRIMARY KEY,
        monto_general    INTEGER NOT NULL,
        monto_estudiante INTEGER NOT NULL,
        desde            TEXT    NOT NULL
      );

      CREATE TABLE ocupacion (
        id         INTEGER PRIMARY KEY,
        funcion_id INTEGER NOT NULL REFERENCES funcion (id),
        butaca_id  INTEGER NOT NULL REFERENCES butaca (id),
        motivo     TEXT    NOT NULL CHECK (motivo IN ('bloqueo', 'reserva', 'venta')),
        referencia TEXT    NOT NULL,
        vence      TEXT,
        UNIQUE (funcion_id, butaca_id)
      );

      CREATE TABLE reserva (
        id         INTEGER PRIMARY KEY,
        numero     TEXT    NOT NULL UNIQUE,
        funcion_id INTEGER NOT NULL REFERENCES funcion (id),
        nombre     TEXT    NOT NULL,
        correo     TEXT,
        telefono   TEXT,
        instante   TEXT    NOT NULL
      );

      CREATE TABLE compra (
        id                  INTEGER PRIMARY KEY,
        numero              TEXT    NOT NULL UNIQUE,
        canal               TEXT    NOT NULL CHECK (canal IN ('taquilla', 'internet')),
        instante            TEXT    NOT NULL,
        jornada             TEXT    NOT NULL,
        funcion_id          INTEGER NOT NULL REFERENCES funcion (id),
        estado              TEXT    NOT NULL DEFAULT 'pagada'
                            CHECK (estado IN ('pagada', 'anulada', 'devuelta')),
        monto_total         INTEGER NOT NULL,
        operador_id         INTEGER REFERENCES operador (id),
        contacto_nombre     TEXT,
        contacto_correo     TEXT,
        contacto_telefono   TEXT,
        reversa_operador_id INTEGER REFERENCES operador (id),
        reversa_instante    TEXT,
        reversa_jornada     TEXT,
        reversa_motivo      TEXT
      );

      CREATE TABLE entrada (
        id                INTEGER PRIMARY KEY,
        compra_id         INTEGER NOT NULL REFERENCES compra (id),
        butaca_id         INTEGER NOT NULL REFERENCES butaca (id),
        categoria         TEXT    NOT NULL CHECK (categoria IN ('general', 'estudiante')),
        monto             INTEGER NOT NULL,
        usada_instante    TEXT,
        usada_operador_id INTEGER REFERENCES operador (id)
      );

      CREATE TABLE envio_reporte (
        id           INTEGER PRIMARY KEY,
        mes          TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        instante     TEXT NOT NULL,
        resultado    TEXT NOT NULL
      );

      CREATE TABLE configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `)
  },

  bajar(bd) {
    bd.exec(`
      DROP TABLE configuracion;
      DROP TABLE envio_reporte;
      DROP TABLE entrada;
      DROP TABLE compra;
      DROP TABLE reserva;
      DROP TABLE ocupacion;
      DROP TABLE precio_vigente;
      DROP TABLE funcion;
      DROP TABLE operador;
      DROP TABLE semana_cartelera;
      DROP TABLE pelicula;
      DROP TABLE butaca;
      DROP TABLE sala;
    `)
  },
}
