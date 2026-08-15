import { useCallback, useEffect, useState } from 'react'
import {
  esErrorDeApi,
  obtenerFuncionesDeTaquilla,
  obtenerMapaDeTaquilla,
  venderEnTaquilla,
  type ButacaElegida,
  type CategoriaPrecio,
  type FuncionEnCartelera,
  type MapaDeTaquilla,
} from '../../api/cliente.js'
import { ETIQUETA_MIERCOLES, formatearColones, formatearFecha } from '../../utilidades/formato.js'
import { Aviso, Boton, Selector } from '../base/index.js'
import { MapaDeButacas, type ButacaDibujable } from '../MapaDeButacas.js'
import './taquilla.scss'

const INTERVALO_SONDEO_MS = 3000

/**
 * La venta presencial (RF-12): el mismo mapa que internet, con el detalle real
 * de cada butaca (RN-57), y una categoría de precio por butaca. En una función
 * de miércoles no se pregunta nada: la única categoría es miércoles (RN-14,
 * CA-3). Las butacas pasan de libres a vendidas sin bloqueo intermedio
 * (RN-20); eso lo resuelve el servidor.
 *
 * El mapa manda a la izquierda y el cobro queda fijo a la derecha, siguiendo
 * el desplazamiento: en una sala de 120 butacas, el total y el botón de cobrar
 * tienen que estar a la vista sin volver a subir.
 */
