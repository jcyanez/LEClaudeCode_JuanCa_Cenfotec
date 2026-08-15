import { useState } from 'react'
import {
  buscarReserva,
  convertirReserva,
  esErrorDeApi,
  liberarReserva,
  type ReservaEnTaquilla,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'
import { Aviso, Boton, CampoDeTexto, Modal, Tarjeta } from '../base/index.js'
import './taquilla.scss'

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
    <div className="trabajo">
      <form onSubmit={buscar} className="trabajo__buscador">
        <CampoDeTexto
          id="numero-de-reserva"
          etiqueta="Número de reserva"
          ayuda="Seis caracteres, como los dicta quien llega."
          autoComplete="off"
          className="cifra"
          value={numero}
          onChange={(evento) => setNumero(evento.target.value)}
        />
        <Boton type="submit" disabled={numero.trim() === ''}>
          Buscar
        </Boton>
      </form>

      {error !== null ? <Aviso tono="error" titulo="No se encontró" detalle={error} /> : null}
      {resultado !== null ? <Aviso tono="exito" titulo="Listo" detalle={resultado} /> : null}

      {reserva !== null ? (
        <Tarjeta>
          <h2 className="trabajo__titulo">
            Reserva <span className="cifra">{reserva.numero}</span>
          </h2>
          <dl className="ficha">
            <div>
              <dt className="ficha__etiqueta">A nombre de</dt>
              <dd className="ficha__dato">{reserva.contacto.nombre}</dd>
            </div>
            <div>
              <dt className="ficha__etiqueta">Butacas</dt>
              <dd className="ficha__dato cifra">{reserva.butacaIds.length}</dd>
            </div>
            <div>
              <dt className="ficha__etiqueta">Vence</dt>
              <dd className="ficha__dato">al empezar, {reserva.vence.slice(11, 16)}</dd>
            </div>
          </dl>
          <p className="trabajo__nota">¿Presentó el carné de estudiante?</p>
          <div className="trabajo__acciones">
            <Boton disabled={trabajando} onClick={() => convertir(true)}>
              Sí: cobrar precio de estudiante
            </Boton>
            <Boton variante="secundario" disabled={trabajando} onClick={() => convertir(false)}>
              No, pero paga general
            </Boton>
            <Boton variante="peligro" disabled={trabajando} onClick={() => setConfirmarLiberar(true)}>
              No paga: liberar butacas
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      <Modal
        titulo={`Liberar las butacas de ${reserva?.numero ?? 'la reserva'}`}
        abierto={confirmarLiberar}
        onCerrar={() => setConfirmarLiberar(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setConfirmarLiberar(false)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={liberar}>
              Liberar butacas
            </Boton>
          </>
        }
      >
        <p>
          Las butacas vuelven a estar libres en el acto y la reserva desaparece sin dejar registro. Esto no se puede
          deshacer.
        </p>
      </Modal>
    </div>
  )
}
