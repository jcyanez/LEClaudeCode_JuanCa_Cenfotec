import { useState, type FormEvent } from 'react'
import type { Contacto } from '../api/cliente.js'
import { Boton, CampoDeTexto, Tarjeta } from './base/index.js'

interface FormularioContactoProps {
  titulo: string
  enviando: boolean
  textoConfirmar?: string
  onCancelar: () => void
  onConfirmar: (contacto: Contacto) => void
}

/** Nombre, correo y teléfono de quien compra o reserva por internet (RN-23). */
export function FormularioContacto({
  titulo,
  enviando,
  textoConfirmar = 'Confirmar',
  onCancelar,
  onConfirmar,
}: FormularioContactoProps) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    onConfirmar({ nombre: nombre.trim(), correo: correo.trim(), telefono: telefono.trim() })
  }

  const listo = nombre.trim() !== '' && correo.trim() !== '' && telefono.trim() !== ''

  return (
    <Tarjeta>
      <form onSubmit={alEnviar} className="formulario-contacto">
        <h3 className="formulario-contacto__titulo">{titulo}</h3>
        <CampoDeTexto
          id="contacto-nombre"
          etiqueta="Nombre"
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          disabled={enviando}
          autoComplete="name"
        />
        <CampoDeTexto
          id="contacto-correo"
          etiqueta="Correo"
          type="email"
          ayuda="Ahí te llega el número de compra"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
          disabled={enviando}
          autoComplete="email"
        />
        <CampoDeTexto
          id="contacto-telefono"
          etiqueta="Teléfono"
          type="tel"
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          disabled={enviando}
          autoComplete="tel"
        />
        <div className="formulario-contacto__acciones">
          <Boton type="submit" disabled={!listo || enviando}>
            {enviando ? 'Un momento…' : textoConfirmar}
          </Boton>
          <Boton variante="secundario" disabled={enviando} onClick={onCancelar}>
            Cancelar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}
