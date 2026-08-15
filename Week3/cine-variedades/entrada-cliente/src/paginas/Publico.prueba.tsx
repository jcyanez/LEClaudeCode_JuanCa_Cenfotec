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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

/**
 * La cartelera se rediseñó: una tarjeta por película con sus horarios, y un
 * día por vez. Antes cada función era su propia tarjeta, así que la misma
 * película aparecía repetida. Estas pruebas cambiaron con esa decisión —era un
 * cambio de estructura, no de estilos— y siguen fijando lo mismo de siempre:
 * qué lee y qué puede hacer la persona, nunca cómo está maquetado.
 */
describe('Cartelera pública (RF-8)', () => {
  /**
   * La cartelera rotula los días respecto de hoy y arranca en el primero que
   * no pasó, así que sin fijar el reloj estas pruebas cambiarían de resultado
   * cada día. Se falsea **solo `Date`**: los temporizadores siguen siendo
   * reales, que es lo que `userEvent` necesita para funcionar.
   */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-14T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderCartelera() {
    return render(
      <MemoryRouter>
        <Cartelera />
      </MemoryRouter>,
    )
  }

  it('encabeza con la función más próxima y ofrece entrar a elegir butacas', async () => {
    renderCartelera()

    // La destacada es la de fecha y hora más tempranas de toda la cartelera.
    const destacada = await screen.findByRole('heading', { level: 1, name: 'La ventana indiscreta' })
    expect(destacada).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Elegir butacas/ })).toHaveAttribute('href', '/funciones/7')
  })

  /**
   * El recorrido de la tarjeta: el cartel se toca, recién ahí aparecen los
   * horarios de esa película, y cada uno lleva a sus butacas. Los horarios
   * arrancan ocultos a propósito, así que lo primero que se comprueba es que
   * no estén.
   */
  it('los horarios aparecen al tocar el cartel, y cada uno lleva a su función (RF-9)', async () => {
    // Dos funciones de la misma película el mismo día: una tarjeta, dos horarios.
    api.obtenerCartelera.mockResolvedValue([VIERNES, { ...VIERNES, funcionId: 8, horaInicio: '21:30' }])
    renderCartelera()

    const tarjetas = await screen.findAllByRole('heading', { level: 3, name: 'La ventana indiscreta' })
    expect(tarjetas).toHaveLength(1)

    // Cerrada: ni horarios ni instrucción.
    expect(screen.queryByRole('link', { name: /19:00/ })).not.toBeInTheDocument()
    const disparador = screen.getByRole('button', { name: 'Ver horarios de La ventana indiscreta' })
    expect(disparador).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(disparador)

    expect(disparador).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Elegí una función')).toBeInTheDocument()
    const horarios = screen.getAllByRole('link', { name: /La ventana indiscreta, \d\d:\d\d, Sala 1/ })
    expect(horarios.map((enlace) => enlace.textContent)).toEqual(['19:00', '21:30'])
    expect(horarios.map((enlace) => enlace.getAttribute('href'))).toEqual(['/funciones/7', '/funciones/8'])
  })

  it('volver a tocar el cartel esconde los horarios', async () => {
    renderCartelera()

    const disparador = await screen.findByRole('button', { name: /Ver horarios de/ })
    await userEvent.click(disparador)
    expect(screen.getByRole('link', { name: /19:00/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ocultar horarios de/ }))
    expect(screen.queryByRole('link', { name: /19:00/ })).not.toBeInTheDocument()
  })

  it('elegir otro día muestra sus funciones y esconde las de los demás', async () => {
    renderCartelera()

    // Arranca en el día de la función más próxima, así que la del miércoles no está.
    await screen.findAllByRole('heading', { level: 3, name: 'La ventana indiscreta' })
    expect(screen.queryByText('MIÉRCOLES ½ PRECIO')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /19 ago/ }))

    // Al cambiar de día aparece la función de miércoles, a mitad de precio y
    // sin categoría estudiante (RN-13, RN-14). Se mira dentro de la tarjeta:
    // el encabezado sigue mostrando la próxima función de toda la cartelera,
    // que es de otro día y sí tiene precio de estudiante.
    const tarjeta = within(await screen.findByRole('article'))
    expect(tarjeta.getByText('MIÉRCOLES ½ PRECIO')).toBeInTheDocument()
    expect(tarjeta.getByText('₡4 000 general')).toBeInTheDocument()
    expect(tarjeta.queryByText(/estudiante/)).not.toBeInTheDocument()
  })

  it('el día elegido queda anunciado, no solo pintado (prioridad 1)', async () => {
    renderCartelera()

    const dia = await screen.findByRole('button', { name: /14 ago/ })
    expect(dia).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /19 ago/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filtrar por una sala sin funciones ese día lo dice, y no deja la pantalla en blanco', async () => {
    api.obtenerCartelera.mockResolvedValue([VIERNES, { ...VIERNES, funcionId: 8, sala: 'Sala 2' }])
    renderCartelera()

    await screen.findAllByRole('heading', { level: 3, name: 'La ventana indiscreta' })
    await userEvent.selectOptions(screen.getByLabelText('Sala'), 'Sala 2')
    await userEvent.click(screen.getByRole('button', { name: /Ver horarios de/ }))

    const horarios = screen.getAllByRole('link', { name: /Sala 2/ })
    expect(horarios).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /Sala 1/ })).not.toBeInTheDocument()
  })

  it('muestra el póster de la película y su género', async () => {
    api.obtenerCartelera.mockResolvedValue([{ ...VIERNES, pelicula: 'Tiempos modernos' }])
    renderCartelera()

    const tarjeta = within(await screen.findByRole('article'))
    const poster = tarjeta.getByRole('img', { name: 'Póster de Tiempos modernos' })
    expect(poster).toHaveAttribute('src', '/cartelera/tiempos-modernos-320.webp')
    // Se carga al acercarse y trae medidas, para que la tarjeta no salte (CLS).
    expect(poster).toHaveAttribute('loading', 'lazy')
    expect(poster).toHaveAttribute('width', '320')
    expect(tarjeta.getByText('Comedia')).toBeInTheDocument()
  })

  /**
   * El póster vive en un mapa por título en la interfaz, así que una película
   * que no esté en ese mapa —una que la dueña cargue mañana— tiene que verse
   * bien igual. Nunca el icono roto del navegador.
   */
  it('una película sin póster muestra el respaldo, no una imagen rota', async () => {
    api.obtenerCartelera.mockResolvedValue([{ ...VIERNES, pelicula: 'Una película sin cartel' }])
    renderCartelera()

    const tarjeta = within(await screen.findByRole('article'))
    expect(tarjeta.getByText('Sin póster')).toBeInTheDocument()
    expect(tarjeta.queryByRole('img')).not.toBeInTheDocument()
    // La función sigue siendo comprable: lo que falta es la imagen, no el dato,
    // y el respaldo sigue siendo el disparador de los horarios.
    await userEvent.click(tarjeta.getByRole('button', { name: /Ver horarios de/ }))
    expect(tarjeta.getByRole('link', { name: /19:00/ })).toHaveAttribute('href', '/funciones/7')
  })

  it('si la cartelera no carga, lo dice con el mensaje del servidor y no una pantalla vacía', async () => {
    api.obtenerCartelera.mockRejectedValue({ status: 500, mensaje: 'No hay funciones cargadas todavía' })

    renderCartelera()

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('No se pudo cargar')
  })

  it('sin funciones cargadas lo dice, en vez de mostrar una cartelera vacía (RN-8)', async () => {
    api.obtenerCartelera.mockResolvedValue([])

    renderCartelera()

    expect(await screen.findByText('No hay funciones en venta por ahora')).toBeInTheDocument()
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
