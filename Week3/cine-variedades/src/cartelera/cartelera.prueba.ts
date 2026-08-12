import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { butacasDe, peliculas, registrarPelicula, sembrarSalas } from './cartelera.js'

function bdConEsquema(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  return bd
}

describe('cartelera: salas y butacas fijas (T5)', () => {
  it('sembrar crea las dos salas del cine: Sala 1 con 120 butacas y Sala 2 con 60 (RN-1)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const salas = bd
      .prepare(`SELECT nombre, filas, butacas_por_fila AS butacasPorFila FROM sala ORDER BY id`)
      .all()
    expect(salas).toEqual([
      { nombre: 'Sala 1', filas: 10, butacasPorFila: 12 },
      { nombre: 'Sala 2', filas: 6, butacasPorFila: 10 },
    ])

    const porSala = bd
      .prepare(`SELECT sala_id AS salaId, COUNT(*) AS cantidad FROM butaca GROUP BY sala_id`)
      .all()
    expect(porSala).toEqual([
      { salaId: 1, cantidad: 120 },
      { salaId: 2, cantidad: 60 },
    ])
  })

  it('las filas van de la A a la J en Sala 1 y de la A a la F en Sala 2 (RN-1, RN-2)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const filasSala1 = bd
      .prepare(`SELECT DISTINCT fila FROM butaca WHERE sala_id = 1 ORDER BY fila`)
      .all()
      .map((f) => (f as { fila: string }).fila)
    expect(filasSala1).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])

    const filasSala2 = bd
      .prepare(`SELECT DISTINCT fila FROM butaca WHERE sala_id = 2 ORDER BY fila`)
      .all()
      .map((f) => (f as { fila: string }).fila)
    expect(filasSala2).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('butacasDe devuelve las butacas identificadas por fila y número, en orden (RN-2)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const butacas = butacasDe(bd, 2)

    expect(butacas).toHaveLength(60)
    expect(butacas[0]).toEqual({ id: 121, fila: 'A', numero: 1, etiqueta: 'A1' })
    expect(butacas[59]).toEqual({ id: 180, fila: 'F', numero: 10, etiqueta: 'F10' })
    // Dentro de una fila, numeradas de izquierda a derecha mirando la pantalla.
    expect(butacas.slice(0, 10).map((b) => b.etiqueta)).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
    ])
  })

  it('sembrar dos veces no duplica nada: las butacas se crean una sola vez (RN-1)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)
    sembrarSalas(bd)

    const total = bd.prepare(`SELECT COUNT(*) AS cantidad FROM butaca`).get() as {
      cantidad: number
    }
    expect(total.cantidad).toBe(180)
  })
})

describe('cartelera: películas (T5)', () => {
  it('registra una película con su duración y la devuelve al consultar (RN-4, RF-1)', () => {
    const bd = bdConEsquema()

    const id = registrarPelicula(bd, 'El séptimo sello', 96)

    expect(peliculas(bd)).toEqual([{ id, titulo: 'El séptimo sello', duracionMinutos: 96 }])
  })

  it('rechaza una película sin título, nombrando lo que falta', () => {
    const bd = bdConEsquema()
    expect(() => registrarPelicula(bd, '   ', 96)).toThrow('La película necesita un título')
    expect(peliculas(bd)).toEqual([])
  })

  it('rechaza una duración que no sea un entero positivo de minutos (RN-4)', () => {
    const bd = bdConEsquema()
    expect(() => registrarPelicula(bd, 'El séptimo sello', 0)).toThrow(
      'La duración debe ser un número entero de minutos mayor que cero',
    )
    expect(() => registrarPelicula(bd, 'El séptimo sello', 95.5)).toThrow(
      'La duración debe ser un número entero de minutos mayor que cero',
    )
    expect(peliculas(bd)).toEqual([])
  })
})
