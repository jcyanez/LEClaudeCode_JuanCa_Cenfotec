import { Button, InlineNotification, NumberInput, TextInput, Tile } from '@carbon/react'
import { useEffect, useState } from 'react'
import {
  esErrorDeApi,
  fijarCorreoDelDistribuidor,
  fijarPrecios,
  obtenerCorreoDelDistribuidor,
  obtenerPrecios,
  type PreciosVigentes,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

/**
 * Los dos ajustes que mantiene la dueña: el precio general y el de estudiante
 * (RF-6, RN-12) —el de miércoles no se fija, es la mitad del general por regla
 * (RN-13)— y la dirección de correo del distribuidor (RF-29, RN-49). Un cambio
 * de precio nunca mueve una compra ya registrada (RN-16, CA-4).
 */
export function PreciosYDistribuidor() {
  const [vigentes, setVigentes] = useState<PreciosVigentes | null>(null)
  const [general, setGeneral] = useState(8000)
  const [estudiante, setEstudiante] = useState(5000)
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 10))
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    obtenerPrecios()
      .then((precios) => {
        setVigentes(precios)
        setGeneral(precios.general)
        setEstudiante(precios.estudiante)
      })
      .catch(() => setVigentes(null))
    obtenerCorreoDelDistribuidor()
      .then(({ correo }) => setCorreo(correo ?? ''))
      .catch(() => setCorreo(''))
  }, [])

  async function guardarPrecios(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      setVigentes(await fijarPrecios(general, estudiante, desde))
      setAviso(`Desde el ${desde} rigen ${formatearColones(general)} y ${formatearColones(estudiante)}.`)
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos fijar los precios')
    }
  }

  async function guardarCorreo(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      await fijarCorreoDelDistribuidor(correo)
      setAviso('Se guardó el correo del distribuidor.')
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos guardar el correo')
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '40rem' }}>
      {error !== null ? (
        <div role="alert" aria-live="polite">
          <InlineNotification kind="error" title="No se pudo" subtitle={error} hideCloseButton />
        </div>
      ) : null}
      {aviso !== null ? (
        <div role="status" aria-live="polite">
          <InlineNotification kind="success" title="Listo" subtitle={aviso} onCloseButtonClick={() => setAviso(null)} />
        </div>
      ) : null}

      <Tile>
        <h2 style={{ fontSize: '1rem' }}>Precios</h2>
        <p style={{ marginBottom: '0.75rem' }}>
          {vigentes === null
            ? 'Todavía no hay precios fijados.'
            : `Vigentes desde el ${vigentes.desde}: general ${formatearColones(vigentes.general)}, estudiante ${formatearColones(vigentes.estudiante)}. Miércoles: ${formatearColones(Math.round(vigentes.general / 2))}.`}
        </p>
        <form onSubmit={guardarPrecios} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <NumberInput
            id="precio-general"
            label="Precio general"
            min={1}
            value={general}
            onChange={(_evento, estado) => setGeneral(Number(estado.value))}
          />
          <NumberInput
            id="precio-estudiante"
            label="Precio de estudiante"
            min={1}
            value={estudiante}
            onChange={(_evento, estado) => setEstudiante(Number(estado.value))}
          />
          <TextInput
            id="precios-desde"
            labelText="Rigen desde"
            placeholder="AAAA-MM-DD"
            helperText="El precio de una entrada se decide por la fecha de la función (RN-15)."
            value={desde}
            onChange={(evento) => setDesde(evento.target.value)}
          />
          <Button type="submit">Fijar precios</Button>
        </form>
      </Tile>

      <Tile>
        <h2 style={{ fontSize: '1rem' }}>Correo del distribuidor</h2>
        <form onSubmit={guardarCorreo} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <TextInput
            id="correo-distribuidor"
            labelText="Dirección"
            type="email"
            helperText="A esta dirección sale el reporte el día 1 de cada mes (RN-47)."
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
          />
          <Button type="submit" disabled={correo.trim() === ''}>
            Guardar
          </Button>
        </form>
      </Tile>
    </div>
  )
}
