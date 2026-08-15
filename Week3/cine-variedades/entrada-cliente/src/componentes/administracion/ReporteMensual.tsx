import { useCallback, useEffect, useState } from 'react'
import { enviarReporte, esErrorDeApi, obtenerReporte, type ReporteDelMes } from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'
import { Aviso, Boton, CampoDeTexto, Etiqueta, Tarjeta } from '../base/index.js'
import './administracion.scss'

function mesAnterior(): string {
  const hoy = new Date()
  const mes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1))
  return mes.toISOString().slice(0, 7)
}

/**
 * El reporte que se le manda al distribuidor (RF-27): detalle función por
 * función, con las canceladas marcadas y sus entradas vendidas y devueltas a
 * la vista (RN-41, CA-5). El envío automático es del día 1 (RN-47); acá se ve
 * cada intento —salió o falló— y se puede reenviar a mano cuando falla
 * (RF-28, RN-48, REG-7).
 */
export function ReporteMensual() {
  const [mes, setMes] = useState(mesAnterior())
  const [reporte, setReporte] = useState<ReporteDelMes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(() => {
    obtenerReporte(mes)
      .then((respuesta) => {
        setReporte(respuesta)
        setError(null)
      })
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos armar el reporte'))
  }, [mes])

  useEffect(cargar, [cargar])

  async function reenviar() {
    setEnviando(true)
    setError(null)
    try {
      const registro = await enviarReporte(mes)
      setAviso(
        registro.resultado === 'enviado'
          ? `El reporte de ${mes} salió a ${registro.destinatario}.`
          : `El envío a ${registro.destinatario} falló otra vez; quedó registrado el intento.`,
      )
      cargar()
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos enviar el reporte')
    } finally {
      setEnviando(false)
    }
  }

  const totalEntradas = reporte?.detalle.reduce((suma, f) => suma + f.entradasVendidas, 0) ?? 0
  const totalMonto = reporte?.detalle.reduce((suma, f) => suma + f.montoVendido, 0) ?? 0

  return (
    <div className="panel">
      <div className="panel__barra">
        <CampoDeTexto
          id="mes-del-reporte"
          etiqueta="Mes"
          placeholder="AAAA-MM"
          className="cifra"
          value={mes}
          onChange={(evento) => setMes(evento.target.value)}
        />
        <Boton variante="secundario" onClick={cargar}>
          Ver reporte
        </Boton>
        <Boton disabled={enviando || reporte?.destinatario == null} onClick={reenviar}>
          {enviando ? 'Enviando…' : 'Enviar al distribuidor'}
        </Boton>
      </div>

      {reporte?.destinatario == null ? (
        <Aviso
          tono="advertencia"
          titulo="Falta el correo del distribuidor"
          detalle="Sin dirección no hay a quién mandarle el reporte. Se configura en Precios y distribuidor."
        />
      ) : null}

      {error !== null ? <Aviso tono="error" titulo="No se pudo" detalle={error} /> : null}
      {aviso !== null ? <Aviso tono="exito" titulo="Envío" detalle={aviso} /> : null}

      {reporte !== null ? (
        <>
          <section>
            <ul className="cierre__indicadores">
              <li className="indicador">
                <p className="indicador__etiqueta">Mes</p>
                <p className="indicador__valor">{reporte.mes}</p>
              </li>
              <li className="indicador">
                <p className="indicador__etiqueta">Entradas</p>
                <p className="indicador__valor">{totalEntradas}</p>
              </li>
              <li className="indicador indicador--destacado">
                <p className="indicador__etiqueta">Vendido</p>
                <p className="indicador__valor">{formatearColones(totalMonto)}</p>
              </li>
            </ul>
          </section>

          {reporte.detalle.length === 0 ? (
            <p className="panel__nota">No hubo funciones programadas en ese mes.</p>
          ) : (
            <div className="tabla-caja">
              <table className="tabla">
                <caption className="solo-lectores">Detalle función por función de {reporte.mes}</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Hora</th>
                    <th scope="col">Sala</th>
                    <th scope="col">Película</th>
                    <th scope="col" className="numero">
                      Entradas
                    </th>
                    <th scope="col" className="numero">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.detalle.map((funcion) => (
                    <tr key={funcion.funcionId}>
                      <td>
                        <span className="cifra">{funcion.fecha}</span>{' '}
                        {funcion.cancelada ? <Etiqueta tono="alerta">Cancelada</Etiqueta> : null}
                      </td>
                      <td className="cifra">{funcion.horaInicio}</td>
                      <td>{funcion.sala}</td>
                      <td>{funcion.pelicula}</td>
                      <td className="numero">{funcion.entradasVendidas}</td>
                      <td className="numero">{formatearColones(funcion.montoVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Tarjeta>
            <h2 className="panel__titulo">Envíos de este mes</h2>
            {reporte.envios.length === 0 ? (
              <p className="panel__nota">Todavía no se intentó enviar el reporte de {reporte.mes}.</p>
            ) : (
              <ul className="panel__lista">
                {reporte.envios.map((envio) => (
                  <li key={envio.instante}>
                    <Etiqueta tono={envio.resultado === 'enviado' ? 'exito' : 'alerta'}>{envio.resultado}</Etiqueta>
                    <span className="cifra">{envio.instante.replace('T', ' ')}</span>
                    <span>{envio.destinatario}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </>
      ) : null}
    </div>
  )
}
