import { describe, expect, it } from 'vitest'
import { abrirBd } from './bd.js'

describe('base de datos', () => {
  it('abre con claves foráneas activadas', () => {
    const bd = abrirBd()
    expect(bd.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('acepta transacciones que se deshacen enteras al fallar', () => {
    const bd = abrirBd()
    bd.exec('CREATE TABLE prueba (id INTEGER PRIMARY KEY)')
    const fallida = bd.transaction(() => {
      bd.prepare('INSERT INTO prueba (id) VALUES (1)').run()
      throw new Error('falla a mitad de camino')
    })
    expect(() => fallida()).toThrow()
    expect(bd.prepare('SELECT COUNT(*) AS n FROM prueba').get()).toEqual({ n: 0 })
  })
})
