import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from './bd.js'
import { listaMigraciones } from './lista-migraciones.js'
import { aplicarMigraciones, revertirUltimaMigracion } from './migraciones.js'

const TABLAS = [
  'sala',
  'butaca',
  'pelicula',
  'semana_cartelera',
  'funcion',
  'precio_vigente',
  'ocupacion',
  'reserva',
  'compra',
  'entrada',
  'operador',
  'envio_reporte',
  'configuracion',
]

function bdConEsquema(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  return bd
}

function tablasExistentes(bd: Bd): string[] {
  return bd
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((fila) => (fila as { name: string }).name)
}

/** Deja creada una función con su sala, butaca, película y semana; devuelve los ids. */
function sembrarFuncion(bd: Bd): { funcionId: number; butacaId: number } {
  bd.prepare(`INSERT INTO sala (nombre, filas, butacas_por_fila) VALUES ('Sala 1', 10, 12)`).run()
  bd.prepare(`INSERT INTO butaca (sala_id, fila, numero) VALUES (1, 'F', 7)`).run()
  bd.prepare(`INSERT INTO pelicula (titulo, duracion_minutos) VALUES ('La película', 120)`).run()
  bd.prepare(
    `INSERT INTO semana_cartelera (jueves_inicio, abierta_a_venta) VALUES ('2026-08-13', 1)`,
  ).run()
  bd.prepare(
    `INSERT INTO funcion (pelicula_id, sala_id, semana_id, fecha, hora_inicio)
     VALUES (1, 1, 1, '2026-08-14', '19:00')`,
  ).run()
  return { funcionId: 1, butacaId: 1 }
}

describe('esquema inicial', () => {
  it('las migraciones aplican desde cero y crean las 13 tablas del modelo', () => {
    const bd = bdConEsquema()
    const tablas = tablasExistentes(bd)
    for (const tabla of TABLAS) expect(tablas).toContain(tabla)
  })

  it('compra y reserva son tablas separadas (decisión del modelo de DISENO.md)', () => {
    const bd = bdConEsquema()
    const tablas = tablasExistentes(bd)
    expect(tablas).toContain('compra')
    expect(tablas).toContain('reserva')
  })

  it('el motor rechaza dos ocupaciones sobre la misma (función, butaca) — RNF-4, CA-1', () => {
    const bd = bdConEsquema()
    const { funcionId, butacaId } = sembrarFuncion(bd)
    const insertar = bd.prepare(
      `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia, vence)
       VALUES (?, ?, 'bloqueo', 'sesion-a', '2026-08-14T18:00:00')`,
    )
    insertar.run(funcionId, butacaId)
    expect(() => insertar.run(funcionId, butacaId)).toThrow(/UNIQUE/)
  })

  it('la misma butaca en funciones distintas sí se puede ocupar', () => {
    const bd = bdConEsquema()
    const { butacaId } = sembrarFuncion(bd)
    bd.prepare(
      `INSERT INTO funcion (pelicula_id, sala_id, semana_id, fecha, hora_inicio)
       VALUES (1, 1, 1, '2026-08-14', '21:30')`,
    ).run()
    const insertar = bd.prepare(
      `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia)
       VALUES (?, ?, 'venta', 'compra-1')`,
    )
    insertar.run(1, butacaId)
    expect(() => insertar.run(2, butacaId)).not.toThrow()
  })

  it('las claves foráneas se hacen cumplir: ocupar una función inexistente falla', () => {
    const bd = bdConEsquema()
    sembrarFuncion(bd)
    expect(() =>
      bd
        .prepare(
          `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia)
           VALUES (999, 1, 'venta', 'compra-1')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/)
  })

  it('los valores cerrados se hacen cumplir: motivo, canal y puesto inválidos fallan', () => {
    const bd = bdConEsquema()
    sembrarFuncion(bd)
    expect(() =>
      bd
        .prepare(
          `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia)
           VALUES (1, 1, 'apartado', 'x')`,
        )
        .run(),
    ).toThrow(/CHECK/)
    expect(() =>
      bd
        .prepare(
          `INSERT INTO compra (numero, canal, instante, jornada, funcion_id, monto_total)
           VALUES ('ABC234', 'telefono', '2026-08-14T10:00:00', '2026-08-14', 1, 5000)`,
        )
        .run(),
    ).toThrow(/CHECK/)
    expect(() =>
      bd
        .prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'gerente', '1234')`)
        .run(),
    ).toThrow(/CHECK/)
  })

  it('el número de compra no se repite (RN-25)', () => {
    const bd = bdConEsquema()
    sembrarFuncion(bd)
    const insertar = bd.prepare(
      `INSERT INTO compra (numero, canal, instante, jornada, funcion_id, monto_total)
       VALUES ('ABC234', 'taquilla', '2026-08-14T10:00:00', '2026-08-14', 1, 5000)`,
    )
    insertar.run()
    expect(() => insertar.run()).toThrow(/UNIQUE/)
  })

  it('dos butacas no comparten fila y número dentro de la misma sala (RN-1)', () => {
    const bd = bdConEsquema()
    sembrarFuncion(bd)
    expect(() =>
      bd.prepare(`INSERT INTO butaca (sala_id, fila, numero) VALUES (1, 'F', 7)`).run(),
    ).toThrow(/UNIQUE/)
  })

  it('la reversa deja la base sin ninguna tabla del modelo', () => {
    const bd = bdConEsquema()
    revertirUltimaMigracion(bd, listaMigraciones)
    const tablas = tablasExistentes(bd)
    for (const tabla of TABLAS) expect(tablas).not.toContain(tabla)
  })
})
