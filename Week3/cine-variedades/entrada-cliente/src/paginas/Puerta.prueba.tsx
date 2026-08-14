import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompraCompleta, FuncionDeJornada } from '../api/cliente.js'

const api = vi.hoisted(() => ({
  obtenerFuncionesDeLaJornada: vi.fn(),
  validarEnPuerta: vi.fn(),
  buscarComprasPorContacto: vi.fn(),
}))

vi.mock('../api/cliente.js', async () => {
  const real = await vi.importActual<typeof import('../api/cliente.js')>('../api/cliente.js')
  return { ...real, ...api }
})

// La sesión de operador se resuelve con la cookie ya abierta: acá se prueba la
// pantalla de la puerta, no la identificación (eso es de SesionOperador).
vi.mock('../componentes/SesionOperador.js', () => ({
  SesionOperador: ({ children }: { children: (operador: unknown) => React.ReactNode }) => (
    <>{children({ id: 2, nombre: 'Luis', puesto: 'puerta' })}</>
  ),
}))

const { Puerta } = await import('./Puerta.js')

const FUNCION: FuncionDeJornada = {
  funcionId: 7,
  salaId: 1,
  pelicula: 'La película',
  sala: 'Sala 1',
  filas: 10,
  butacasPorFila: 12,
  fecha: '2026-08-14',
  horaInicio: '23:00',
  categoriaBase: 'general',
  precios: { general: 8000, estudiante: 5000 },
  cancelada: false,
}

const COMPRA: CompraCompleta = {
  numero: 'ABC234',
  canal: 'internet',
  instante: '2026-08-14T18:00:00',
  jornada: '2026-08-14',
  funcionId: 7,
  estado: 'pagada',
  montoTotal: 8000,
  operadorId: null,
  entradas: [{ butacaId: 1, categoria: 'general', monto: 8000, usadaInstante: null, usadaOperadorId: null }],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.obtenerFuncionesDeLaJornada.mockResolvedValue([FUNCION])
})

describe('Puerta: validar por número (T21, RF-19, RF-20)', () => {
  it('valida y deja pasar, diciendo cuántas entradas son', async () => {
    api.validarEnPuerta.mockResolvedValue(COMPRA)
    render(<Puerta />)

    await userEvent.type(await screen.findByLabelText('Número de compra'), 'abc234')
    await userEvent.click(screen.getByRole('button', { name: 'Validar' }))

    expect(api.validarEnPuerta).toHaveBeenCalledWith(7, 'ABC234')
    expect(await screen.findByText(/Puede pasar/)).toBeInTheDocument()
  })

  it('unas entradas ya usadas se rechazan con su mensaje, sin ofrecer buscar por nombre', async () => {
    api.validarEnPuerta.mockRejectedValue({
      status: 409,
      error: 'EntradaYaUsada',
      mensaje: 'Las entradas de ABC234 ya se validaron a las 20:42',
    })
    render(<Puerta />)

    await userEvent.type(await screen.findByLabelText('Número de compra'), 'ABC234')
    await userEvent.click(screen.getByRole('button', { name: 'Validar' }))

    expect(await screen.findByText(/ya se validaron a las 20:42/)).toBeInTheDocument()
    expect(screen.queryByText('Buscar por nombre o correo')).not.toBeInTheDocument()
  })

  it('un número que no existe ofrece la búsqueda alternativa antes de rechazar a nadie (RF-18)', async () => {
    api.validarEnPuerta.mockRejectedValue({
      status: 404,
      error: 'CompraInexistente',
      mensaje: 'No encontramos ninguna compra con el número ZZZ999',
    })
    api.buscarComprasPorContacto.mockResolvedValue([COMPRA])
    render(<Puerta />)

    await userEvent.type(await screen.findByLabelText('Número de compra'), 'ZZZ999')
    await userEvent.click(screen.getByRole('button', { name: 'Validar' }))

    expect(await screen.findByText('Buscar por nombre o correo')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre o correo'), 'ana@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByRole('button', { name: 'ABC234' })).toBeInTheDocument()
  })

  it('avisa cuando la función elegida está cancelada: ninguna entrada suya se valida (RN-41)', async () => {
    api.obtenerFuncionesDeLaJornada.mockResolvedValue([{ ...FUNCION, cancelada: true }])
    render(<Puerta />)

    expect(await screen.findByText('Esta función se canceló')).toBeInTheDocument()
  })
})
