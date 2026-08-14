import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FuncionEnCartelera, MapaDeTaquilla } from '../../api/cliente.js'

const api = vi.hoisted(() => ({
  obtenerFuncionesDeTaquilla: vi.fn(),
  obtenerMapaDeTaquilla: vi.fn(),
  venderEnTaquilla: vi.fn(),
}))

vi.mock('../../api/cliente.js', async () => {
  const real = await vi.importActual<typeof import('../../api/cliente.js')>('../../api/cliente.js')
  return { ...real, ...api }
})

const { VentaEnTaquilla } = await import('./VentaEnTaquilla.js')

const FUNCION_VIERNES: FuncionEnCartelera = {
  funcionId: 1,
  pelicula: 'La película',
  sala: 'Sala 1',
  fecha: '2026-08-14',
  horaInicio: '19:00',
  categoriaBase: 'general',
  precios: { general: 8000, estudiante: 5000 },
}

function mapaDe(categoriaBase: 'general' | 'miercoles'): MapaDeTaquilla {
  return {
    funcion: { ...FUNCION_VIERNES, salaId: 1, filas: 1, butacasPorFila: 2, categoriaBase },
    precios: categoriaBase === 'miercoles' ? { miercoles: 4000 } : { general: 8000, estudiante: 5000 },
    enVenta: true,
    mapa: [
      { butacaId: 1, etiqueta: 'A1', estado: 'libre', numero: null },
      { butacaId: 2, etiqueta: 'A2', estado: 'vendida', numero: 'XYZ789' },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.obtenerFuncionesDeTaquilla.mockResolvedValue([FUNCION_VIERNES])
})

describe('VentaEnTaquilla: una categoría de precio por butaca (T20, RF-12)', () => {
  it('vende a precio de estudiante la butaca cuyo cliente mostró el carné', async () => {
    api.obtenerMapaDeTaquilla.mockResolvedValue(mapaDe('general'))
    api.venderEnTaquilla.mockResolvedValue({ numero: 'PQR456', montoTotal: 5000 })
    render(<VentaEnTaquilla />)

    await userEvent.click(await screen.findByRole('button', { name: /Butaca A1, libre/ }))
    await userEvent.selectOptions(await screen.findByLabelText('Butaca A1'), 'estudiante')
    await userEvent.click(screen.getByRole('button', { name: /Cobrar .* y registrar/ }))

    await waitFor(() =>
      expect(api.venderEnTaquilla).toHaveBeenCalledWith(1, [{ butacaId: 1, categoria: 'estudiante' }]),
    )
    expect(await screen.findByText(/número PQR456/)).toBeInTheDocument()
  })

  it('en una función de miércoles no ofrece elegir categoría: solo existe miércoles (RN-14, CA-3)', async () => {
    api.obtenerMapaDeTaquilla.mockResolvedValue(mapaDe('miercoles'))
    api.venderEnTaquilla.mockResolvedValue({ numero: 'MNO222', montoTotal: 4000 })
    render(<VentaEnTaquilla />)

    await userEvent.click(await screen.findByRole('button', { name: /Butaca A1, libre/ }))

    expect(screen.queryByLabelText('Butaca A1')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Cobrar .* y registrar/ }))
    await waitFor(() =>
      expect(api.venderEnTaquilla).toHaveBeenCalledWith(1, [{ butacaId: 1, categoria: 'miercoles' }]),
    )
  })

  it('un rechazo del dominio se muestra con su mensaje, sin dejar la venta a medias', async () => {
    api.obtenerMapaDeTaquilla.mockResolvedValue(mapaDe('general'))
    api.venderEnTaquilla.mockRejectedValue({ status: 409, mensaje: 'Algunas butacas ya no están libres' })
    render(<VentaEnTaquilla />)

    await userEvent.click(await screen.findByRole('button', { name: /Butaca A1, libre/ }))
    await userEvent.click(screen.getByRole('button', { name: /Cobrar .* y registrar/ }))

    expect(await screen.findByText('Algunas butacas ya no están libres')).toBeInTheDocument()
  })

  it('una butaca vendida se consulta y muestra su número, sin poder elegirla (RN-57)', async () => {
    api.obtenerMapaDeTaquilla.mockResolvedValue(mapaDe('general'))
    render(<VentaEnTaquilla />)

    await userEvent.click(await screen.findByRole('button', { name: /Butaca A2, vendida/ }))

    expect(await screen.findByText(/Número XYZ789/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cobrar/ })).not.toBeInTheDocument()
  })
})
