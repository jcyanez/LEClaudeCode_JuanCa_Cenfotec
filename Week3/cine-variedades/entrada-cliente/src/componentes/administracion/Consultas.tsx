import { Button, InlineNotification, TextInput, Tile } from '@carbon/react'
import { useState } from 'react'
import {
  consultarCategorias,
  consultarOcupacion,
  esErrorDeApi,
  type EntradasPorCategoriaYCanal,
  type OcupacionDeFuncion,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

const NUMERO: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

const NOMBRE_CATEGORIA: Record<string, string> = {
  general: 'General',
  estudiante: 'Estudiante',
  miercoles: 'Miércoles',
}

function haceUnMes(): string {
  const hoy = new Date()
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, hoy.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

/**
 * Las dos consultas que la dueña pidió poder contestar un año después
 * (RF-30, RF-31): qué película y qué horario llenan más, y cuánto pesa cada
 * categoría de precio y cada canal en un período que ella elige. Son de solo
 * lectura y no cambian ninguna venta (promesa de Salidas en DISENO.md).
 */
export function Consultas() {
  const [desde, setDesde] = useState(haceUnMes())
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [ocupacion, setOcupacion] = useState<OcupacionDeFuncion[] | null>(null)
  const [categorias, setCategorias] = useState<EntradasPorCategoriaYCanal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function consultar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      const [porFuncion, porCategoria] = await Promise.all([
        consultarOcupacion(desde, hasta),
        consultarCategorias(desde, hasta),
      ])
      setOcupacion(porFuncion)
      setCategorias(porCategoria)
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos hacer la consulta')
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <form onSubmit={consultar} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <TextInput
          id="consulta-desde"
          labelText="Desde"
          placeholder="AAAA-MM-DD"
          value={desde}
          onChange={(evento) => setDesde(evento.target.value)}
        />
        <TextInput
          id="consulta-hasta"
          labelText="Hasta"
          placeholder="AAAA-MM-DD"
          value={hasta}
          onChange={(evento) => setHasta(evento.target.value)}
        />
        <Button type="submit">Consultar</Button>
      </form>

      {error !== null ? (
        <div role="alert" aria-live="polite">
          <InlineNotification kind="error" title="No se pudo" subtitle={error} hideCloseButton />
        </div>
      ) : null}

      {ocupacion !== null ? (
        <Tile>
          <h2 style={{ fontSize: '1rem' }}>Ocupación por función</h2>
          {ocupacion.length === 0 ? (
            <p>No hay funciones en ese período.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
              <caption className="cds--visually-hidden">
                Entradas vendidas sobre butacas de la sala, por función
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left' }}>Fecha</th>
                  <th scope="col" style={{ textAlign: 'left' }}>Hora</th>
                  <th scope="col" style={{ textAlign: 'left' }}>Película</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Vendidas</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Butacas</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Ocupación</th>
                </tr>
              </thead>
              <tbody>
                {ocupacion.map((funcion) => (
                  <tr key={funcion.funcionId}>
                    <td>{funcion.fecha}</td>
                    <td>{funcion.horaInicio}</td>
                    <td>{funcion.pelicula}</td>
                    <td style={NUMERO}>{funcion.entradasVendidas}</td>
                    <td style={NUMERO}>{funcion.butacas}</td>
                    <td style={NUMERO}>{Math.round(funcion.ocupacion * 100)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tile>
      ) : null}

      {categorias !== null ? (
        <Tile>
          <h2 style={{ fontSize: '1rem' }}>Entradas por categoría y canal</h2>
          {categorias.length === 0 ? (
            <p>No hubo entradas en ese período.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
              <caption className="cds--visually-hidden">Entradas y monto por categoría de precio y por canal</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left' }}>Categoría</th>
                  <th scope="col" style={{ textAlign: 'left' }}>Canal</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Entradas</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((fila) => (
                  <tr key={`${fila.categoria}-${fila.canal}`}>
                    <td>{NOMBRE_CATEGORIA[fila.categoria] ?? fila.categoria}</td>
                    <td>{fila.canal === 'taquilla' ? 'Taquilla' : 'Internet'}</td>
                    <td style={NUMERO}>{fila.entradas}</td>
                    <td style={NUMERO}>{formatearColones(fila.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tile>
      ) : null}
    </div>
  )
}
