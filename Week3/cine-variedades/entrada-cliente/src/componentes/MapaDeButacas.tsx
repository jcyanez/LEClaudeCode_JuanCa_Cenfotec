import { useMemo } from 'react'
import './MapaDeButacas.scss'

/**
 * Los estados que puede pintar el mapa: los dos del canal público (RN-56) y
 * los cuatro de taquilla (RN-57). Cada pantalla le pasa solo los suyos; este
 * componente no decide ningún recorte, eso ya lo hizo el servidor.
 */
export type EstadoDeButaca = 'libre' | 'no-disponible' | 'bloqueada' | 'reservada' | 'vendida'

export interface ButacaDibujable {
  butacaId: number
  etiqueta: string
  estado: EstadoDeButaca
  /** Número de la reserva o compra que la tiene, cuando la pantalla lo conoce (taquilla). */
  numero?: string | null
}

interface MapaDeButacasProps {
  butacas: ButacaDibujable[]
  butacasPorFila: number
  seleccionadas: ReadonlySet<number>
  onCambiarSeleccion: (butacaId: number) => void
  /** En taquilla, consultar una butaca ocupada sin poder elegirla (RN-57). */
  onConsultarOcupada?: (butaca: ButacaDibujable) => void
}

interface FilaDeButacas {
  fila: string
  butacas: ButacaDibujable[]
}

const NOMBRE_DE_ESTADO: Record<EstadoDeButaca, string> = {
  libre: 'libre',
  'no-disponible': 'no disponible',
  bloqueada: 'bloqueada',
  reservada: 'reservada',
  vendida: 'vendida',
}

function agruparPorFila(butacas: ButacaDibujable[]): FilaDeButacas[] {
  const filas = new Map<string, ButacaDibujable[]>()
  for (const butaca of butacas) {
    const letra = butaca.etiqueta[0] ?? '?'
    const grupo = filas.get(letra) ?? []
    grupo.push(butaca)
    filas.set(letra, grupo)
  }
  return [...filas.entries()].map(([fila, butacas]) => ({ fila, butacas }))
}

/** Qué estados aparecen de verdad en este mapa: la leyenda no inventa ninguno. */
function estadosPresentes(butacas: ButacaDibujable[]): EstadoDeButaca[] {
  const orden: EstadoDeButaca[] = ['libre', 'no-disponible', 'bloqueada', 'reservada', 'vendida']
  const presentes = new Set(butacas.map((butaca) => butaca.estado))
  return orden.filter((estado) => presentes.has(estado))
}

/**
 * El mapa de butacas (RF-9), compartido por la web pública (T19) y por
 * taquilla (T20). Cada butaca es un botón real de al menos 44×44px
 * (prioridad 2 de ui-ux-pro-max, obligatoria por CLAUDE.md §8): el pasillo
 * se muestra como un hueco, nunca a costa del tamaño de una butaca — si la
 * fila no entra en la pantalla, este contenedor se desplaza de lado
 * (decisión de T19, la única que no compromete el objetivo táctil mínimo en
 * Sala 1, de 12 butacas por fila).
 *
 * Cada estado se distingue por relleno **y** por trazo —lleno, rayado,
 * punteado, discontinuo—, nunca solo por color (`color-not-only`, prioridad
 * 1 de la skill), y se nombra en el `aria-label` de cada butaca.
 */
export function MapaDeButacas({
  butacas,
  butacasPorFila,
  seleccionadas,
  onCambiarSeleccion,
  onConsultarOcupada,
}: MapaDeButacasProps) {
  const filas = useMemo(() => agruparPorFila(butacas), [butacas])
  const leyenda = useMemo(() => estadosPresentes(butacas), [butacas])
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
              const libre = butaca.estado === 'libre'
              const consultable = !libre && onConsultarOcupada !== undefined
              const descripcion = seleccionada ? 'seleccionada' : NOMBRE_DE_ESTADO[butaca.estado]
              return (
                <button
                  key={butaca.butacaId}
                  type="button"
                  className={[
                    'mapa-butacas__butaca',
                    `mapa-butacas__butaca--${butaca.estado}`,
                    seleccionada ? 'mapa-butacas__butaca--seleccionada' : '',
                    indice + 1 === columnaPasillo ? 'mapa-butacas__butaca--antes-del-pasillo' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  // Una butaca ocupada de taquilla queda alcanzable con el
                  // teclado para poder consultarla, marcada como no elegible
                  // (`aria-disabled`) en vez de sacada del recorrido.
                  disabled={!libre && !consultable}
                  aria-disabled={!libre}
                  aria-pressed={libre ? seleccionada : undefined}
                  aria-label={
                    `Butaca ${butaca.etiqueta}, ${descripcion}` +
                    (butaca.numero != null ? `, número ${butaca.numero}` : '')
                  }
                  onClick={() => {
                    if (libre) onCambiarSeleccion(butaca.butacaId)
                    else onConsultarOcupada?.(butaca)
                  }}
                >
                  {butaca.etiqueta}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <ul className="mapa-butacas__leyenda">
        {seleccionadas.size > 0 || leyenda.includes('libre') ? (
          <li>
            <span className="mapa-butacas__marca mapa-butacas__marca--seleccionada" aria-hidden="true" /> Seleccionada
          </li>
        ) : null}
        {leyenda.map((estado) => (
          <li key={estado}>
            <span className={`mapa-butacas__marca mapa-butacas__marca--${estado}`} aria-hidden="true" />{' '}
            {NOMBRE_DE_ESTADO[estado][0]?.toUpperCase()}
            {NOMBRE_DE_ESTADO[estado].slice(1)}
          </li>
        ))}
      </ul>
    </div>
  )
}
