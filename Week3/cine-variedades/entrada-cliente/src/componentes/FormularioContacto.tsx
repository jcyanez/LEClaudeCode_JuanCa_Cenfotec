import { Button, Stack, TextInput, Tile } from '@carbon/react'
import { useState, type FormEvent } from 'react'
import type { Contacto } from '../api/cliente.js'

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
    <Tile>
      <form onSubmit={alEnviar}>
        <Stack gap={5}>
          <h3>{titulo}</h3>
          <TextInput
            id="contacto-nombre"
            labelText="Nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            disabled={enviando}
          />
          <TextInput
            id="contacto-correo"
            type="email"
            labelText="Correo"
            helperText="Ahí te llega el número de compra"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            disabled={enviando}
          />
          <TextInput
            id="contacto-telefono"
            type="tel"
            labelText="Teléfono"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            disabled={enviando}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button type="submit" disabled={!listo || enviando}>
              {enviando ? 'Un momento…' : textoConfirmar}
            </Button>
            <Button kind="secondary" type="button" disabled={enviando} onClick={onCancelar}>
              Cancelar
            </Button>
          </div>
        </Stack>
      </form>
    </Tile>
  )
}
