import { Button, InlineNotification, Select, SelectItem, Tag, TextInput, Tile } from '@carbon/react'
import { useEffect, useState } from 'react'
import {
  buscarComprasPorContacto,
  esErrorDeApi,
  obtenerFuncionesDeLaJornada,
  validarEnPuerta,
  type CompraCompleta,
  type FuncionDeJornada,
} from '../api/cliente.js'
import { SesionOperador } from '../componentes/SesionOperador.js'
import { formatearFecha } from '../utilidades/formato.js'

/**
 * La puerta (T21): se identifica una compra por su número (RN-35), se marcan
 * sus entradas como usadas con hora y operador (RN-36, RF-19) y se rechaza
 * con el motivo exacto cuando no se puede —ya usadas, de otra función,
 * función cancelada, compra anulada— (RF-20, tabla de errores de DISENO.md).
 * Si el número está mal dictado, se busca por nombre o correo antes de
 * rechazar a nadie (RF-18).
 */
function PantallaDePuerta() {
  const [funciones, setFunciones] = useState<FuncionDeJornada[]>([])
  const [funcionId, setFuncionId] = useState<number | null>(null)
  const [numero, setNumero] = useState('')
  const [validada, setValidada] = useState<CompraCompleta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ofrecerBusqueda, setOfrecerBusqueda] = useState(false)
  const [contacto, setContacto] = useState('')
  const [encontradas, setEncontradas] = useState<CompraCompleta[] | null>(null)
  const [validando, setValidando] = useState(false)

  useEffect(() => {
    obtenerFuncionesDeLaJornada()
      .then((lista) => {
        setFunciones(lista)
        setFuncionId((actual) => actual ?? lista[0]?.funcionId ?? null)
      })
      .catch((error: unknown) =>
        setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las funciones de la jornada'),
      )
  }, [])

  async function validar(evento: React.FormEvent) {
    evento.preventDefault()
    if (funcionId === null) return
    setValidando(true)
    setError(null)
    setValidada(null)
    setOfrecerBusqueda(false)
    try {
      setValidada(await validarEnPuerta(funcionId, numero.trim().toUpperCase()))
      setNumero('')
      setEncontradas(null)
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos validar esa compra')
      // Solo cuando el número no existe tiene sentido ofrecer la búsqueda
      // alternativa: en los demás rechazos el número sí es de alguien.
      setOfrecerBusqueda(esErrorDeApi(error) && error.error === 'CompraInexistente')
    } finally {
      setValidando(false)
    }
  }

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    try {
      setEncontradas(await buscarComprasPorContacto(contacto.trim()))
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos buscar')
    }
  }

  const funcionElegida = funciones.find((funcion) => funcion.funcionId === funcionId)

  return (
    <div style={{ maxWidth: '40rem' }}>
      <Select
        id="funcion-de-puerta"
        labelText="Función que se está recibiendo"
        helperText="Las de esta jornada: la de las 23:00 sigue siendo de hoy hasta las 06:00 (RN-10)."
        value={funcionId ?? ''}
        onChange={(evento) => setFuncionId(Number(evento.target.value))}
      >
        {funciones.length === 0 ? <SelectItem value="" text="No hay funciones en esta jornada" /> : null}
        {funciones.map((funcion) => (
          <SelectItem
            key={funcion.funcionId}
            value={funcion.funcionId}
            text={`${funcion.horaInicio} · ${funcion.pelicula} · ${funcion.sala}${funcion.cancelada ? ' (cancelada)' : ''}`}
          />
        ))}
      </Select>

      {funcionElegida?.cancelada ? (
        <div style={{ marginTop: '1rem' }}>
          <InlineNotification
            kind="warning"
            title="Esta función se canceló"
            subtitle="Sus compras quedaron devueltas; ninguna entrada se puede validar (RN-41)."
            hideCloseButton
            lowContrast
          />
        </div>
      ) : null}

      <form onSubmit={validar} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', marginTop: '1.5rem' }}>
        <TextInput
          id="numero-en-puerta"
          labelText="Número de compra"
          helperText="Seis caracteres, como lo dicta quien llega."
          autoComplete="off"
          autoFocus
          value={numero}
          onChange={(evento) => setNumero(evento.target.value)}
        />
        <Button type="submit" disabled={validando || numero.trim() === '' || funcionId === null}>
          {validando ? 'Validando…' : 'Validar'}
        </Button>
      </form>

      {error !== null ? (
        <div role="alert" aria-live="assertive" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="error" title="No se validó" subtitle={error} hideCloseButton />
        </div>
      ) : null}

      {validada !== null ? (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification
            kind="success"
            title={`Puede pasar · ${validada.entradas.length} entrada${validada.entradas.length > 1 ? 's' : ''}`}
            subtitle={`Compra ${validada.numero}. Butacas marcadas como usadas.`}
            hideCloseButton
          />
        </div>
      ) : null}

      {ofrecerBusqueda ? (
        <Tile style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Buscar por nombre o correo</h2>
          <p style={{ marginBottom: '0.75rem' }}>
            Antes de rechazar a alguien, buscá su compra por el nombre o el correo con que la hizo (RF-18).
          </p>
          <form onSubmit={buscar} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem' }}>
            <TextInput
              id="contacto-en-puerta"
              labelText="Nombre o correo"
              autoComplete="off"
              value={contacto}
              onChange={(evento) => setContacto(evento.target.value)}
            />
            <Button type="submit" kind="tertiary" disabled={contacto.trim() === ''}>
              Buscar
            </Button>
          </form>

          {encontradas !== null ? (
            encontradas.length === 0 ? (
              <p style={{ marginTop: '1rem' }}>No hay ninguna compra a ese nombre ni a ese correo.</p>
            ) : (
              <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
                {encontradas.map((compra) => (
                  <li key={compra.numero} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Button kind="ghost" size="sm" onClick={() => setNumero(compra.numero)}>
                      {compra.numero}
                    </Button>
                    <span>
                      {compra.entradas.length} entrada{compra.entradas.length > 1 ? 's' : ''}
                    </span>
                    <Tag type={compra.estado === 'pagada' ? 'green' : 'red'}>{compra.estado}</Tag>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Tile>
      ) : null}

      {funcionElegida !== undefined ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--cds-text-secondary)' }}>
          {formatearFecha(funcionElegida.fecha)} · {funcionElegida.sala}
        </p>
      ) : null}
    </div>
  )
}

export function Puerta() {
  return <SesionOperador titulo="Puerta">{() => <PantallaDePuerta />}</SesionOperador>
}
