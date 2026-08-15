import { useEffect, useState } from 'react'
import {
  buscarComprasPorContacto,
  esErrorDeApi,
  obtenerFuncionesDeLaJornada,
  validarEnPuerta,
  type CompraCompleta,
  type FuncionDeJornada,
} from '../api/cliente.js'
import { Aviso, Boton, CampoDeTexto, Etiqueta, Selector, Tarjeta } from '../componentes/base/index.js'
import { SesionOperador } from '../componentes/SesionOperador.js'
import { formatearFecha } from '../utilidades/formato.js'
import './Puerta.scss'

/**
 * La puerta (T21): se identifica una compra por su número (RN-35), se marcan
 * sus entradas como usadas con hora y operador (RN-36, RF-19) y se rechaza
 * con el motivo exacto cuando no se puede —ya usadas, de otra función,
 * función cancelada, compra anulada— (RF-20, tabla de errores de DISENO.md).
 * Si el número está mal dictado, se busca por nombre o correo antes de
 * rechazar a nadie (RF-18).
 *
 * Se usa de pie, con gente esperando: por eso el veredicto ocupa la pantalla
 * entera y se lee a un metro de distancia, y por eso `Enter` valida y `Esc`
 * limpia sin soltar el teclado.
 */
function PantallaDePuerta() {
  const [funciones, setFunciones] = useState<FuncionDeJornada[]>([])
  const [funcionId, setFuncionId] = useState<number | null>(null)
  const [numero, setNumero] = useState('')
  const [validada, setValidada] = useState<CompraCompleta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ofrecerBusqueda, setOfrecerBusqueda] = useState(false)
  const [contacto, setContacto] = useState('')
  const [encontradas, setEncontradas] = useState<CompraCompleta[] | null>(null)
  const [validando, setValidando] = useState(false)

  useEffect(() => {
    obtenerFuncionesDeLaJornada()
      .then((lista) => {
        setFunciones(lista)
        setFuncionId((actual) => actual ?? lista[0]?.funcionId ?? null)
      })
      .catch((error: unknown) =>
        setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las funciones de la jornada'),
      )
  }, [])

  function limpiar() {
    setNumero('')
    setValidada(null)
    setError(null)
    setOfrecerBusqueda(false)
    setEncontradas(null)
  }

  async function validar(evento: React.FormEvent) {
    evento.preventDefault()
    if (funcionId === null) return
    setValidando(true)
    setError(null)
    setValidada(null)
    setOfrecerBusqueda(false)
    try {
      setValidada(await validarEnPuerta(funcionId, numero.trim().toUpperCase()))
      setNumero('')
      setEncontradas(null)
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos validar esa compra')
      // Solo cuando el número no existe tiene sentido ofrecer la búsqueda
      // alternativa: en los demás rechazos el número sí es de alguien.
      setOfrecerBusqueda(esErrorDeApi(error) && error.error === 'CompraInexistente')
    } finally {
      setValidando(false)
    }
  }

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault()
    try {
      setEncontradas(await buscarComprasPorContacto(contacto.trim()))
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos buscar')
    }
  }

  const funcionElegida = funciones.find((funcion) => funcion.funcionId === funcionId)
  const hayVeredicto = validada !== null || error !== null

  return (
    <div className="puerta">
      <div className="puerta__reticula">
        <section className="puerta__control">
          <Selector
            id="funcion-de-puerta"
            etiqueta="Función que se está recibiendo"
            ayuda="Las de esta jornada: la de las 23:00 sigue siendo de hoy hasta las 06:00."
            value={funcionId ?? ''}
            onChange={(evento) => setFuncionId(Number(evento.target.value))}
          >
            {funciones.length === 0 ? <option value="">No hay funciones en esta jornada</option> : null}
            {funciones.map((funcion) => (
              <option key={funcion.funcionId} value={funcion.funcionId}>
                {funcion.horaInicio} · {funcion.pelicula} · {funcion.sala}
                {funcion.cancelada ? ' (cancelada)' : ''}
              </option>
            ))}
          </Selector>

          {funcionElegida !== undefined ? (
            <p className="puerta__cuando">
              {formatearFecha(funcionElegida.fecha)} · {funcionElegida.sala}
            </p>
          ) : null}

          {funcionElegida?.cancelada ? (
            <Aviso
              tono="advertencia"
              titulo="Esta función se canceló"
              detalle="Sus compras quedaron devueltas; ninguna entrada se puede validar."
            />
          ) : null}

          <form onSubmit={validar} className="puerta__formulario" onKeyDown={(e) => e.key === 'Escape' && limpiar()}>
            <CampoDeTexto
              id="numero-en-puerta"
              etiqueta="Número de compra"
              ayuda="Seis caracteres, como lo dicta quien llega."
              autoComplete="off"
              autoFocus
              className="puerta__numero"
              value={numero}
              onChange={(evento) => setNumero(evento.target.value)}
            />
            <Boton type="submit" disabled={validando || numero.trim() === '' || funcionId === null}>
              {validando ? 'Validando…' : 'Validar'}
            </Boton>
          </form>

          <p className="puerta__atajos">
            <kbd>Enter</kbd> valida · <kbd>Esc</kbd> limpia
          </p>
        </section>

        {/* El veredicto: lo único que quien recibe necesita ver desde lejos. */}
        <section
          className={[
            'veredicto',
            validada !== null ? 'veredicto--pase' : '',
            error !== null ? 'veredicto--alto' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role={error !== null ? 'alert' : 'status'}
          aria-live={error !== null ? 'assertive' : 'polite'}
        >
          {validada !== null ? (
            <>
              <p className="veredicto__marca">Puede pasar</p>
              <p className="veredicto__numero">{validada.numero}</p>
              <p className="veredicto__detalle">
                {validada.entradas.length} entrada{validada.entradas.length > 1 ? 's' : ''} · marcadas como usadas
              </p>
            </>
          ) : null}

          {error !== null ? (
            <>
              <p className="veredicto__marca">No pasa</p>
              <p className="veredicto__motivo">{error}</p>
            </>
          ) : null}

          {!hayVeredicto ? <p className="veredicto__espera">Esperando un número…</p> : null}
        </section>
      </div>

      {ofrecerBusqueda ? (
        <Tarjeta className="busqueda">
          <h2 className="busqueda__titulo">Buscar por nombre o correo</h2>
          <p className="busqueda__nota">
            Antes de rechazar a alguien, buscá su compra por el nombre o el correo con que la hizo.
          </p>
          <form onSubmit={buscar} className="busqueda__formulario">
            <CampoDeTexto
              id="contacto-en-puerta"
              etiqueta="Nombre o correo"
              autoComplete="off"
              value={contacto}
              onChange={(evento) => setContacto(evento.target.value)}
            />
            <Boton variante="secundario" type="submit" disabled={contacto.trim() === ''}>
              Buscar
            </Boton>
          </form>

          {encontradas !== null ? (
            encontradas.length === 0 ? (
              <p className="busqueda__nota">No hay ninguna compra a ese nombre ni a ese correo.</p>
            ) : (
              <ul className="busqueda__resultados">
                {encontradas.map((compra) => (
                  <li key={compra.numero}>
                    <Boton variante="fantasma" onClick={() => setNumero(compra.numero)}>
                      <span className="cifra">{compra.numero}</span>
                    </Boton>
                    <span>
                      {compra.entradas.length} entrada{compra.entradas.length > 1 ? 's' : ''}
                    </span>
                    <Etiqueta tono={compra.estado === 'pagada' ? 'exito' : 'alerta'}>{compra.estado}</Etiqueta>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Tarjeta>
      ) : null}
    </div>
  )
}

export function Puerta() {
  return <SesionOperador titulo="Puerta">{() => <PantallaDePuerta />}</SesionOperador>
}