export function VentaEnTaquilla() {
  const [funciones, setFunciones] = useState<FuncionEnCartelera[]>([])
  const [funcionId, setFuncionId] = useState<number | null>(null)
  const [datos, setDatos] = useState<MapaDeTaquilla | null>(null)
  const [elegidas, setElegidas] = useState<ButacaElegida[]>([])
  const [consultada, setConsultada] = useState<ButacaDibujable | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmada, setConfirmada] = useState<{ numero: string; montoTotal: number } | null>(null)
  const [cobrando, setCobrando] = useState(false)

  useEffect(() => {
    obtenerFuncionesDeTaquilla()
      .then((lista) => {
        setFunciones(lista)
        setFuncionId((actual) => actual ?? lista[0]?.funcionId ?? null)
      })
      .catch((error: unknown) =>
        setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las funciones en venta'),
      )
  }, [])

  const cargarMapa = useCallback(() => {
    if (funcionId === null) return
    obtenerMapaDeTaquilla(funcionId)
      .then(setDatos)
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar el mapa'))
  }, [funcionId])

  useEffect(() => {
    setElegidas([])
    setConsultada(null)
    cargarMapa()
  }, [cargarMapa])

  // El mapa es compartido con internet: se refresca cada 3 segundos mientras
  // está a la vista (decisión de DISENO.md), salvo mientras se cobra.
  useEffect(() => {
    if (cobrando) return undefined
    const referencia = setInterval(cargarMapa, INTERVALO_SONDEO_MS)
    return () => clearInterval(referencia)
  }, [cargarMapa, cobrando])

  const esMiercoles = datos?.funcion.categoriaBase === 'miercoles'

  function alternarButaca(butacaId: number) {
    setConfirmada(null)
    setElegidas((anteriores) => {
      const yaEstaba = anteriores.some((butaca) => butaca.butacaId === butacaId)
      if (yaEstaba) return anteriores.filter((butaca) => butaca.butacaId !== butacaId)
      return [...anteriores, { butacaId, categoria: esMiercoles ? 'miercoles' : 'general' }]
    })
  }

  function cambiarCategoria(butacaId: number, categoria: CategoriaPrecio) {
    setElegidas((anteriores) =>
      anteriores.map((butaca) => (butaca.butacaId === butacaId ? { ...butaca, categoria } : butaca)),
    )
  }

  function precioDe(categoria: CategoriaPrecio): number {
    return datos?.precios[categoria] ?? 0
  }

  const total = elegidas.reduce((suma, butaca) => suma + precioDe(butaca.categoria), 0)

  const cobrar = useCallback(async () => {
    if (funcionId === null) return
    setCobrando(true)
    setError(null)
    try {
      const compra = await venderEnTaquilla(funcionId, elegidas)
      setConfirmada({ numero: compra.numero, montoTotal: compra.montoTotal })
      setElegidas([])
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos registrar la compra')
    } finally {
      setCobrando(false)
      cargarMapa()
    }
  }, [funcionId, elegidas, cargarMapa])

  /**
   * Atajos de la ventanilla: `Enter` cobra lo que hay elegido y `Esc` suelta la
   * selección. Quien atiende no debería tener que soltar el teclado para
   * despachar una fila. No se disparan mientras se escribe en un campo.
   */
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      const enUnCampo = evento.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(evento.target.tagName)
      if (evento.key === 'Escape') {
        setElegidas([])
        setConsultada(null)
        return
      }
      if (evento.key === 'Enter' && !enUnCampo && elegidas.length > 0 && !cobrando) {
        evento.preventDefault()
        void cobrar()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [cobrar, elegidas.length, cobrando])

  const etiquetaDe = (butacaId: number): string =>
    datos?.mapa.find((butaca) => butaca.butacaId === butacaId)?.etiqueta ?? String(butacaId)

  return (
    <div className="venta">
      <section className="venta__mapa">
        <Selector
          id="funcion-de-taquilla"
          etiqueta="Función"
          value={funcionId ?? ''}
          onChange={(evento) => setFuncionId(Number(evento.target.value))}
        >
          {funciones.length === 0 ? <option value="">No hay funciones en venta</option> : null}
          {funciones.map((funcion) => (
            <option key={funcion.funcionId} value={funcion.funcionId}>
              {funcion.pelicula} · {funcion.sala} · {formatearFecha(funcion.fecha)} {funcion.horaInicio}
            </option>
          ))}
        </Selector>

        {error !== null ? <Aviso tono="error" titulo="No se pudo continuar" detalle={error} /> : null}

        {datos !== null ? (
          <>
            {esMiercoles ? <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p> : null}
            <MapaDeButacas
              butacas={datos.mapa}
              butacasPorFila={datos.funcion.butacasPorFila}
              seleccionadas={new Set(elegidas.map((butaca) => butaca.butacaId))}
              onCambiarSeleccion={alternarButaca}
              onConsultarOcupada={setConsultada}
            />
          </>
        ) : null}

        {consultada !== null ? (
          <Aviso
            tono="informacion"
            titulo={`Butaca ${consultada.etiqueta} · ${consultada.estado}`}
            detalle={
              consultada.numero != null
                ? `Número ${consultada.numero}. Buscalo en Reservas o en Compras.`
                : 'Alguien la está eligiendo por internet; se libera sola si no completa la compra.'
            }
          >
            <Boton variante="fantasma" onClick={() => setConsultada(null)}>
              Entendido
            </Boton>
          </Aviso>
        ) : null}
      </section>

      {/* El panel de cobro: fijo, siempre a la vista mientras se elige. */}
      <aside className="venta__panel" aria-label="Cobro">
        {confirmada !== null ? (
          <div className="cobrado" role="status">
            <p className="cobrado__marca">Compra registrada</p>
            <p className="cobrado__numero">{confirmada.numero}</p>
            <p className="cobrado__detalle">
              Cobrar <span className="cifra">{formatearColones(confirmada.montoTotal)}</span> y dictarle el número a
              quien compró.
            </p>
          </div>
        ) : null}

        {elegidas.length === 0 ? (
          <p className="venta__vacio">Elegí butacas en el mapa para cobrar.</p>
        ) : (
          <>
            <p className="venta__resumen">
              {elegidas.length} butaca{elegidas.length > 1 ? 's' : ''}
              <span className="venta__total cifra">{formatearColones(total)}</span>
            </p>

            {esMiercoles ? (
              <p className="venta__nota">
                En miércoles toda entrada va a la mitad del precio general y no se pide carné.
              </p>
            ) : (
              <ul className="venta__categorias">
                {elegidas.map((butaca) => (
                  <li key={butaca.butacaId}>
                    <Selector
                      id={`categoria-${butaca.butacaId}`}
                      etiqueta={`Butaca ${etiquetaDe(butaca.butacaId)}`}
                      value={butaca.categoria}
                      onChange={(evento) => cambiarCategoria(butaca.butacaId, evento.target.value as CategoriaPrecio)}
                    >
                      <option value="general">General · {formatearColones(precioDe('general'))}</option>
                      <option value="estudiante">
                        Estudiante (con carné) · {formatearColones(precioDe('estudiante'))}
                      </option>
                    </Selector>
                  </li>
                ))}
              </ul>
            )}

            <Boton disabled={cobrando} onClick={cobrar}>
              {cobrando ? 'Registrando…' : `Cobrar ${formatearColones(total)} y registrar`}
            </Boton>
            <p className="venta__atajos">
              <kbd>Enter</kbd> cobra · <kbd>Esc</kbd> suelta la selección
            </p>
          </>
        )}
      </aside>
    </div>
  )
}
