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
import { venderEnTaquilla } from '../venta/venta.js'
import { tickMensual, tickPeriodico } from './reloj.js'

const AHORA = '2026-08-14T18:00:00'

describe('reloj: tick periódico — cada 10 minutos (T17)', () => {
  it('llama al barrido de Venta y al procesamiento de Avisos, con el mismo instante (RN-19, RN-30, RN-48)', async () => {
    const barrerVencidos = vi.fn().mockReturnValue({ reservas: 2, ocupaciones: 3 })
    const procesarAvisos = vi.fn().mockResolvedValue({ enviados: 1, reintentados: 0, fallidos: 0 })

    const resultado = await tickPeriodico(AHORA, { barrerVencidos, procesarAvisos })

    expect(barrerVencidos).toHaveBeenCalledWith(AHORA)
    expect(procesarAvisos).toHaveBeenCalledWith(AHORA)
    expect(resultado).toEqual({
      barrido: { reservas: 2, ocupaciones: 3 },
      avisos: { enviados: 1, reintentados: 0, fallidos: 0 },
    })
  })

  it('no contiene ninguna regla: no le pregunta nada a quien llama, solo pasa el instante', async () => {
    const barrerVencidos = vi.fn().mockReturnValue({ reservas: 0, ocupaciones: 0 })
    const procesarAvisos = vi.fn().mockResolvedValue({ enviados: 0, reintentados: 0, fallidos: 0 })

    await tickPeriodico('2026-01-01T00:00:00', { barrerVencidos, procesarAvisos })

    expect(barrerVencidos).toHaveBeenCalledTimes(1)
    expect(procesarAvisos).toHaveBeenCalledTimes(1)
  })
})

describe('reloj: tick mensual — el día 1 (T17, RN-47)', () => {
  it('el día 1, pide a Salidas el reporte del mes recién terminado y su envío', async () => {
    const reporteDelMes = vi.fn().mockResolvedValue({
      mes: '2026-07',
      destinatario: 'distribuidor@correo.com',
      instante: '2026-08-01T06:00:00',
      resultado: 'enviado',
    })

    const resultado = await tickMensual('2026-08-01T06:00:00', { reporteDelMes })

    expect(reporteDelMes).toHaveBeenCalledWith('2026-07', '2026-08-01T06:00:00')
    expect(resultado).toEqual({
      mes: '2026-07',
      destinatario: 'distribuidor@correo.com',
      instante: '2026-08-01T06:00:00',
      resultado: 'enviado',
    })
  })

  it('enero: el mes recién terminado es diciembre del año anterior', async () => {
    const reporteDelMes = vi.fn().mockResolvedValue({
      mes: '2025-12',
      destinatario: 'd@correo.com',
      instante: '2026-01-01T06:00:00',
      resultado: 'enviado',
    })

    await tickMensual('2026-01-01T06:00:00', { reporteDelMes })

    expect(reporteDelMes).toHaveBeenCalledWith('2025-12', '2026-01-01T06:00:00')
  })

  it('cualquier otro día del mes no hace nada', async () => {
    const reporteDelMes = vi.fn()

    const resultado = await tickMensual('2026-08-15T06:00:00', { reporteDelMes })

    expect(reporteDelMes).not.toHaveBeenCalled()
    expect(resultado).toBeNull()
  })
})

describe('reloj: si no corre, el cine sigue vendiendo (decisión 4 de DISENO.md)', () => {
  it('vender en taquilla no depende de ningún tick del Reloj', () => {
    const bd: Bd = abrirBd()
    aplicarMigraciones(bd, listaMigraciones)
    sembrarSalas(bd)
    const peliculaId = registrarPelicula(bd, 'La película', 120)
    const semanaId = crearSemana(bd, '2026-08-13', '2026-08-12')
    abrirVenta(bd, semanaId)
    fijarPrecios(bd, 8000, 5000, '2026-08-01')
    bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
    const viernes = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
    })

    // Ningún tick del Reloj se ejecutó jamás en esta prueba, y la venta funciona igual.
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], 1, AHORA)

    expect(compra.estado).toBe('pagada')
  })
})
