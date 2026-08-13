import { describe, expect, it, vi } from 'vitest'
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
import {
  anular,
  bloquear,
  cancelarFuncion as cancelarFuncionVenta,
  marcarDevolucionEntregada,
  pagar,
  reservar,
  venderEnTaquilla,
} from '../venta/venta.js'
import {
  cierreDeCaja,
  correoDelDistribuidor,
  entradasPorCategoriaYCanal,
  enviarReporte,
  enviosDeReporte,
  fijarCorreoDelDistribuidor,
  ocupacionDeFunciones,
  reporteMensual,
} from './salidas.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

function avisosSimulados() {
  return { encolar() {} }
}

function bdListaParaVender(): { bd: Bd; viernes: number; semanaId: number; operadorId: number } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  const viernes = programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '19:00' })
  return { bd, viernes, semanaId, operadorId: 1 }
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

describe('salidas: reporte mensual (T16)', () => {
  it('arma el detalle función por función del mes, sin contar las anuladas (RF-27)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    const anulada = venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], operadorId, AHORA)
    anular(bd, anulada.numero, operadorId, 'motivo', '2026-08-14T18:30:00')

    const reporte = reporteMensual(bd, '2026-08')

    expect(reporte).toEqual([
      {
        funcionId: viernes,
        pelicula: 'La película',
        sala: 'Sala 1',
        fecha: '2026-08-14',
        horaInicio: '19:00',
        cancelada: false,
        entradasVendidas: 1,
        montoVendido: 8000,
      },
    ])
  })

  it('CA-5: una función cancelada con entradas vendidas y validadas queda marcada, con sus entradas vendidas y devueltas a la vista', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    cancelarFuncionVenta(bd, avisosSimulados(), viernes, operadorId, 'Falló el proyector', '2026-08-14T18:45:00')

    const reporte = reporteMensual(bd, '2026-08')

    expect(reporte).toEqual([
      expect.objectContaining({
        funcionId: viernes,
        cancelada: true,
        entradasVendidas: 1,
        montoVendido: 8000,
      }),
    ])
    // Ninguna de sus compras queda como pagada (CA-5).
    expect(bd.prepare(`SELECT estado FROM compra`).get()).toEqual({ estado: 'devuelta' })
  })

  it('un mes sin funciones programadas da un reporte vacío', () => {
    const { bd } = bdListaParaVender()

    expect(reporteMensual(bd, '2026-12')).toEqual([])
  })

  it('enviarReporte registra el resultado con fecha y destinatario, con hoja de cálculo adjunta (REG-7, RF-28)', async () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    const enviar = vi.fn().mockResolvedValue(true)

    const registro = await enviarReporte(bd, enviar, '2026-08', 'distribuidor@correo.com', '2026-09-01T08:00:00')

    expect(registro).toEqual({
      mes: '2026-08',
      destinatario: 'distribuidor@correo.com',
      instante: '2026-09-01T08:00:00',
      resultado: 'enviado',
    })
    expect(enviar).toHaveBeenCalledTimes(1)
    const [destinatario, asunto, cuerpo, adjunto] = enviar.mock.calls[0] as [string, string, string, string]
    expect(destinatario).toBe('distribuidor@correo.com')
    expect(asunto).toContain('2026-08')
    expect(cuerpo).toContain('1 entradas')
    expect(adjunto).toContain('La película')
    expect(enviosDeReporte(bd, '2026-08')).toEqual([registro])
  })

  it('si el envío falla, queda el intento fallido registrado y se puede reenviar a mano (RF-28, RN-48)', async () => {
    const { bd } = bdListaParaVender()
    const falla = vi.fn().mockResolvedValue(false)

    const primerIntento = await enviarReporte(bd, falla, '2026-08', 'distribuidor@correo.com', '2026-09-01T08:00:00')
    expect(primerIntento.resultado).toBe('fallido')

    const exito = vi.fn().mockResolvedValue(true)
    const reenvio = await enviarReporte(bd, exito, '2026-08', 'distribuidor@correo.com', '2026-09-01T09:00:00')
    expect(reenvio.resultado).toBe('enviado')

    // Los dos intentos quedan, más reciente primero: el fallido no se pierde.
    expect(enviosDeReporte(bd, '2026-08')).toEqual([reenvio, primerIntento])
  })

  it('el correo del distribuidor se guarda y se consulta, y no admite quedar vacío (RN-49, RF-29)', () => {
    const { bd } = bdListaParaVender()

    expect(correoDelDistribuidor(bd)).toBeUndefined()

    fijarCorreoDelDistribuidor(bd, 'distribuidor@correo.com')
    expect(correoDelDistribuidor(bd)).toBe('distribuidor@correo.com')

    fijarCorreoDelDistribuidor(bd, 'otro@correo.com')
    expect(correoDelDistribuidor(bd)).toBe('otro@correo.com')
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM configuracion`).get()).toEqual({ n: 1 })

    expect(() => fijarCorreoDelDistribuidor(bd, '  ')).toThrow('El correo del distribuidor no puede quedar vacío')
  })

  it('la ocupación de las funciones cuenta entradas vendidas sobre butacas de la sala, sin las anuladas (RF-30)', () => {
    const { bd, viernes, semanaId, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    const anulada = venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], operadorId, AHORA)
    anular(bd, anulada.numero, operadorId, 'motivo', '2026-08-14T18:30:00')
    const sabado = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-15',
      horaInicio: '20:00',
    })

    const ocupacion = ocupacionDeFunciones(bd, '2026-08-14', '2026-08-15')

    expect(ocupacion).toEqual([
      { funcionId: viernes, pelicula: 'La película', fecha: '2026-08-14', horaInicio: '19:00', butacas: 120, entradasVendidas: 1, ocupacion: 1 / 120 },
      { funcionId: sabado, pelicula: 'La película', fecha: '2026-08-15', horaInicio: '20:00', butacas: 60, entradasVendidas: 0, ocupacion: 0 },
    ])
  })

  it('entradas y monto por categoría y canal, en el período elegido, sin las anuladas (RF-31)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'estudiante' }], operadorId, AHORA)
    const bloqueo = bloquear(bd, viernes, [3], 'sesion-a', AHORA)
    pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-14T18:02:00')
    const anulada = venderEnTaquilla(bd, viernes, [{ butacaId: 4, categoria: 'general' }], operadorId, AHORA)
    anular(bd, anulada.numero, operadorId, 'motivo', '2026-08-14T18:30:00')

    const resultado = entradasPorCategoriaYCanal(bd, '2026-08-14', '2026-08-14')

    expect(resultado).toEqual([
      { categoria: 'estudiante', canal: 'taquilla', entradas: 1, monto: 5000 },
      { categoria: 'general', canal: 'internet', entradas: 1, monto: 8000 },
      { categoria: 'general', canal: 'taquilla', entradas: 1, monto: 8000 },
    ])

    expect(entradasPorCategoriaYCanal(bd, '2026-08-15', '2026-08-20')).toEqual([])
  })
})
