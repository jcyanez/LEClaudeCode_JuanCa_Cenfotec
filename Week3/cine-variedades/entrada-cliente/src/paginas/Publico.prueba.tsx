/**
 * Las pantallas del comprador (T19), ahora con los componentes propios en vez
 * de `@carbon/react`. T19 las había dejado sin pruebas de componente; se
 * agregan al cambiar el sistema visual, porque un rediseño que compila no es
 * un rediseño que funciona.
 *
 * Se prueba por texto y por rol accesible —nunca por clases ni por detalles de
 * la maquetación—, así que estas pruebas sobreviven al próximo cambio de
 * estilos: lo que fijan es qué puede hacer y qué lee la persona.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bloqueo, Compra, FuncionEnCartelera, MapaDeFuncion } from '../api/cliente.js'

const api = vi.hoisted(() => ({
  obtenerCartelera: vi.fn(),
  obtenerMapa: vi.fn(),
  bloquearButacas: vi.fn(),
  pagar: vi.fn(),
  reservar: vi.fn(),
}))

vi.mock('../api/cliente.js', async () => {
  const real = await vi.importActual<typeof import('../api/cliente.js')>('../api/cliente.js')
  return { ...real, ...api }
})

const { Cartelera } = await import('./Cartelera.js')
const { Funcion } = await import('./Funcion.js')

const VIERNES: FuncionEnCartelera = {
  funcionId: 7,
  pelicula: 'La ventana indiscreta',
  sala: 'Sala 1',
  fecha: '2026-08-14',
  horaInicio: '19:00',
  categoriaBase: 'general',
  precios: { general: 8000, estudiante: 5000 },
}

const MIERCOLES: FuncionEnCartelera = {
  ...VIERNES,
  funcionId: 9,
  fecha: '2026-08-19',
  categoriaBase: 'miercoles',
  precios: { miercoles: 4000 },
}

const MAPA: MapaDeFuncion = {
  funcion: { ...VIERNES, salaId: 1, filas: 1, butacasPorFila: 4 },
  precios: { general: 8000, estudiante: 5000 },
  enVenta: true,
  mapa: [
    { butacaId: 1, etiqueta: 'A1', estado: 'libre' },
    { butacaId: 2, etiqueta: 'A2', estado: 'libre' },
    { butacaId: 3, etiqueta: 'A3', estado: 'no-disponible' },
    { butacaId: 4, etiqueta: 'A4', estado: 'libre' },
  ],
}

const BLOQUEO: Bloqueo = {
  sesion: 'sesion-anonima',
  funcionId: 7,
  butacaIds: [1],
  categoria: 'general',
  vence: '2026-08-14T18:05:00',
}

const COMPRA: Compra = { numero: 'ABC234', funcionId: 7, montoTotal: 8000, canal: 'internet' } as Compra

function renderFuncion() {
  return render(
    <MemoryRouter initialEntries={['/funciones/7']}>
      <Routes>
        <Route path="/funciones/:id" element={<Funcion />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.obtenerCartelera.mockResolvedValue([VIERNES, MIERCOLES])
  api.obtenerMapa.mockResolvedValue(MAPA)
  api.bloquearButacas.mockResolvedValue(BLOQUEO)
  api.pagar.mockResolvedValue(COMPRA)
})

describe('Cartelera pública (RF-8)', () => {
  it('lista cada función con su horario y sus precios', async () => {
    render(
      <MemoryRouter>
        <Cartelera />
      </MemoryRouter>,
    )

    const titulos = await screen.findAllByRole('heading', { name: 'La ventana indiscreta' })
    expect(titulos).toHaveLength(2)
    expect(screen.getAllByText(/₡8 000 general/).length).toBeGreaterThan(0)
    // Cada función lleva a su propia pantalla (RF-9).
    const enlaces = screen.getAllByRole('link')
    expect(enlaces.map((e) => e.getAttribute('href'))).toEqual(['/funciones/7', '/funciones/9'])
  })

  it('rotula la función de miércoles a mitad de precio y no ofrece estudiante (RN-13, RN-14)', async () => {
    render(
      <MemoryRouter>
        <Cartelera />
      </MemoryRouter>,
    )

    expect(await screen.findByText('MIÉRCOLES ½ PRECIO')).toBeInTheDocument()
    expect(screen.getByText('₡4 000 general')).toBeInTheDocument()
  })

  it('si la cartelera no carga, lo dice con el mensaje del servidor y no una pantalla vacía', async () => {
    api.obtenerCartelera.mockRejectedValue({ status: 500, mensaje: 'No hay funciones cargadas todavía' })

    render(
      <MemoryRouter>
        <Cartelera />
      </MemoryRouter>,
    )

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('No se pudo cargar')
  })
})

describe('Función: elegir butaca, pagar y recibir el número (RF-9, RF-10, RF-11)', () => {
  it('elige una butaca libre, muestra el total y lleva al formulario de compra', async () => {
    renderFuncion()

    const butaca = await screen.findByRole('button', { name: /Butaca A1, libre/ })
    await userEvent.click(butaca)

    expect(screen.getByText(/1 butaca seleccionada · ₡8 000/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar a compra' }))

    expect(api.bloquearButacas).toHaveBeenCalledWith(7, [1])
    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument()
  })

  it('completado el contacto, muestra el número de compra para dictarlo en la puerta (RN-25)', async () => {
    renderFuncion()
    await userEvent.click(await screen.findByRole('button', { name: /Butaca A1, libre/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continuar a compra' }))

    await userEvent.type(await screen.findByLabelText('Nombre'), 'Ana Solano')
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@correo.com')
    await userEvent.type(screen.getByLabelText('Teléfono'), '8812 4455')
    await userEvent.click(screen.getByRole('button', { name: 'Pagar' }))

    expect(await screen.findByText('ABC234')).toBeInTheDocument()
    expect(screen.getByText(/Mostrá este número en la puerta/)).toBeInTheDocument()
  })

  it('una butaca que otro tomó no se puede elegir (RN-56)', async () => {
    renderFuncion()

    const ocupada = await screen.findByRole('button', { name: /Butaca A3, no disponible/ })
    await userEvent.click(ocupada)

    expect(ocupada).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Continuar a compra' })).not.toBeInTheDocument()
  })

  /**
   * El rechazo tiene que seguir a la vista después de que el sondeo refresque
   * el mapa: es un rechazo del negocio, no un fallo de carga (tabla de errores
   * de `DISENO.md`). Antes se borraba solo al volver el sondeo.
   */
  it('si el bloqueo se rechaza, el mensaje del servidor queda a la vista aunque el mapa se refresque', async () => {
    api.bloquearButacas.mockRejectedValue({ status: 409, mensaje: 'A1 ya no está libre' })
    renderFuncion()

    await userEvent.click(await screen.findByRole('button', { name: /Butaca A1, libre/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continuar a compra' }))

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('A1 ya no está libre')
    await waitFor(() => expect(api.obtenerMapa).toHaveBeenCalledTimes(2))
  })
})
