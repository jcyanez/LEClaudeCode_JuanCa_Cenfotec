import { useEffect, useState, type ReactNode } from 'react'
import { cerrarSesion, esErrorDeApi, identificarse, type Operador } from '../api/cliente.js'
import { Boton, CampoDeTexto, Cargando, Tarjeta } from './base/index.js'
import './SesionOperador.scss'

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

  if (cargando) return <Cargando descripcion="Abriendo la pantalla…" />

  if (operador === null) {
    return (
      <div className="acceso">
        <Tarjeta className="acceso__caja">
          <p className="acceso__marca">Cine Variedades</p>
          <h1 className="acceso__titulo">{titulo}</h1>
          <form onSubmit={entrar} className="acceso__formulario">
            <CampoDeTexto
              id="pin-operador"
              name="pin"
              type="password"
              etiqueta="PIN"
              ayuda="El PIN corto que te dio la dueña."
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              error={error ?? undefined}
              onChange={(evento) => setPin(evento.target.value)}
            />
            <Boton type="submit" disabled={enviando || pin.trim() === ''}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </Boton>
          </form>
        </Tarjeta>
      </div>
    )
  }

  return (
    <>
      <header className="barra">
        <div className="barra__identidad">
          <p className="barra__marca">Cine Variedades</p>
          <h1 className="barra__titulo">{titulo}</h1>
        </div>
        <div className="barra__operador">
          <span className="barra__quien">
            {operador.nombre}
            <span className="barra__puesto">{operador.puesto}</span>
          </span>
          <Boton variante="fantasma" onClick={salir}>
            Cerrar sesión
          </Boton>
        </div>
      </header>
      {children(operador)}
    </>
  )
}
