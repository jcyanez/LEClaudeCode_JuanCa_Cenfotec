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
import { Aviso, Boton, Cargando, Tarjeta } from '../componentes/base/index.js'
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
  /**
   * Dos errores distintos y separados a propósito: el de **cargar el mapa**,
   * que el propio sondeo corrige cuando vuelve a responder, y el de una
   * **operación** —un bloqueo o un pago rechazado—, que es un rechazo del
   * negocio y tiene que quedar a la vista hasta que la persona haga otra cosa.
   *
   * Con un solo estado, el sondeo cada 3 s borraba el rechazo apenas
   * respondía: el mensaje aparecía y desaparecía casi en el acto, contra lo
   * que pide la tabla de errores de `DISENO.md` («se informa qué pasó y qué
   * hacer, con el estado actual a la vista»).
   */
  const [errorDeCarga, setErrorDeCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())
  const [paso, setPaso] = useState<Paso>({ tipo: 'eligiendo' })
  const [enviando, setEnviando] = useState(false)

  const cargarMapa = useCallback(() => {
    obtenerMapa(funcionId)
      .then((respuesta) => {
        setDatos(respuesta)
        setErrorDeCarga(null)
      })
      .catch((error: unknown) => setErrorDeCarga(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar el mapa'))
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

  if (errorDeCarga !== null && datos === null) {
    return <Aviso tono="error" titulo="No se pudo cargar" detalle={errorDeCarga} />
  }
  if (datos === null) {
    return <Cargando descripcion="Cargando función…" />
  }

  const { funcion, mapa } = datos
  const eligiendoOFormulario = paso.tipo !== 'confirmado'

  return (
    <div className="pagina">
      <Boton variante="fantasma" onClick={() => navegar('/')}>
        ← Volver a la cartelera
      </Boton>

      <header className="pagina__encabezado">
        <h1 className="pagina__titulo">{funcion.pelicula}</h1>
        <p className="pagina__cuando">
          {formatearFecha(funcion.fecha)} · {funcion.horaInicio} · {funcion.sala}
        </p>
        {funcion.categoriaBase === 'miercoles' ? <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p> : null}
      </header>

      {error !== null ? <Aviso tono="error" titulo="No se pudo continuar" detalle={error} /> : null}

      {eligiendoOFormulario ? (
        <MapaDeButacas
          butacas={mapa}
          butacasPorFila={funcion.butacasPorFila}
          seleccionadas={seleccionadas}
          onCambiarSeleccion={paso.tipo === 'eligiendo' ? alternarButaca : () => undefined}
        />
      ) : null}

      {paso.tipo === 'eligiendo' && seleccionadas.size > 0 ? (
        <Tarjeta className="resumen">
          <p className="resumen__linea">
            {seleccionadas.size} butaca{seleccionadas.size > 1 ? 's' : ''} seleccionada
            {seleccionadas.size > 1 ? 's' : ''} · {formatearColones(precioDeCompra(datos) * seleccionadas.size)}
          </p>
          <div className="resumen__acciones">
            <Boton disabled={enviando} onClick={continuarConCompra}>
              Continuar a compra
            </Boton>
            {funcion.categoriaBase !== 'miercoles' ? (
              <Boton variante="secundario" disabled={enviando} onClick={() => setPaso({ tipo: 'contacto-reserva' })}>
                Reservar con carné de estudiante
              </Boton>
            ) : null}
          </div>
        </Tarjeta>
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
        <Tarjeta className="numero-confirmado">
          <p className="numero-confirmado__etiqueta">Tu número</p>
          <p className="numero-confirmado__numero">{paso.numero}</p>
          <p className="numero-confirmado__mensaje">{paso.mensaje}</p>
        </Tarjeta>
      ) : null}
    </div>
  )
}
