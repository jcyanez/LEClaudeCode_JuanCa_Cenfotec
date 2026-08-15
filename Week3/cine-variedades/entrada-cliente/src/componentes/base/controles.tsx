/**
 * Controles de formulario del sistema propio. Todos comparten tres cosas que
 * no son negociables (`CLAUDE.md` §8, prioridades 1, 2 y 8 de la skill):
 * etiqueta visible —nunca un placeholder haciendo de etiqueta—, objetivo
 * táctil de 44×44 px, y foco visible con el mismo anillo en todos.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import './base.scss'

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro'

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

/** Lo que comparten todos los campos: etiqueta, ayuda y error junto al campo. */
interface CampoBase {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
}

function idsDescriptores({ id, ayuda, error }: CampoBase) {
  const idAyuda = ayuda !== undefined ? `${id}-ayuda` : undefined
  const idError = error !== undefined ? `${id}-error` : undefined
  return { idAyuda, idError, descrito: [idAyuda, idError].filter(Boolean).join(' ') || undefined }
}

function Envoltura({ campo, children }: { campo: CampoBase; children: ReactNode }) {
  const { idAyuda, idError } = idsDescriptores(campo)
  return (
    <div className={['campo', campo.error !== undefined ? 'campo--con-error' : ''].filter(Boolean).join(' ')}>
      <label className="campo__etiqueta" htmlFor={campo.id}>
        {campo.etiqueta}
      </label>
      {children}
      {campo.ayuda !== undefined ? (
        <span className="campo__ayuda" id={idAyuda}>
          {campo.ayuda}
        </span>
      ) : null}
      {campo.error !== undefined ? (
        <span className="campo__error" id={idError}>
          {campo.error}
        </span>
      ) : null}
    </div>
  )
}

interface CampoDeTextoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, CampoBase {}

export function CampoDeTexto({ id, etiqueta, ayuda, error, className, ...resto }: CampoDeTextoProps) {
  const { descrito } = idsDescriptores({ id, etiqueta, ayuda, error })
  return (
    <Envoltura campo={{ id, etiqueta, ayuda, error }}>
      <input
        id={id}
        className={['campo__control', className].filter(Boolean).join(' ')}
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        {...resto}
      />
    </Envoltura>
  )
}

interface AreaDeTextoProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>, CampoBase {}

export function AreaDeTexto({ id, etiqueta, ayuda, error, ...resto }: AreaDeTextoProps) {
  const { descrito } = idsDescriptores({ id, etiqueta, ayuda, error })
  return (
    <Envoltura campo={{ id, etiqueta, ayuda, error }}>
      <textarea
        id={id}
        className="campo__control campo__control--area"
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        rows={3}
        {...resto}
      />
    </Envoltura>
  )
}

interface CampoNumericoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>, CampoBase {}

/**
 * Número con teclado numérico en el teléfono (`inputmode`, guía «Mobile
 * Keyboards» de la skill) y cifras tabulares, para que una columna de montos
 * alinee dígito con dígito.
 */
export function CampoNumerico({ id, etiqueta, ayuda, error, ...resto }: CampoNumericoProps) {
  const { descrito } = idsDescriptores({ id, etiqueta, ayuda, error })
  return (
    <Envoltura campo={{ id, etiqueta, ayuda, error }}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="campo__control campo__control--numero"
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        {...resto}
      />
    </Envoltura>
  )
}

interface CampoDeFechaProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>, CampoBase {}

/**
 * Fecha con el selector nativo del sistema: el del teléfono y el del navegador
 * ya son accesibles y conocidos, y pesan cero. Reemplaza al `DatePicker` de
 * Carbon, que traía su propia librería de calendario.
 */
export function CampoDeFecha({ id, etiqueta, ayuda, error, ...resto }: CampoDeFechaProps) {
  const { descrito } = idsDescriptores({ id, etiqueta, ayuda, error })
  return (
    <Envoltura campo={{ id, etiqueta, ayuda, error }}>
      <input
        id={id}
        type="date"
        className="campo__control"
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        {...resto}
      />
    </Envoltura>
  )
}

interface SelectorProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>, CampoBase {
  children: ReactNode
}

/** `select` nativo: abre la rueda del sistema en el teléfono y se opera con teclado sin código extra. */
export function Selector({ id, etiqueta, ayuda, error, children, ...resto }: SelectorProps) {
  const { descrito } = idsDescriptores({ id, etiqueta, ayuda, error })
  return (
    <Envoltura campo={{ id, etiqueta, ayuda, error }}>
      <select
        id={id}
        className="campo__control campo__control--selector"
        aria-describedby={descrito}
        aria-invalid={error !== undefined ? true : undefined}
        {...resto}
      >
        {children}
      </select>
    </Envoltura>
  )
}
