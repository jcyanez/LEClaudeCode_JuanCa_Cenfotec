import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { tieneTomadas, tomadas, tomar } from './ocupacion.js'

const AHORA = '2026-08-14T18:00:00'

/** Base con esquema y una función sembrada con 12 butacas (fila F de Sala 1). */
function bdConFuncion(): { bd: Bd; funcionId: number; butacas: number[] } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  bd.prepare(`INSERT INTO sala (nombre, filas, butacas_por_fila) VALUES ('Sala 1', 10, 12)`).run()
  const butacas: number[] = []
  const insertarButaca = bd.prepare(`INSERT INTO butaca (sala_id, fila, numero) VALUES (1, 'F', ?)`)
  for (let numero = 1; numero <= 12; numero++) {
    butacas.push(Number(insertarButaca.run(numero).lastInsertRowid))
  }
  bd.prepare(`INSERT INTO pelicula (titulo, duracion_minutos) VALUES ('La película', 120)`).run()
  bd.prepare(
    `INSERT INTO semana_cartelera (jueves_inicio, abierta_a_venta) VALUES ('2026-08-13', 1)`,
  ).run()
  bd.prepare(
    `INSERT INTO funcion (pelicula_id, sala_id, semana_id, fecha, hora_inicio)
     VALUES (1, 1, 1, '2026-08-14', '19:00')`,
  ).run()
  return { bd, funcionId: 1, butacas }
}

describe('ocupación: tomar y consultar butacas (T3)', () => {
  it('toma un grupo de butacas libres y las devuelve como tomadas, con motivo y referencia', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    const resultado = tomar(bd, funcionId, [butacas[0]!, butacas[1]!], 'venta', 'compra-1', AHORA)
    expect(resultado).toEqual({ tomadas: true })
    expect(tomadas(bd, funcionId, AHORA)).toEqual([
      { butacaId: butacas[0]!, motivo: 'venta', referencia: 'compra-1' },
      { butacaId: butacas[1]!, motivo: 'venta', referencia: 'compra-1' },
    ])
  })

  it('al chocar no toma ninguna del grupo y devuelve exactamente cuáles se adelantaron (RN-22)', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    tomar(bd, funcionId, [butacas[4]!, butacas[7]!], 'venta', 'compra-1', AHORA)

    const resultado = tomar(
      bd,
      funcionId,
      [butacas[3]!, butacas[4]!, butacas[5]!, butacas[7]!],
      'bloqueo',
      'sesion-a',
      AHORA,
      '2026-08-14T18:05:00',
    )

    expect(resultado).toEqual({ tomadas: false, seAdelantaron: [butacas[4]!, butacas[7]!] })
    // Nada quedó a medias: solo siguen tomadas las de la compra que llegó primero.
    expect(tomadas(bd, funcionId, AHORA)).toEqual([
      { butacaId: butacas[4]!, motivo: 'venta', referencia: 'compra-1' },
      { butacaId: butacas[7]!, motivo: 'venta', referencia: 'compra-1' },
    ])
  })

  it('un bloqueo vencido se comporta como libre al leer, desde el instante exacto (RN-19)', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    tomar(bd, funcionId, [butacas[0]!], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')

    expect(tomadas(bd, funcionId, '2026-08-14T18:04:59')).toHaveLength(1)
    expect(tomadas(bd, funcionId, '2026-08-14T18:05:00')).toEqual([])
  })

  it('tomar sobre un bloqueo vencido lo borra y toma la butaca, sin esperar ningún barrido', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    tomar(bd, funcionId, [butacas[0]!], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')

    const resultado = tomar(
      bd,
      funcionId,
      [butacas[0]!],
      'venta',
      'compra-1',
      '2026-08-14T18:05:00',
    )

    expect(resultado).toEqual({ tomadas: true })
    expect(tomadas(bd, funcionId, '2026-08-14T18:05:00')).toEqual([
      { butacaId: butacas[0]!, motivo: 'venta', referencia: 'compra-1' },
    ])
  })

  it('un bloqueo aún vigente sí rechaza a quien llega después (RN-18)', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    tomar(bd, funcionId, [butacas[0]!], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')

    const resultado = tomar(bd, funcionId, [butacas[0]!], 'venta', 'compra-1', '2026-08-14T18:04:00')

    expect(resultado).toEqual({ tomadas: false, seAdelantaron: [butacas[0]!] })
  })

  it('tieneTomadas distingue una función intacta de una con butacas vigentes (RF-4)', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    expect(tieneTomadas(bd, funcionId, AHORA)).toBe(false)

    tomar(bd, funcionId, [butacas[0]!], 'venta', 'compra-1', AHORA)
    expect(tieneTomadas(bd, funcionId, AHORA)).toBe(true)
  })

  it('tieneTomadas ignora las vencidas: solo un bloqueo caducado no cuenta como tomada', () => {
    const { bd, funcionId, butacas } = bdConFuncion()
    tomar(bd, funcionId, [butacas[0]!], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')

    expect(tieneTomadas(bd, funcionId, '2026-08-14T18:05:00')).toBe(false)
  })

  it('dos conexiones sobre la misma butaca: una gana y la otra recibe el rechazo (RNF-4, CA-1)', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'cine-variedades-'))
    const ruta = join(carpeta, 'ocupacion.db')
    const bdA = abrirBd(ruta)
    const bdB = abrirBd(ruta)
    try {
      aplicarMigraciones(bdA, listaMigraciones)
      bdA.prepare(`INSERT INTO sala (nombre, filas, butacas_por_fila) VALUES ('Sala 1', 10, 12)`).run()
      bdA.prepare(`INSERT INTO butaca (sala_id, fila, numero) VALUES (1, 'F', 7)`).run()
      bdA.prepare(`INSERT INTO pelicula (titulo, duracion_minutos) VALUES ('La película', 120)`).run()
      bdA.prepare(
        `INSERT INTO semana_cartelera (jueves_inicio, abierta_a_venta) VALUES ('2026-08-13', 1)`,
      ).run()
      bdA.prepare(
        `INSERT INTO funcion (pelicula_id, sala_id, semana_id, fecha, hora_inicio)
         VALUES (1, 1, 1, '2026-08-14', '19:00')`,
      ).run()

      const porA = tomar(bdA, 1, [1], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')
      const porB = tomar(bdB, 1, [1], 'bloqueo', 'sesion-b', AHORA, '2026-08-14T18:05:00')

      expect(porA).toEqual({ tomadas: true })
      expect(porB).toEqual({ tomadas: false, seAdelantaron: [1] })
    } finally {
      bdA.close()
      bdB.close()
      rmSync(carpeta, { recursive: true, force: true })
    }
  })
})
