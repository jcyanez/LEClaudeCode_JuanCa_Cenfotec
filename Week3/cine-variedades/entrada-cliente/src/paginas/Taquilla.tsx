import { Pestanas } from '../componentes/base/index.js'
import { CierreDeCaja } from '../componentes/taquilla/CierreDeCaja.js'
import { CompraEnTaquilla } from '../componentes/taquilla/CompraEnTaquilla.js'
import { ConversionDeReserva } from '../componentes/taquilla/ConversionDeReserva.js'
import { VentaEnTaquilla } from '../componentes/taquilla/VentaEnTaquilla.js'
import { SesionOperador } from '../componentes/SesionOperador.js'

/**
 * La pantalla de taquilla (T20). Cuatro trabajos, cada uno en su pestaña, en
 * el orden en que ocurren en la ventanilla: vender (RF-12), convertir una
 * reserva (RF-16, RF-17), arreglar una compra —anular o entregar la
 * devolución— (RF-21, RF-25) y cerrar la jornada (RF-26). Ninguna regla de
 * negocio vive acá: cada acción se la pide al servidor, que se la pide al
 * dominio (DISENO.md).
 */
export function Taquilla() {
  return (
    <SesionOperador titulo="Taquilla">
      {() => (
        <Pestanas
          etiqueta="Trabajos de taquilla"
          pestanas={[
            { id: 'vender', titulo: 'Vender', contenido: <VentaEnTaquilla /> },
            { id: 'reservas', titulo: 'Reservas', contenido: <ConversionDeReserva /> },
            { id: 'compras', titulo: 'Compras', contenido: <CompraEnTaquilla /> },
            { id: 'cierre', titulo: 'Cierre de caja', contenido: <CierreDeCaja /> },
          ]}
        />
      )}
    </SesionOperador>
  )
}
