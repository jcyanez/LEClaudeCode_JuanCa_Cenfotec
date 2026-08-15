/**
 * Pestañas con el patrón ARIA completo, que es lo que había que reponer al
 * dejar las de Carbon: `tablist` / `tab` / `tabpanel`, `aria-selected`, y
 * navegación con las flechas —además de Inicio y Fin— con un solo `tab` en el
 * recorrido de tabulación (prioridad 1 de la skill, «Keyboard Navigation»).
 *
 * Una pestaña mal hecha es una trampa de teclado, y estas pantallas se operan
 * con el teclado: por eso el patrón se implementa entero y no a medias.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import './base.scss'

export interface Pestana {
  id: string
  titulo: string
  contenido: ReactNode
}

interface PestanasProps {
  pestanas: Pestana[]
  etiqueta: string
}

export function Pestanas({ pestanas, etiqueta }: PestanasProps) {
  const [activa, setActiva] = useState(0)
  const base = useId()
  const botones = useRef<Array<HTMLButtonElement | null>>([])

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const ultima = pestanas.length - 1
    let destino: number | null = null
    if (evento.key === 'ArrowRight') destino = activa === ultima ? 0 : activa + 1
    if (evento.key === 'ArrowLeft') destino = activa === 0 ? ultima : activa - 1
    if (evento.key === 'Home') destino = 0
    if (evento.key === 'End') destino = ultima
    if (destino === null) return
    evento.preventDefault()
    setActiva(destino)
    botones.current[destino]?.focus()
  }

  return (
    <div className="pestanas">
      <div className="pestanas__lista" role="tablist" aria-label={etiqueta} onKeyDown={alTeclear}>
        {pestanas.map((pestana, indice) => (
          <button
            key={pestana.id}
            ref={(elemento) => {
              botones.current[indice] = elemento
            }}
            type="button"
            role="tab"
            id={`${base}-${pestana.id}-tab`}
            aria-controls={`${base}-${pestana.id}-panel`}
            aria-selected={indice === activa}
            tabIndex={indice === activa ? 0 : -1}
            className={['pestanas__pestana', indice === activa ? 'pestanas__pestana--activa' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiva(indice)}
          >
            {pestana.titulo}
          </button>
        ))}
      </div>
      {pestanas.map((pestana, indice) => (
        <div
          key={pestana.id}
          role="tabpanel"
          id={`${base}-${pestana.id}-panel`}
          aria-labelledby={`${base}-${pestana.id}-tab`}
          hidden={indice !== activa}
          tabIndex={0}
          className="pestanas__panel"
        >
          {indice === activa ? pestana.contenido : null}
        </div>
      ))}
    </div>
  )
}
