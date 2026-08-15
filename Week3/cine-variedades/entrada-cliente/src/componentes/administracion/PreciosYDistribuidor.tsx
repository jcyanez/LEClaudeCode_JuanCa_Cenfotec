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
import { Aviso, Boton, CampoDeFecha, CampoDeTexto, CampoNumerico, Tarjeta } from '../base/index.js'
import './administracion.scss'

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
    <div className="panel">
      {error !== null ? <Aviso tono="error" titulo="No se pudo" detalle={error} /> : null}
      {aviso !== null ? <Aviso tono="exito" titulo="Listo" detalle={aviso} /> : null}

      <Tarjeta>
        <h2 className="panel__titulo">Precios</h2>
        {vigentes === null ? (
          <p className="panel__nota">Todavía no hay precios fijados.</p>
        ) : (
          <ul className="cierre__indicadores">
            <li className="indicador">
              <p className="indicador__etiqueta">General</p>
              <p className="indicador__valor">{formatearColones(vigentes.general)}</p>
            </li>
            <li className="indicador">
              <p className="indicador__etiqueta">Estudiante</p>
              <p className="indicador__valor">{formatearColones(vigentes.estudiante)}</p>
            </li>
            <li className="indicador indicador--destacado">
              <p className="indicador__etiqueta">Miércoles (mitad)</p>
              <p className="indicador__valor">{formatearColones(Math.round(vigentes.general / 2))}</p>
            </li>
          </ul>
        )}
        {vigentes !== null ? <p className="panel__nota">Vigentes desde el {vigentes.desde}.</p> : null}

        <form onSubmit={guardarPrecios} className="panel__formulario">
          <CampoNumerico
            id="precio-general"
            etiqueta="Precio general"
            min={1}
            value={general}
            onChange={(evento) => setGeneral(Number(evento.target.value))}
          />
          <CampoNumerico
            id="precio-estudiante"
            etiqueta="Precio de estudiante"
            min={1}
            value={estudiante}
            onChange={(evento) => setEstudiante(Number(evento.target.value))}
          />
          <CampoDeFecha
            id="precios-desde"
            etiqueta="Rigen desde"
            ayuda="El precio de una entrada se decide por la fecha de la función."
            value={desde}
            onChange={(evento) => setDesde(evento.target.value)}
          />
          <Boton type="submit">Fijar precios</Boton>
        </form>
      </Tarjeta>

      <Tarjeta>
        <h2 className="panel__titulo">Correo del distribuidor</h2>
        <form onSubmit={guardarCorreo} className="panel__formulario">
          <CampoDeTexto
            id="correo-distribuidor"
            etiqueta="Dirección"
            type="email"
            ayuda="A esta dirección sale el reporte el día 1 de cada mes."
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
          />
          <Boton type="submit" disabled={correo.trim() === ''}>
            Guardar
          </Boton>
        </form>
      </Tarjeta>
    </div>
  )
}
