import { Button, DatePicker, DatePickerInput, InlineNotification, Tile } from '@carbon/react'
import { useCallback, useEffect, useState } from 'react'
import { esErrorDeApi, obtenerCierreDeCaja, type CierreDeCaja as Cierre } from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

const MONTO: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

/**
 * El cierre de caja de la jornada, en sus dos partes (RN-46, RF-26): la de
 * ventanilla —lo que hay que contar y entregar— y la de internet, solo
 * informativa, que nunca se mezcla con la anterior (CA-6). Es de solo
 * lectura: pedirlo dos veces no cambia nada, y como se calcula al vuelo, un
 * número puede moverse si se entrega una devolución después de mirarlo
 * (limitación conocida de DISENO.md).
 */
export function CierreDeCaja() {
  const [jornada, setJornada] = useState<string | undefined>(undefined)
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    obtenerCierreDeCaja(jornada)
      .then((respuesta) => {
        setCierre(respuesta)
        setError(null)
      })
      .catch((error: unknown) =>
        setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos calcular el cierre de caja'),
      )
  }, [jornada])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <DatePicker
          datePickerType="single"
          dateFormat="Y-m-d"
          value={jornada}
          onChange={(fechas: Date[]) => {
            const elegida = fechas[0]
            if (elegida !== undefined) setJornada(elegida.toISOString().slice(0, 10))
          }}
        >
          <DatePickerInput
            id="jornada-del-cierre"
            labelText="Jornada"
            placeholder="AAAA-MM-DD"
            helperText="La jornada empieza a las 06:00 y termina a las 05:59 del día siguiente (RN-10)."
          />
        </DatePicker>
        <Button kind="tertiary" onClick={cargar}>
          Actualizar
        </Button>
      </div>

      {error !== null ? (
        <div role="alert" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="error" title="No se pudo calcular" subtitle={error} hideCloseButton lowContrast />
        </div>
      ) : null}

      {cierre !== null ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', marginTop: '1.5rem' }}>
          <Tile>
            <h2 style={{ fontSize: '1rem' }}>Ventanilla · jornada {cierre.jornada}</h2>
            <p style={{ marginBottom: '0.75rem' }}>Esto es lo que hay que contar y entregar.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption className="cds--visually-hidden">Cierre de ventanilla de la jornada {cierre.jornada}</caption>
              <tbody>
                <tr>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
                    Cobrado en efectivo
                  </th>
                  <td style={MONTO}>{formatearColones(cierre.ventanilla.cobrado)}</td>
                </tr>
                <tr>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
                    Devoluciones entregadas
                  </th>
                  <td style={MONTO}>− {formatearColones(cierre.ventanilla.devuelto)}</td>
                </tr>
                <tr>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
                    Efectivo esperado
                  </th>
                  <td style={{ ...MONTO, fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
                    {formatearColones(cierre.ventanilla.efectivoEsperado)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Tile>

          <Tile>
            <h2 style={{ fontSize: '1rem' }}>Internet · jornada {cierre.jornada}</h2>
            <p style={{ marginBottom: '0.75rem' }}>Informativo: por este canal no hay efectivo que contar.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <caption className="cds--visually-hidden">Vendido por internet en la jornada {cierre.jornada}</caption>
              <tbody>
                <tr>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
                    Vendido por internet
                  </th>
                  <td style={MONTO}>{formatearColones(cierre.internet.vendido)}</td>
                </tr>
              </tbody>
            </table>
          </Tile>
        </div>
      ) : null}
    </div>
  )
}
