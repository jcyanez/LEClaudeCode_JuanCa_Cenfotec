import { Button, InlineNotification, Modal, Tag, TextArea, TextInput, Tile } from '@carbon/react'
import { useState } from 'react'
import {
  anularCompra,
  buscarCompraEnTaquilla,
  esErrorDeApi,
  marcarDevolucionEntregada,
  type CompraCompleta,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

const ETIQUETA_ESTADO: Record<CompraCompleta['estado'], { texto: string; tipo: 'green' | 'red' | 'purple' }> = {
  pagada: { texto: 'Pagada', tipo: 'green' },
  anulada: { texto: 'Anulada', tipo: 'red' },
  devuelta: { texto: 'Devuelta', tipo: 'purple' },
}

/**
 * Anulación y devoluciones sobre una compra puntual: se anula hasta la hora de
 * inicio de la función y siempre con motivo (RN-38, RN-40, RF-21); una compra
 * con entradas ya usadas no se anula (RN-39, RF-22) y el servidor lo rechaza
 * diciendo a qué hora se validaron. La devolución en efectivo se marca aparte,
 * porque descuenta la jornada en que se entrega, no la de la venta (RN-44,
 * RF-25, REG-5).
 */
export function CompraEnTaquilla() {
  const [numero, setNumero] = useState('')
  const [compra, setCompra] = useState<CompraCompleta | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    setResultado(null)
    setCompra(null)
    try {
      setCompra(await buscarCompraEnTaquilla(numero.trim().toUpperCase()))
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos buscar esa compra')
    }
  }

  async function anular() {
    if (compra === null) return
    setTrabajando(true)
    setConfirmarAnular(false)
    setError(null)
    try {
      const anulada = await anularCompra(compra.numero, motivo)
      setCompra(anulada)
      setMotivo('')
      setResultado(`La compra ${anulada.numero} quedó anulada y sus butacas volvieron a estar libres.`)
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos anular la compra')
    } finally {
      setTrabajando(false)
    }
  }

  async function entregarDevolucion() {
    if (compra === null) return
    setTrabajando(true)
    setError(null)
    try {
      const actualizada = await marcarDevolucionEntregada(compra.numero)
      setCompra(actualizada)
      setResultado(
        `Devolución entregada en efectivo. Se descuenta del cierre de caja de la jornada de hoy (RN-44).`,
      )
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos marcar la devolución')
    } finally {
      setTrabajando(false)
    }
  }

  const yaUsada = compra?.entradas.some((entrada) => entrada.usadaInstante !== null) ?? false

  return (
    <div>
      <form onSubmit={buscar} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', maxWidth: '30rem' }}>
        <TextInput
          id="numero-de-compra"
          labelText="Número de compra"
          helperText="Seis caracteres, como está en el correo o en la pantalla."
          autoComplete="off"
          value={numero}
          onChange={(evento) => setNumero(evento.target.value)}
        />
        <Button type="submit" disabled={numero.trim() === ''}>
          Buscar
        </Button>
      </form>

      {error !== null ? (
        <div role="alert" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="error" title="No se pudo" subtitle={error} hideCloseButton lowContrast />
        </div>
      ) : null}

      {resultado !== null ? (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="success" title="Listo" subtitle={resultado} hideCloseButton />
        </div>
      ) : null}

      {compra !== null ? (
        <Tile style={{ marginTop: '1.5rem', maxWidth: '40rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Compra {compra.numero}</h2>
            <Tag type={ETIQUETA_ESTADO[compra.estado].tipo}>{ETIQUETA_ESTADO[compra.estado].texto}</Tag>
            <Tag type="outline">{compra.canal === 'taquilla' ? 'Taquilla' : 'Internet'}</Tag>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem', margin: '0.75rem 0' }}>
            <dt>Entradas</dt>
            <dd>{compra.entradas.length}</dd>
            <dt>Monto</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{formatearColones(compra.montoTotal)}</dd>
            <dt>Jornada</dt>
            <dd>{compra.jornada}</dd>
          </dl>

          {yaUsada ? (
            <InlineNotification
              kind="info"
              title="Ya se validó en la puerta"
              subtitle="Una compra con entradas usadas no se anula (RN-39). Si hace falta, se cancela la función."
              hideCloseButton
              lowContrast
            />
          ) : null}

          {compra.estado === 'pagada' && !yaUsada ? (
            <>
              <TextArea
                id="motivo-de-anulacion"
                labelText="Motivo de la anulación"
                helperText="Queda registrado con tu nombre y la hora (REG-4)."
                rows={2}
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
              />
              <Button
                kind="danger"
                style={{ marginTop: '1rem' }}
                disabled={trabajando || motivo.trim() === ''}
                onClick={() => setConfirmarAnular(true)}
              >
                Anular compra
              </Button>
            </>
          ) : null}

          {compra.estado !== 'pagada' && compra.canal === 'taquilla' ? (
            <Button kind="tertiary" disabled={trabajando} onClick={entregarDevolucion}>
              Marcar devolución entregada en efectivo
            </Button>
          ) : null}

          {compra.estado !== 'pagada' && compra.canal === 'internet' ? (
            <p>
              La devolución de una compra por internet vuelve por el mismo medio de pago: no hay efectivo que
              entregar (RN-45).
            </p>
          ) : null}
        </Tile>
      ) : null}

      <Modal
        open={confirmarAnular}
        danger
        modalHeading="Anular la compra"
        modalLabel={compra?.numero ?? ''}
        primaryButtonText="Anular compra"
        secondaryButtonText="Cancelar"
        onRequestClose={() => setConfirmarAnular(false)}
        onSecondarySubmit={() => setConfirmarAnular(false)}
        onRequestSubmit={anular}
      >
        <p>
          Las butacas vuelven a estar libres y queda registrado quién anuló, cuándo y por qué. Esto no se puede
          deshacer.
        </p>
      </Modal>
    </div>
  )
}
