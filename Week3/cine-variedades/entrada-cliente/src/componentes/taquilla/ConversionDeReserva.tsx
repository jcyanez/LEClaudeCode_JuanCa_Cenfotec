import { Button, InlineNotification, Modal, TextInput, Tile } from '@carbon/react'
import { useState } from 'react'
import {
  buscarReserva,
  convertirReserva,
  esErrorDeApi,
  liberarReserva,
  type ReservaEnTaquilla,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

/**
 * La conversión de una reserva de estudiante, que solo ocurre en taquilla
 * (RN-31): con carné se cobra precio de estudiante; sin carné se le ofrece
 * pagar precio general por las mismas butacas, y si no acepta, las butacas
 * vuelven a estar libres en el acto (RN-32, RN-33). La reserva conserva su
 * número al convertirse (RN-25).
 */
export function ConversionDeReserva() {
  const [numero, setNumero] = useState('')
  const [reserva, setReserva] = useState<ReservaEnTaquilla | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [confirmarLiberar, setConfirmarLiberar] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    setResultado(null)
    setReserva(null)
    try {
      setReserva(await buscarReserva(numero.trim().toUpperCase()))
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos buscar esa reserva')
    }
  }

  async function convertir(conCarne: boolean) {
    if (reserva === null) return
    setTrabajando(true)
    setError(null)
    try {
      const compra = await convertirReserva(reserva.numero, conCarne)
      setResultado(
        `Compra ${compra.numero} registrada por ${formatearColones(compra.montoTotal)}` +
          `${conCarne ? ' a precio de estudiante' : ' a precio general'}. Conserva el mismo número.`,
      )
      setReserva(null)
      setNumero('')
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos convertir la reserva')
    } finally {
      setTrabajando(false)
    }
  }

  async function liberar() {
    if (reserva === null) return
    setTrabajando(true)
    setConfirmarLiberar(false)
    setError(null)
    try {
      await liberarReserva(reserva.numero)
      setResultado(`Las butacas de ${reserva.numero} volvieron a estar libres.`)
      setReserva(null)
      setNumero('')
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos liberar las butacas')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div>
      <form onSubmit={buscar} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', maxWidth: '30rem' }}>
        <TextInput
          id="numero-de-reserva"
          labelText="Número de reserva"
          helperText="Seis caracteres, como los dicta quien llega."
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
          <InlineNotification kind="error" title="No se encontró" subtitle={error} hideCloseButton lowContrast />
        </div>
      ) : null}

      {resultado !== null ? (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="success" title="Listo" subtitle={resultado} hideCloseButton />
        </div>
      ) : null}

      {reserva !== null ? (
        <Tile style={{ marginTop: '1.5rem', maxWidth: '40rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Reserva {reserva.numero}</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem', margin: '0.75rem 0' }}>
            <dt>A nombre de</dt>
            <dd>{reserva.contacto.nombre}</dd>
            <dt>Butacas</dt>
            <dd>{reserva.butacaIds.length}</dd>
            <dt>Vence</dt>
            <dd>al empezar la función, {reserva.vence.slice(11, 16)}</dd>
          </dl>
          <p style={{ marginBottom: '0.75rem' }}>¿Presentó el carné de estudiante?</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button disabled={trabajando} onClick={() => convertir(true)}>
              Sí: cobrar precio de estudiante
            </Button>
            <Button kind="tertiary" disabled={trabajando} onClick={() => convertir(false)}>
              No, pero paga general
            </Button>
            <Button kind="danger--tertiary" disabled={trabajando} onClick={() => setConfirmarLiberar(true)}>
              No paga: liberar butacas
            </Button>
          </div>
        </Tile>
      ) : null}

      <Modal
        open={confirmarLiberar}
        danger
        modalHeading="Liberar las butacas de la reserva"
        modalLabel={reserva?.numero ?? ''}
        primaryButtonText="Liberar butacas"
        secondaryButtonText="Cancelar"
        onRequestClose={() => setConfirmarLiberar(false)}
        onSecondarySubmit={() => setConfirmarLiberar(false)}
        onRequestSubmit={liberar}
      >
        <p>
          Las butacas vuelven a estar libres en el acto y la reserva desaparece sin dejar registro (RN-32, RN-34).
          Esto no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
