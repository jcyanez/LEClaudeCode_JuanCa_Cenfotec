import { describe, expect, it } from 'vitest'
import { abrirBd } from './bd.js'
import { aplicarMigraciones, revertirUltimaMigracion, type Migracion } from './migraciones.js'

const vacia: Migracion = {
  nombre: '000-vacia',
  subir() {},
  bajar() {},
}

describe('migraciones', () => {
  it('una migración vacía aplica y queda registrada', () => {
    const bd = abrirBd()
    expect(aplicarMigraciones(bd, [vacia])).toEqual(['000-vacia'])
  })

  it('aplicar dos veces no repite ninguna', () => {
    const bd = abrirBd()
    aplicarMigraciones(bd, [vacia])
    expect(aplicarMigraciones(bd, [vacia])).toEqual([])
  })

  it('la última aplicada se revierte y se puede volver a aplicar', () => {
    const bd = abrirBd()
    aplicarMigraciones(bd, [vacia])
    expect(revertirUltimaMigracion(bd, [vacia])).toBe('000-vacia')
    expect(revertirUltimaMigracion(bd, [vacia])).toBeNull()
    expect(aplicarMigraciones(bd, [vacia])).toEqual(['000-vacia'])
  })

  it('una migración que crea una tabla la deja usable y su reversa la quita', () => {
    const bd = abrirBd()
    const conTabla: Migracion = {
      nombre: '001-tabla-prueba',
      subir: (b) => b.exec('CREATE TABLE prueba (id INTEGER PRIMARY KEY)'),
      bajar: (b) => b.exec('DROP TABLE prueba'),
    }
    aplicarMigraciones(bd, [conTabla])
    bd.prepare('INSERT INTO prueba (id) VALUES (1)').run()
    revertirUltimaMigracion(bd, [conTabla])
    expect(() => bd.prepare('SELECT * FROM prueba').get()).toThrow()
  })

  it('se aplican en el orden de la lista', () => {
    const bd = abrirBd()
    const orden: string[] = []
    const a: Migracion = { nombre: 'a', subir: () => void orden.push('a'), bajar() {} }
    const b: Migracion = { nombre: 'b', subir: () => void orden.push('b'), bajar() {} }
    aplicarMigraciones(bd, [a, b])
    expect(orden).toEqual(['a', 'b'])
  })
})
