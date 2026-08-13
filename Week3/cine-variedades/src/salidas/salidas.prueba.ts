import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { anular, bloquear, marcarDevolucionEntregada, pagar, reservar, venderEnTaquilla } from '../venta/venta.js'
import { cierreDeCaja } from './salidas.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

function avisosSimulados() {
  return { encolar() {} }
}

function bdListaParaVender(): { bd: Bd; viernes: number; operadorId: number } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  const viernes = programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '19:00' })
  return { bd, viernes, operadorId: 1 }
}

describe('salidas: cierre de caja (T15)', () => {
  it('separa ventanilla e internet, y no incluye internet en la ventanilla (RN-46, RF-26, CA-6)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'estudiante' }], operadorId, AHORA)
    const bloqueo = bloquear(bd, viernes, [3], 'sesion-a', AHORA)
    pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-14T18:02:00')

    const cierre = cierreDeCaja(bd, '2026-08-14')

    expect(cierre).toEqual({
      jornada: '2026-08-14',
      ventanilla: { cobrado: 13000, devuelto: 0, efectivoEsperado: 13000 },
      internet: { vendido: 8000 },
    })
  })

  it('una anulación sin devolución entregada no descuenta nada todavía (RN-40 vs. RF-25)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T18:30:00')

    const cierre = cierreDeCaja(bd, '2026-08-14')

    // Se cobró (RN-16: el monto queda), y todavía no se entregó nada (RF-25 aparte de RN-40).
    expect(cierre.ventanilla).toEqual({ cobrado: 8000, devuelto: 0, efectivoEsperado: 8000 })
  })

  it('la devolución entregada descuenta la jornada de la entrega, no la de la venta (RN-44, CA-8)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T18:30:00')
    marcarDevolucionEntregada(bd, compra.numero, operadorId, '2026-08-15T10:00:00')

    const cierreDeLaVenta = cierreDeCaja(bd, '2026-08-14')
    expect(cierreDeLaVenta.ventanilla).toEqual({ cobrado: 8000, devuelto: 0, efectivoEsperado: 8000 })

    const cierreDeLaEntrega = cierreDeCaja(bd, '2026-08-15')
    expect(cierreDeLaEntrega.ventanilla).toEqual({ cobrado: 0, devuelto: 8000, efectivoEsperado: -8000 })
  })

  it('las reservas de estudiante no suman nunca: viven en otra tabla (decisión del modelo)', () => {
    const { bd, viernes } = bdListaParaVender()
    reservar(bd, avisosSimulados(), viernes, [1, 2], CONTACTO, AHORA)

    const cierre = cierreDeCaja(bd, '2026-08-14')

    expect(cierre).toEqual({
      jornada: '2026-08-14',
      ventanilla: { cobrado: 0, devuelto: 0, efectivoEsperado: 0 },
      internet: { vendido: 0 },
    })
  })

  it('es de solo lectura: correr el cierre dos veces no cambia nada (decisión de DISENO.md)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)

    const primera = cierreDeCaja(bd, '2026-08-14')
    const segunda = cierreDeCaja(bd, '2026-08-14')

    expect(segunda).toEqual(primera)
  })

  it('una jornada sin ninguna operación cierra en cero', () => {
    const { bd } = bdListaParaVender()

    expect(cierreDeCaja(bd, '2026-09-01')).toEqual({
      jornada: '2026-09-01',
      ventanilla: { cobrado: 0, devuelto: 0, efectivoEsperado: 0 },
      internet: { vendido: 0 },
    })
  })
})
