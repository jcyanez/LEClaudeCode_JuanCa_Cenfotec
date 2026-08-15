import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MapaDeButacas, type ButacaDibujable } from './MapaDeButacas.js'

function butacasDeUnaFila(estados: ButacaDibujable['estado'][]): ButacaDibujable[] {
  return estados.map((estado, indice) => ({
    butacaId: indice + 1,
    etiqueta: `A${indice + 1}`,
    estado,
    numero: estado === 'reservada' || estado === 'vendida' ? 'ABC123' : null,
  }))
}

describe('MapaDeButacas: el mapa público solo distingue libre y no disponible (RN-56, CA-9)', () => {
  it('una butaca no disponible se anuncia como tal y no se puede elegir', async () => {
    const alElegir = vi.fn()
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(['libre', 'no-disponible'])}
        butacasPorFila={2}
        seleccionadas={new Set()}
        onCambiarSeleccion={alElegir}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Butaca A2, no disponible/ }))

    expect(alElegir).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Butaca A2/ })).toBeDisabled()
  })

  it('elegir una butaca libre la marca como seleccionada para quien usa lector de pantalla', async () => {
    const alElegir = vi.fn()
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(['libre'])}
        butacasPorFila={1}
        seleccionadas={new Set([1])}
        onCambiarSeleccion={alElegir}
      />,
    )

    const butaca = screen.getByRole('button', { name: /Butaca A1, seleccionada/ })
    await userEvent.click(butaca)

    expect(alElegir).toHaveBeenCalledWith(1)
    expect(butaca).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('MapaDeButacas: el mapa de taquilla distingue los cuatro estados (RN-57, CA-9)', () => {
  it('nombra bloqueada, reservada y vendida por separado, no todas como «no disponible»', () => {
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(['libre', 'bloqueada', 'reservada', 'vendida'])}
        butacasPorFila={4}
        seleccionadas={new Set()}
        onCambiarSeleccion={vi.fn()}
        onConsultarOcupada={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Butaca A2, bloqueada/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Butaca A3, reservada/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Butaca A4, vendida/ })).toBeInTheDocument()
  })

  it('una butaca ocupada de taquilla se puede consultar con el teclado y lleva su número', async () => {
    const alConsultar = vi.fn()
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(['libre', 'reservada'])}
        butacasPorFila={2}
        seleccionadas={new Set()}
        onCambiarSeleccion={vi.fn()}
        onConsultarOcupada={alConsultar}
      />,
    )

    const reservada = screen.getByRole('button', { name: /Butaca A2, reservada, número ABC123/ })
    expect(reservada).toHaveAttribute('aria-disabled', 'true')
    expect(reservada).not.toBeDisabled()

    await userEvent.click(reservada)

    expect(alConsultar).toHaveBeenCalledWith(expect.objectContaining({ etiqueta: 'A2', numero: 'ABC123' }))
  })

  it('la leyenda nombra cada estado presente: el color nunca es la única señal', () => {
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(['libre', 'bloqueada', 'reservada', 'vendida'])}
        butacasPorFila={4}
        seleccionadas={new Set()}
        onCambiarSeleccion={vi.fn()}
      />,
    )

    for (const estado of ['Libre', 'Bloqueada', 'Reservada', 'Vendida']) {
      expect(screen.getByText(estado)).toBeInTheDocument()
    }
  })
})

describe('MapaDeButacas: CA-10 — la fila de Sala 1 y su pasillo (RN-1, RN-2, RF-9)', () => {
  it('dibuja las doce butacas de la fila, de la A1 a la A12', () => {
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(Array.from({ length: 12 }, () => 'libre'))}
        butacasPorFila={12}
        seleccionadas={new Set()}
        onCambiarSeleccion={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: /^Butaca A/ })).toHaveLength(12)
    expect(screen.getByRole('button', { name: /Butaca A1,/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Butaca A12,/ })).toBeInTheDocument()
  })

  it('deja el pasillo entre la 6 y la 7, y en ningún otro lugar de la fila', () => {
    render(
      <MapaDeButacas
        butacas={butacasDeUnaFila(Array.from({ length: 12 }, () => 'libre'))}
        butacasPorFila={12}
        seleccionadas={new Set()}
        onCambiarSeleccion={vi.fn()}
      />,
    )

    // El pasillo es presentación pura —un hueco, no un elemento que se anuncie—,
    // así que lo verificable es dónde cae el corte: después de la sexta butaca.
    const conPasillo = screen
      .getAllByRole('button', { name: /^Butaca A/ })
      .filter((butaca) => butaca.className.includes('mapa-butacas__butaca--antes-del-pasillo'))
    expect(conPasillo).toHaveLength(1)
    expect(conPasillo[0]).toHaveAccessibleName(/Butaca A6,/)
  })
})
