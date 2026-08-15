import { useState } from 'react'
import {
  anularCompra,
  buscarCompraEnTaquilla,
  esErrorDeApi,
  marcarDevolucionEntregada,
  type CompraCompleta,
} from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'
import { AreaDeTexto, Aviso, Boton, CampoDeTexto, Etiqueta, Modal, Tarjeta } from '../base/index.js'
import './taquilla.scss'

const ETIQUETA_ESTADO: Record<
  CompraCompleta['estado'],
  { texto: string; tono: 'exito' | 'alerta' | 'aviso' }
> = {
  pagada: { texto: 'Pagada', tono: 'exito' },
  anulada: { texto: 'Anulada', tono: 'alerta' },
  devuelta: { texto: 'Devuelta', tono: 'aviso' },
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
      setResultado('Devolución entregada en efectivo. Se descuenta del cierre de caja de la jornada de hoy.')
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos marcar la devolución')
    } finally {
      setTrabajando(false)
    }
  }

  const yaUsada = compra?.entradas.some((entrada) => entrada.usadaInstante !== null) ?? false

  return (
    <div className="trabajo">
      <form onSubmit={buscar} className="trabajo__buscador">
        <CampoDeTexto
          id="numero-de-compra"
          etiqueta="Número de compra"
          ayuda="Seis caracteres, como está en el correo o en la pantalla."
          autoComplete="off"
          className="cifra"
          value={numero}
          onChange={(evento) => setNumero(evento.target.value)}
        />
        <Boton type="submit" disabled={numero.trim() === ''}>
          Buscar
        </Boton>
      </form>

      {error !== null ? <Aviso tono="error" titulo="No se pudo" detalle={error} /> : null}
      {resultado !== null ? <Aviso tono="exito" titulo="Listo" detalle={resultado} /> : null}

      {compra !== null ? (
        <Tarjeta>
          <div className="trabajo__acciones">
            <h2 className="trabajo__titulo">
              Compra <span className="cifra">{compra.numero}</span>
            </h2>
            <Etiqueta tono={ETIQUETA_ESTADO[compra.estado].tono}>{ETIQUETA_ESTADO[compra.estado].texto}</Etiqueta>
            <Etiqueta>{compra.canal === 'taquilla' ? 'Taquilla' : 'Internet'}</Etiqueta>
          </div>

          <dl className="ficha">
            <div>
              <dt className="ficha__etiqueta">Entradas</dt>
              <dd className="ficha__dato cifra">{compra.entradas.length}</dd>
            </div>
            <div>
              <dt className="ficha__etiqueta">Monto</dt>
              <dd className="ficha__dato cifra">{formatearColones(compra.montoTotal)}</dd>
            </div>
            <div>
              <dt className="ficha__etiqueta">Jornada</dt>
              <dd className="ficha__dato cifra">{compra.jornada}</dd>
            </div>
          </dl>

          {yaUsada ? (
            <Aviso
              tono="informacion"
              titulo="Ya se validó en la puerta"
              detalle="Una compra con entradas usadas no se anula. Si hace falta, se cancela la función."
            />
          ) : null}

          {compra.estado === 'pagada' && !yaUsada ? (
            <>
              <AreaDeTexto
                id="motivo-de-anulacion"
                etiqueta="Motivo de la anulación"
                ayuda="Queda registrado con tu nombre y la hora."
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
              />
              <div className="trabajo__acciones">
                <Boton
                  variante="peligro"
                  disabled={trabajando || motivo.trim() === ''}
                  onClick={() => setConfirmarAnular(true)}
                >
                  Anular compra
                </Boton>
              </div>
            </>
          ) : null}

          {compra.estado !== 'pagada' && compra.canal === 'taquilla' ? (
            <div className="trabajo__acciones">
              <Boton variante="secundario" disabled={trabajando} onClick={entregarDevolucion}>
                Marcar devolución entregada en efectivo
              </Boton>
            </div>
          ) : null}

          {compra.estado !== 'pagada' && compra.canal === 'internet' ? (
            <p className="trabajo__nota">
              La devolución de una compra por internet vuelve por el mismo medio de pago: no hay efectivo que
              entregar.
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      <Modal
        titulo={`Anular la compra ${compra?.numero ?? ''}`}
        abierto={confirmarAnular}
        onCerrar={() => setConfirmarAnular(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setConfirmarAnular(false)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={anular}>
              Anular compra
            </Boton>
          </>
        }
      >
        <p>
          Las butacas vuelven a estar libres y queda registrado quién anuló, cuándo y por qué. Esto no se puede
          deshacer.
        </p>
      </Modal>
    </div>
  )
}
