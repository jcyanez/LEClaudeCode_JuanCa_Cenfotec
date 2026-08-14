import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react'
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
        <Tabs>
          <TabList aria-label="Trabajos de taquilla" contained>
            <Tab>Vender</Tab>
            <Tab>Reservas</Tab>
            <Tab>Compras</Tab>
            <Tab>Cierre de caja</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <VentaEnTaquilla />
            </TabPanel>
            <TabPanel>
              <ConversionDeReserva />
            </TabPanel>
            <TabPanel>
              <CompraEnTaquilla />
            </TabPanel>
            <TabPanel>
              <CierreDeCaja />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </SesionOperador>
  )
}
