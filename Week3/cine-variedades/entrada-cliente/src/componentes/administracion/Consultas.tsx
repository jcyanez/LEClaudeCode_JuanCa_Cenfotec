import { useState } from 'react'
import {
  consultarCategorias,
  consultarOcupacion,
  esErrorDeApi,
  type EntradasPorCategoriaYCanal,
  type OcupacionDeFuncion,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'
import { Aviso, Boton, CampoDeFecha } from '../base/index.js'
import './administracion.scss'

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
    <div className="panel">
      <form onSubmit={consultar} className="panel__barra">
        <CampoDeFecha id="consulta-desde" etiqueta="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <CampoDeFecha id="consulta-hasta" etiqueta="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <Boton type="submit">Consultar</Boton>
      </form>

      {error !== null ? <Aviso tono="error" titulo="No se pudo" detalle={error} /> : null}

      {ocupacion !== null ? (
        <section>
          <h2 className="panel__titulo">Ocupación por función</h2>
          {ocupacion.length === 0 ? (
            <p className="panel__nota">No hay funciones en ese período.</p>
          ) : (
            <div className="tabla-caja">
              <table className="tabla">
                <caption className="solo-lectores">Entradas vendidas sobre butacas de la sala, por función</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Película</th>
                    <th scope="col" className="numero">
                      Vendidas
                    </th>
                    <th scope="col" className="numero">
                      Butacas
                    </th>
                    <th scope="col" className="numero">
                      Ocupación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ocupacion.map((funcion) => (
                    <tr key={funcion.funcionId}>
                      <td className="cifra">{funcion.fecha}</td>
                      <td className="cifra">{funcion.horaInicio}</td>
                      <td>{funcion.pelicula}</td>
                      <td className="numero">{funcion.entradasVendidas}</td>
                      <td className="numero">{funcion.butacas}</td>
                      <td className="numero">
                        {/* La barra da la comparación de un vistazo; el número
                            queda igual para quien no distingue la barra. */}
                        <span className="barra-ocupacion">
                          <span
                            className="barra-ocupacion__relleno"
                            style={{ inlineSize: `${Math.round(funcion.ocupacion * 100)}%` }}
                          />
                        </span>
                        {Math.round(funcion.ocupacion * 100)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {categorias !== null ? (
        <section>
          <h2 className="panel__titulo">Entradas por categoría y canal</h2>
          {categorias.length === 0 ? (
            <p className="panel__nota">No hubo entradas en ese período.</p>
          ) : (
            <div className="tabla-caja">
              <table className="tabla">
                <caption className="solo-lectores">Entradas y monto por categoría de precio y por canal</caption>
                <thead>
                  <tr>
                    <th scope="col">Categoría</th>
                    <th scope="col">Canal</th>
                    <th scope="col" className="numero">
                      Entradas
                    </th>
                    <th scope="col" className="numero">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((fila) => (
                    <tr key={`${fila.categoria}-${fila.canal}`}>
                      <td>{NOMBRE_CATEGORIA[fila.categoria] ?? fila.categoria}</td>
                      <td>{fila.canal === 'taquilla' ? 'Taquilla' : 'Internet'}</td>
                      <td className="numero">{fila.entradas}</td>
                      <td className="numero">{formatearColones(fila.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
