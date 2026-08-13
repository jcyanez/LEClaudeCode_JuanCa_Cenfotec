import { useMemo } from 'react'
import type { ButacaEnMapa } from '../api/cliente.js'
import './MapaDeButacas.scss'

interface MapaDeButacasProps {
  butacas: ButacaEnMapa[]
  butacasPorFila: number
  seleccionadas: ReadonlySet<number>
  onCambiarSeleccion: (butacaId: number) => void
}

interface FilaDeButacas {
  fila: string
  butacas: ButacaEnMapa[]
}

function agruparPorFila(butacas: ButacaEnMapa[]): FilaDeButacas[] {
  const filas = new Map<string, ButacaEnMapa[]>()
  for (const butaca of butacas) {
    const letra = butaca.etiqueta[0] ?? '?'
    const grupo = filas.get(letra) ?? []
    grupo.push(butaca)
    filas.set(letra, grupo)
  }
  return [...filas.entries()].map(([fila, butacas]) => ({ fila, butacas }))
}

/**
 * El mapa de butacas de la web pública (RF-9, T19): solo distingue libre y
 * no disponible (RN-56, CA-9) — nunca cuál es el motivo real, eso es de
 * taquilla (T20). Cada butaca es un botón real de al menos 44×44px
 * (prioridad 2 de ui-ux-pro-max, obligatoria por CLAUDE.md §8): el pasillo
 * se muestra como un hueco, nunca a costa del tamaño de una butaca — si la
 * fila no entra en la pantalla, este contenedor se desplaza de lado
 * (opción A de DISENO.md, la única que no compromete el objetivo táctil
 * mínimo en Sala 1, de 12 butacas por fila).
 */
export function MapaDeButacas({ butacas, butacasPorFila, seleccionadas, onCambiarSeleccion }: MapaDeButacasProps) {
  const filas = useMemo(() => agruparPorFila(butacas), [butacas])
  const columnaPasillo = Math.floor(butacasPorFila / 2)

  return (
    <div className="mapa-butacas__envoltorio" role="group" aria-label="Mapa de butacas">
      <div className="mapa-butacas__pantalla">PANTALLA</div>
      <div className="mapa-butacas__grilla">
        {filas.map(({ fila, butacas: butacasDeLaFila }) => (
          <div className="mapa-butacas__fila" key={fila}>
            <span className="mapa-butacas__etiqueta-fila" aria-hidden="true">
              {fila}
            </span>
            {butacasDeLaFila.map((butaca, indice) => {
              const seleccionada = seleccionadas.has(butaca.butacaId)
              const disponible = butaca.estado === 'libre'
              return (
                <button
                  key={butaca.butacaId}
                  type="button"
                  className={[
                    'mapa-butacas__butaca',
                    seleccionada ? 'mapa-butacas__butaca--seleccionada' : '',
                    !disponible ? 'mapa-butacas__butaca--no-disponible' : '',
                    indice + 1 === columnaPasillo ? 'mapa-butacas__butaca--antes-del-pasillo' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!disponible}
                  aria-pressed={seleccionada}
                  aria-label={
                    disponible
                      ? `Butaca ${butaca.etiqueta}${seleccionada ? ', seleccionada' : ', libre'}`
                      : `Butaca ${butaca.etiqueta}, no disponible`
                  }
                  onClick={() => onCambiarSeleccion(butaca.butacaId)}
                >
                  {butaca.etiqueta}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <ul className="mapa-butacas__leyenda">
        <li>
          <span className="mapa-butacas__marca mapa-butacas__marca--libre" aria-hidden="true" /> Libre
        </li>
        <li>
          <span className="mapa-butacas__marca mapa-butacas__marca--seleccionada" aria-hidden="true" /> Seleccionada
        </li>
        <li>
          <span className="mapa-butacas__marca mapa-butacas__marca--no-disponible" aria-hidden="true" /> No disponible
        </li>
      </ul>
    </div>
  )
}
