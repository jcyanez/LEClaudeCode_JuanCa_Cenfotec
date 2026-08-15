/**
 * Los componentes base propios de la web pública: lo mínimo que hacía falta
 * para dejar de depender de `@carbon/react` en las pantallas del comprador
 * (etapa 1 del cambio de sistema visual). Cada uno se pinta solo con los
 * tokens de `tokens.scss`, así que sirve igual en el tema del comprador y en
 * el de operación.
 *
 * Son deliberadamente pocos y pequeños: esto no es una librería de
 * componentes, es el conjunto exacto que estas tres pantallas usan.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import './base.scss'

type VarianteBoton = 'primario' | 'secundario' | 'fantasma'

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  children: ReactNode
}

export function Boton({ variante = 'primario', children, className, type = 'button', ...resto }: BotonProps) {
  return (
    <button type={type} className={['boton', `boton--${variante}`, className].filter(Boolean).join(' ')} {...resto}>
      {children}
    </button>
  )
}

interface CampoDeTextoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
}

/**
 * Campo con su etiqueta siempre visible (prioridad 8 de la skill: nunca un
 * placeholder haciendo de etiqueta) y con la ayuda y el error junto al campo,
 * anunciados por `aria-describedby`.
 */
export function CampoDeTexto({ id, etiqueta, ayuda, error, ...resto }: CampoDeTextoProps) {
  const idAyuda = ayuda !== undefined ? `${id}-ayuda` : undefined
  const idError = error !== undefined ? `${id}-error` : undefined
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined

  return (
    <div className={['campo', error !== undefined ? 'campo--con-error' : ''].filter(Boolean).join(' ')}>
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        className="campo__control"
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        {...resto}
      />
      {ayuda !== undefined ? (
        <span className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </span>
      ) : null}
      {error !== undefined ? (
        <span className="campo__error" id={idError}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

interface TarjetaProps {
  children: ReactNode
  className?: string
}

export function Tarjeta({ children, className }: TarjetaProps) {
  return <div className={['tarjeta', className].filter(Boolean).join(' ')}>{children}</div>
}

interface TarjetaEnlaceProps extends TarjetaProps {
  href: string
}

export function TarjetaEnlace({ href, children, className }: TarjetaEnlaceProps) {
  return (
    <a href={href} className={['tarjeta', 'tarjeta--enlace', className].filter(Boolean).join(' ')}>
      {children}
    </a>
  )
}

type TonoAviso = 'error' | 'exito' | 'informacion'

interface AvisoProps {
  tono: TonoAviso
  titulo: string
  detalle?: string
}

/**
 * Un aviso al pie de una operación. Lleva `role="alert"` cuando informa un
 * fallo, para que un lector de pantalla lo anuncie sin que haya que ir a
 * buscarlo (prioridad 1). El tono nunca es la única señal: el título dice
 * siempre qué pasó.
 */
export function Aviso({ tono, titulo, detalle }: AvisoProps) {
  return (
    <div className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <p className="aviso__titulo">{titulo}</p>
      {detalle !== undefined ? <p className="aviso__detalle">{detalle}</p> : null}
    </div>
  )
}

interface CargandoProps {
  descripcion: string
}

/** Prioridad 2: toda espera se ve; nunca una pantalla quieta sin explicación. */
export function Cargando({ descripcion }: CargandoProps) {
  return (
    <p className="cargando" role="status">
      <span className="cargando__marca" aria-hidden="true" />
      {descripcion}
    </p>
  )
}
