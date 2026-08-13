import { Button, Column, Grid, InlineLoading, InlineNotification, Tile } from '@carbon/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  bloquearButacas,
  esErrorDeApi,
  obtenerMapa,
  pagar,
  reservar,
  type Bloqueo,
  type Contacto,
  type MapaDeFuncion,
} from '../api/cliente.js'
import { FormularioContacto } from '../componentes/FormularioContacto.js'
import { MapaDeButacas } from '../componentes/MapaDeButacas.js'
import { ETIQUETA_MIERCOLES, formatearColones, formatearFecha } from '../utilidades/formato.js'

const INTERVALO_SONDEO_MS = 3000

type Paso =
  | { tipo: 'eligiendo' }
  | { tipo: 'contacto-compra'; bloqueo: Bloqueo }
  | { tipo: 'contacto-reserva' }
  | { tipo: 'confirmado'; numero: string; mensaje: string }

function precioDeCompra(datos: MapaDeFuncion): number {
  return datos.funcion.categoriaBase === 'miercoles' ? datos.precios.miercoles ?? 0 : datos.precios.general ?? 0
}

/**
 * La función que se elige, con su mapa (RF-9). El flujo de bloqueo → pago
 * → número (RF-10, RF-11) y la reserva de estudiante (RF-14) viven acá.
 */
export function Funcion() {
  const parametros = useParams<{ id: string }>()
  const funcionId = Number(parametros.id)
  const navegar = useNavigate()

  const [datos, setDatos] = useState<MapaDeFuncion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())
  const [paso, setPaso] = useState<Paso>({ tipo: 'eligiendo' })
  const [enviando, setEnviando] = useState(false)

  const cargarMapa = useCallback(() => {
    obtenerMapa(funcionId)
      .then((respuesta) => {
        setDatos(respuesta)
        setError(null)
      })
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar el mapa'))
  }, [funcionId])

  useEffect(() => {
    cargarMapa()
  }, [cargarMapa])

  // Sondeo cada 3 segundos mientras el mapa está a la vista (T19); una vez
  // bloqueadas las butacas de esta persona, lo que le importa ya no cambia.
  useEffect(() => {
    if (paso.tipo !== 'eligiendo') return undefined
    const referencia = setInterval(cargarMapa, INTERVALO_SONDEO_MS)
    return () => clearInterval(referencia)
  }, [paso.tipo, cargarMapa])

  function alternarButaca(butacaId: number) {
    setSeleccionadas((anterior) => {
      const siguiente = new Set(anterior)
      if (siguiente.has(butacaId)) siguiente.delete(butacaId)
      else siguiente.add(butacaId)
      return siguiente
    })
  }

  async function continuarConCompra() {
    setEnviando(true)
    setError(null)
    try {
      const bloqueo = await bloquearButacas(funcionId, [...seleccionadas])
      setPaso({ tipo: 'contacto-compra', bloqueo })
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos bloquear las butacas')
      setSeleccionadas(new Set())
      cargarMapa()
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarCompra(contacto: Contacto) {
    setEnviando(true)
    setError(null)
    try {
      const compra = await pagar(funcionId, contacto)
      setPaso({
        tipo: 'confirmado',
        numero: compra.numero,
        mensaje: 'Tu compra quedó registrada. Mostrá este número en la puerta.',
      })
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos completar el pago')
      setPaso({ tipo: 'eligiendo' })
      setSeleccionadas(new Set())
      cargarMapa()
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarReserva(contacto: Contacto) {
    setEnviando(true)
    setError(null)
    try {
      const reserva = await reservar(funcionId, [...seleccionadas], contacto)
      setPaso({
        tipo: 'confirmado',
        numero: reserva.numero,
        mensaje: 'Tu reserva quedó registrada. Presentá tu carné en taquilla antes de que empiece la función.',
      })
    } catch (error) {
      setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos completar la reserva')
      setPaso({ tipo: 'eligiendo' })
      cargarMapa()
    } finally {
      setEnviando(false)
    }
  }

  if (error !== null && datos === null) {
    return <InlineNotification kind="error" title="No se pudo cargar" subtitle={error} hideCloseButton />
  }
  if (datos === null) {
    return <InlineLoading description="Cargando función…" />
  }

  const { funcion, mapa } = datos
  const eligiendoOFormulario = paso.tipo !== 'confirmado'

  return (
    <Grid>
      <Column sm={4} md={8} lg={12}>
        <Button kind="ghost" onClick={() => navegar('/')}>
          ← Volver a la cartelera
        </Button>
        <h1>{funcion.pelicula}</h1>
        <p>
          {funcion.sala} · {formatearFecha(funcion.fecha)} · {funcion.horaInicio}
        </p>
        {funcion.categoriaBase === 'miercoles' ? <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p> : null}

        {error !== null ? (
          <InlineNotification kind="error" title="No se pudo continuar" subtitle={error} hideCloseButton lowContrast />
        ) : null}

        {eligiendoOFormulario ? (
          <MapaDeButacas
            butacas={mapa}
            butacasPorFila={funcion.butacasPorFila}
            seleccionadas={seleccionadas}
            onCambiarSeleccion={paso.tipo === 'eligiendo' ? alternarButaca : () => undefined}
          />
        ) : null}

        {paso.tipo === 'eligiendo' && seleccionadas.size > 0 ? (
          <Tile>
            <p>
              {seleccionadas.size} butaca{seleccionadas.size > 1 ? 's' : ''} seleccionada
              {seleccionadas.size > 1 ? 's' : ''} · {formatearColones(precioDeCompra(datos) * seleccionadas.size)}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <Button disabled={enviando} onClick={continuarConCompra}>
                Continuar a compra
              </Button>
              {funcion.categoriaBase !== 'miercoles' ? (
                <Button kind="tertiary" disabled={enviando} onClick={() => setPaso({ tipo: 'contacto-reserva' })}>
                  Reservar con carné de estudiante
                </Button>
              ) : null}
            </div>
          </Tile>
        ) : null}

        {paso.tipo === 'contacto-compra' ? (
          <FormularioContacto
            titulo={`Confirmar compra · ${formatearColones(precioDeCompra(datos) * seleccionadas.size)}`}
            textoConfirmar="Pagar"
            enviando={enviando}
            onCancelar={() => {
              setPaso({ tipo: 'eligiendo' })
              setSeleccionadas(new Set())
              cargarMapa()
            }}
            onConfirmar={confirmarCompra}
          />
        ) : null}

        {paso.tipo === 'contacto-reserva' ? (
          <FormularioContacto
            titulo="Confirmar reserva de estudiante"
            textoConfirmar="Reservar"
            enviando={enviando}
            onCancelar={() => setPaso({ tipo: 'eligiendo' })}
            onConfirmar={confirmarReserva}
          />
        ) : null}

        {paso.tipo === 'confirmado' ? (
          <InlineNotification kind="success" title={`Número: ${paso.numero}`} subtitle={paso.mensaje} hideCloseButton />
        ) : null}
      </Column>
    </Grid>
  )
}
