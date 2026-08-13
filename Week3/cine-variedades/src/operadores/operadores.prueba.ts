import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { identificar, puede, type OperadorIdentificado } from './operadores.js'

function bdConOperadores(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  bd.prepare(
    `INSERT INTO operador (nombre, puesto, credencial) VALUES
       ('Rosa', 'dueña', '1111'),
       ('Marta', 'taquilla', '2222'),
       ('Nico', 'puerta', '3333')`,
  ).run()
  return bd
}

describe('operadores: identificación (T13)', () => {
  it('identifica a un operador por su PIN, con su puesto', () => {
    const bd = bdConOperadores()

    expect(identificar(bd, '2222')).toEqual({ id: 2, nombre: 'Marta', puesto: 'taquilla' })
  })

  it('un PIN que no es de nadie no identifica a nadie', () => {
    const bd = bdConOperadores()

    expect(identificar(bd, '0000')).toBeUndefined()
  })
})

describe('operadores: permisos por puesto (RN-50 a RN-54, RF-32, RF-33)', () => {
  const dueña: OperadorIdentificado = { id: 1, nombre: 'Rosa', puesto: 'dueña' }
  const taquilla: OperadorIdentificado = { id: 2, nombre: 'Marta', puesto: 'taquilla' }
  const puerta: OperadorIdentificado = { id: 3, nombre: 'Nico', puesto: 'puerta' }

  it('la dueña carga cartelera, fija precios, mantiene el correo del distribuidor, consulta y decide anulaciones y cancelaciones (RN-51)', () => {
    expect(puede(dueña, 'cargar-cartelera')).toBe(true)
    expect(puede(dueña, 'fijar-precios')).toBe(true)
    expect(puede(dueña, 'mantener-correo-distribuidor')).toBe(true)
    expect(puede(dueña, 'consultar-reporte')).toBe(true)
    expect(puede(dueña, 'consultar-cierre-caja')).toBe(true)
    expect(puede(dueña, 'cancelar-funcion')).toBe(true)
    expect(puede(dueña, 'anular-compra')).toBe(true)
    expect(puede(dueña, 'vender')).toBe(false)
    expect(puede(dueña, 'validar')).toBe(false)
  })

  it('taquilla vende, convierte reservas, entrega devoluciones, cancela, anula y hace el cierre de caja (RN-52)', () => {
    expect(puede(taquilla, 'vender')).toBe(true)
    expect(puede(taquilla, 'convertir-reserva')).toBe(true)
    expect(puede(taquilla, 'entregar-devolucion')).toBe(true)
    expect(puede(taquilla, 'cancelar-funcion')).toBe(true)
    expect(puede(taquilla, 'anular-compra')).toBe(true)
    expect(puede(taquilla, 'cierre-caja')).toBe(true)
    expect(puede(taquilla, 'validar')).toBe(false)
    expect(puede(taquilla, 'fijar-precios')).toBe(false)
  })

  it('puerta solo valida: no vende, no anula y no cancela (RN-53)', () => {
    expect(puede(puerta, 'validar')).toBe(true)
    expect(puede(puerta, 'vender')).toBe(false)
    expect(puede(puerta, 'anular-compra')).toBe(false)
    expect(puede(puerta, 'cancelar-funcion')).toBe(false)
  })
})
