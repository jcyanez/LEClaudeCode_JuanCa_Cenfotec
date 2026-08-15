/**
 * Los dos filtros de la cartelera: el día y la sala.
 *
 * Son los dos únicos que el sistema puede sostener con datos reales. El encargo
 * pedía además formato (2D, 3D, doblada, subtitulada) y cine: ninguno existe
 * —una función es película, sala, fecha y hora (`RN-5`), y «más de un cine»
 * está en *Fuera de alcance*—, así que no se dibujan controles que no filtran
 * nada.
 *
 * El día va como grupo de botones y no como lista desplegable: son pocos, se
 * eligen de un toque y conviene verlos todos a la vez. La sala sí va como
 * selector, porque es un filtro secundario que casi nadie toca.
 */
import { Selector } from '../base/index.js'
import { etiquetaDeDia } from './agrupar.js'
import './cartelera.scss'

interface SelectorDeFechaProps {
  fechas: string[]
  elegida: string
  onElegir: (fecha: string) => void
  hoy: string
}

export function SelectorDeFecha({ fechas, elegida, onElegir, hoy }: SelectorDeFechaProps) {
  return (
    <div className="dias" role="group" aria-label="Elegí el día">
      {fechas.map((fecha) => {
        const etiqueta = etiquetaDeDia(fecha, hoy)
        const activo = fecha === elegida
        return (
          <button
            key={fecha}
            type="button"
            className={activo ? 'dia dia--activo' : 'dia'}
            /* El estado seleccionado no se transmite solo con el color: se
               anuncia (prioridad 1 de la skill), y además cambia el peso de la
               letra y el borde, para quien no distingue el dorado del gris. */
            aria-pressed={activo}
            aria-label={etiqueta.accesible}
            onClick={() => onElegir(fecha)}
          >
            <span className="dia__principal">{etiqueta.principal}</span>
            <span className="dia__secundaria">{etiqueta.secundaria}</span>
          </button>
        )
      })}
    </div>
  )
}

interface FiltroDeSalaProps {
  salas: string[]
  elegida: string
  onElegir: (sala: string) => void
}

export const TODAS_LAS_SALAS = 'todas'

export function FiltroDeSala({ salas, elegida, onElegir }: FiltroDeSalaProps) {
  return (
    <div className="filtro-sala">
      <Selector
        id="filtro-sala"
        etiqueta="Sala"
        value={elegida}
        onChange={(evento) => onElegir(evento.target.value)}
      >
        <option value={TODAS_LAS_SALAS}>Todas las salas</option>
        {salas.map((sala) => (
          <option key={sala} value={sala}>
            {sala}
          </option>
        ))}
      </Selector>
    </div>
  )
}
