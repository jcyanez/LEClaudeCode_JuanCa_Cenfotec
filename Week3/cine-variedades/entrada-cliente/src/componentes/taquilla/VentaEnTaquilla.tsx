import { Button, InlineNotification, Select, SelectItem, Tile } from '@carbon/react'
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
import { MapaDeButacas, type ButacaDibujable } from '../MapaDeButacas.js'

const INTERVALO_SONDEO_MS = 3000

/**
 * La venta presencial (RF-12): el mismo mapa que internet, con el detalle real
 * de cada butaca (RN-57), y una categoría de precio por butaca. En una función
 * de miércoles no se pregunta nada: la única categoría es miércoles (RN-14,
 * CA-3). Las butacas pasan de libres a vendidas sin bloqueo intermedio
 * (RN-20); eso lo resuelve el servidor.
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

  async function cobrar() {
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
  }

  const etiquetaDe = (butacaId: number): string =>
    datos?.mapa.find((butaca) => butaca.butacaId === butacaId)?.etiqueta ?? String(butacaId)

  return (
    <div>
      <Select
        id="funcion-de-taquilla"
        labelText="Función"
        value={funcionId ?? ''}
        onChange={(evento) => setFuncionId(Number(evento.target.value))}
      >
        {funciones.length === 0 ? <SelectItem value="" text="No hay funciones en venta" /> : null}
        {funciones.map((funcion) => (
          <SelectItem
            key={funcion.funcionId}
            value={funcion.funcionId}
            text={`${funcion.pelicula} · ${funcion.sala} · ${formatearFecha(funcion.fecha)} ${funcion.horaInicio}`}
          />
        ))}
      </Select>

      {error !== null ? (
        <div role="alert" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification kind="error" title="No se pudo continuar" subtitle={error} hideCloseButton lowContrast />
        </div>
      ) : null}

      {confirmada !== null ? (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification
            kind="success"
            title={`Compra registrada · número ${confirmada.numero}`}
            subtitle={`Cobrar ${formatearColones(confirmada.montoTotal)}. Dictale el número a quien compró.`}
            hideCloseButton
          />
        </div>
      ) : null}

      {datos !== null ? (
        <div style={{ marginTop: '1.5rem' }}>
          {esMiercoles ? <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p> : null}
          <MapaDeButacas
            butacas={datos.mapa}
            butacasPorFila={datos.funcion.butacasPorFila}
            seleccionadas={new Set(elegidas.map((butaca) => butaca.butacaId))}
            onCambiarSeleccion={alternarButaca}
            onConsultarOcupada={setConsultada}
          />
        </div>
      ) : null}

      {consultada !== null ? (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <InlineNotification
            kind="info"
            title={`Butaca ${consultada.etiqueta} · ${consultada.estado}`}
            subtitle={
              consultada.numero != null
                ? `Número ${consultada.numero}. Buscalo en Reservas o en Compras.`
                : 'Alguien la está eligiendo por internet; se libera sola si no completa la compra.'
            }
            onCloseButtonClick={() => setConsultada(null)}
          />
        </div>
      ) : null}

      {elegidas.length > 0 ? (
        <Tile style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            {elegidas.length} butaca{elegidas.length > 1 ? 's' : ''} · {formatearColones(total)}
          </h2>
          {esMiercoles ? (
            <p style={{ marginBottom: '0.75rem' }}>
              En miércoles toda entrada va a la mitad del precio general y no se pide carné (RN-14).
            </p>
          ) : (
            <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', padding: 0, margin: 0 }}>
              {elegidas.map((butaca) => (
                <li key={butaca.butacaId} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem' }}>
                  <Select
                    id={`categoria-${butaca.butacaId}`}
                    labelText={`Butaca ${etiquetaDe(butaca.butacaId)}`}
                    value={butaca.categoria}
                    onChange={(evento) =>
                      cambiarCategoria(butaca.butacaId, evento.target.value as CategoriaPrecio)
                    }
                  >
                    <SelectItem value="general" text={`General · ${formatearColones(precioDe('general'))}`} />
                    <SelectItem
                      value="estudiante"
                      text={`Estudiante (con carné) · ${formatearColones(precioDe('estudiante'))}`}
                    />
                  </Select>
                </li>
              ))}
            </ul>
          )}
          <Button style={{ marginTop: '1rem' }} disabled={cobrando} onClick={cobrar}>
            {cobrando ? 'Registrando…' : `Cobrar ${formatearColones(total)} y registrar`}
          </Button>
        </Tile>
      ) : null}
    </div>
  )
}
