import { Button, InlineNotification, Loading, TextInput } from '@carbon/react'
import { useEffect, useState, type ReactNode } from 'react'
import { cerrarSesion, esErrorDeApi, identificarse, type Operador } from '../api/cliente.js'

interface SesionOperadorProps {
  titulo: string
  children: (operador: Operador) => ReactNode
}

/**
 * La puerta de entrada de toda pantalla interna (RF-32): nadie vende, valida,
 * anula ni entrega una devolución sin identificarse con su PIN corto y propio
 * (decisión de DISENO.md). El permiso por puesto no se decide acá —lo
 * responde el servidor con `puede` de Operadores (RN-54, RF-33)—; esta pieza
 * solo consigue el operador y lo deja a la vista, porque en la ventanilla
 * cambia de persona en segundos.
 */
export function SesionOperador({ titulo, children }: SesionOperadorProps) {
  const [operador, setOperador] = useState<Operador | null>(null)
  const [cargando, setCargando] = useState(true)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Al recargar, la cookie firmada de la sesión sigue viva: se pregunta quién
  // está operando en vez de volver a pedir el PIN.
  useEffect(() => {
    fetch('/api/operadores/sesion', { credentials: 'include' })
      .then((respuesta) => (respuesta.ok ? (respuesta.json() as Promise<Operador>) : null))
      .then(setOperador)
      .catch(() => setOperador(null))
      .finally(() => setCargando(false))
  }, [])

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      setOperador(await identificarse(pin))
      setPin('')
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos identificarte')
    } finally {
      setEnviando(false)
    }
  }

  async function salir() {
    await cerrarSesion()
    setOperador(null)
  }

  if (cargando) return <Loading description="Abriendo la pantalla…" withOverlay={false} />

  if (operador === null) {
    return (
      <form onSubmit={entrar} style={{ maxWidth: '20rem' }}>
        <h1>{titulo}</h1>
        <p style={{ marginBottom: '1rem' }}>Identificate con tu PIN para operar.</p>
        <TextInput
          id="pin-operador"
          name="pin"
          type="password"
          labelText="PIN"
          helperText="El PIN corto que te dio la dueña."
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          invalid={error !== null}
          invalidText={error ?? ''}
          onChange={(evento) => setPin(evento.target.value)}
        />
        <Button type="submit" disabled={enviando || pin.trim() === ''} style={{ marginTop: '1rem' }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
        {error !== null ? (
          <div role="alert" aria-live="polite" style={{ marginTop: '1rem' }}>
            <InlineNotification kind="error" title="No se pudo entrar" subtitle={error} hideCloseButton lowContrast />
          </div>
        ) : null}
      </form>
    )
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ margin: 0 }}>{titulo}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>
            {operador.nombre} · {operador.puesto}
          </span>
          <Button kind="ghost" size="sm" onClick={salir}>
            Cerrar sesión
          </Button>
        </div>
      </div>
      {children(operador)}
    </>
  )
}
