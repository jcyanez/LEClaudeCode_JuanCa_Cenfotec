import { Pestanas } from '../componentes/base/index.js'
import { CarteleraDeLaDuena } from '../componentes/administracion/CarteleraDeLaDuena.js'
import { Consultas } from '../componentes/administracion/Consultas.js'
import { PreciosYDistribuidor } from '../componentes/administracion/PreciosYDistribuidor.js'
import { ReporteMensual } from '../componentes/administracion/ReporteMensual.js'
import { SesionOperador } from '../componentes/SesionOperador.js'

/**
 * Las pantallas de la dueña (T21): cargar la cartelera y cancelar funciones
 * (RF-1 a RF-5, RF-23), fijar precios y mantener el correo del distribuidor
 * (RF-6, RF-29), ver el reporte del mes y reenviarlo (RF-27, RF-28) y las dos
 * consultas del negocio (RF-30, RF-31). Cada pestaña exige el permiso que le
 * corresponde: el servidor responde 403 a quien no lo tenga (RF-33).
 */
export function Administracion() {
  return (
    <SesionOperador titulo="Administración">
      {() => (
        <Pestanas
          etiqueta="Pantallas de la dueña"
          pestanas={[
            { id: 'cartelera', titulo: 'Cartelera', contenido: <CarteleraDeLaDuena /> },
            { id: 'precios', titulo: 'Precios y distribuidor', contenido: <PreciosYDistribuidor /> },
            { id: 'reporte', titulo: 'Reporte mensual', contenido: <ReporteMensual /> },
            { id: 'consultas', titulo: 'Consultas', contenido: <Consultas /> },
          ]}
        />
      )}
    </SesionOperador>
  )
}
