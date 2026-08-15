/**
 * Superficies y avisos del sistema propio: tarjetas, etiquetas de estado,
 * avisos, indicador de espera y el diálogo modal.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import './base.scss'

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

type TonoAviso = 'error' | 'exito' | 'informacion' | 'advertencia'

interface AvisoProps {
  tono: TonoAviso
  titulo: string
  detalle?: string
  children?: ReactNode
}

/**
 * Un aviso al pie de una operación. Lleva `role="alert"` cuando informa un
 * fallo, para que un lector de pantalla lo anuncie sin que haya que ir a
 * buscarlo (prioridad 1). El tono nunca es la única señal: el título dice
 * siempre qué pasó.
 */
export function Aviso({ tono, titulo, detalle, children }: AvisoProps) {
  return (
    <div className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <p className="aviso__titulo">{titulo}</p>
      {detalle !== undefined ? <p className="aviso__detalle">{detalle}</p> : null}
      {children}
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

type TonoEtiqueta = 'neutra' | 'exito' | 'alerta' | 'aviso'

interface EtiquetaProps {
  tono?: TonoEtiqueta
  children: ReactNode
}

/** Estado de una fila —pagada, anulada, cancelada— en una palabra. */
export function Etiqueta({ tono = 'neutra', children }: EtiquetaProps) {
  return <span className={`etiqueta etiqueta--${tono}`}>{children}</span>
}

interface ModalProps {
  titulo: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  acciones?: ReactNode
}

/**
 * Diálogo modal sobre el `<dialog>` nativo: trae gratis el foco atrapado
 * dentro, el cierre con `Esc` y el fondo inerte, que en una implementación a
 * mano son justo las tres cosas que suelen quedar mal (prioridad 1).
 */
export function Modal({ titulo, abierto, onCerrar, children, acciones }: ModalProps) {
  const referencia = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = referencia.current
    if (dialogo === null) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog ref={referencia} className="modal" onCancel={onCerrar} onClose={onCerrar} aria-label={titulo}>
      <div className="modal__caja">
        <h2 className="modal__titulo">{titulo}</h2>
        <div className="modal__cuerpo">{children}</div>
        {acciones !== undefined ? <div className="modal__acciones">{acciones}</div> : null}
      </div>
    </dialog>
  )
}
