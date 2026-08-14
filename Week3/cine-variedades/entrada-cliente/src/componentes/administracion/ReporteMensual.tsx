import { Button, InlineNotification, Tag, TextInput, Tile } from '@carbon/react'
import { useCallback, useEffect, useState } from 'react'
import { enviarReporte, esErrorDeApi, obtenerReporte, type ReporteDelMes } from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

const NUMERO: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

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
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <TextInput
          id="mes-del-reporte"
          labelText="Mes"
          placeholder="AAAA-MM"
          value={mes}
          onChange={(evento) => setMes(evento.target.value)}
        />
        <Button kind="tertiary" onClick={cargar}>
          Ver reporte
        </Button>
        <Button disabled={enviando || reporte?.destinatario == null} onClick={reenviar}>
          {enviando ? 'Enviando…' : 'Enviar al distribuidor'}
        </Button>
      </div>

      {reporte?.destinatario == null ? (
        <InlineNotification
          kind="warning"
          title="Falta el correo del distribuidor"
          subtitle="Sin dirección no hay a quién mandarle el reporte (RF-29). Se configura en Precios y distribuidor."
          hideCloseButton
          lowContrast
        />
      ) : null}

      {error !== null ? (
        <div role="alert" aria-live="polite">
          <InlineNotification kind="error" title="No se pudo" subtitle={error} hideCloseButton />
        </div>
      ) : null}
      {aviso !== null ? (
        <div role="status" aria-live="polite">
          <InlineNotification kind="success" title="Envío" subtitle={aviso} onCloseButtonClick={() => setAviso(null)} />
        </div>
      ) : null}

      {reporte !== null ? (
        <>
          <Tile>
            <h2 style={{ fontSize: '1rem' }}>
              {reporte.mes} · {totalEntradas} entradas · {formatearColones(totalMonto)}
            </h2>
            {reporte.detalle.length === 0 ? (
              <p>No hubo funciones programadas en ese mes.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
                <caption className="cds--visually-hidden">Detalle función por función de {reporte.mes}</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left' }}>Fecha</th>
                    <th scope="col" style={{ textAlign: 'left' }}>Hora</th>
                    <th scope="col" style={{ textAlign: 'left' }}>Sala</th>
                    <th scope="col" style={{ textAlign: 'left' }}>Película</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Entradas</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.detalle.map((funcion) => (
                    <tr key={funcion.funcionId}>
                      <td>
                        {funcion.fecha} {funcion.cancelada ? <Tag type="red">Cancelada</Tag> : null}
                      </td>
                      <td>{funcion.horaInicio}</td>
                      <td>{funcion.sala}</td>
                      <td>{funcion.pelicula}</td>
                      <td style={NUMERO}>{funcion.entradasVendidas}</td>
                      <td style={NUMERO}>{formatearColones(funcion.montoVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tile>

          <Tile>
            <h2 style={{ fontSize: '1rem' }}>Envíos de este mes</h2>
            {reporte.envios.length === 0 ? (
              <p>Todavía no se intentó enviar el reporte de {reporte.mes}.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                {reporte.envios.map((envio) => (
                  <li key={envio.instante} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Tag type={envio.resultado === 'enviado' ? 'green' : 'red'}>{envio.resultado}</Tag>
                    <span>
                      {envio.instante.replace('T', ' ')} · {envio.destinatario}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        </>
      ) : null}
    </div>
  )
}
