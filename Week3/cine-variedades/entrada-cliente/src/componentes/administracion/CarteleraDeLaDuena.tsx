import { useCallback, useEffect, useState } from 'react'
import {
  abrirVentaDeSemana,
  cancelarFuncion,
  crearSemana,
  eliminarFuncion,
  esErrorDeApi,
  obtenerFuncionesDeSemana,
  obtenerPeliculas,
  obtenerSemanas,
  programarFuncion,
  registrarPelicula,
  type FuncionAdministrable,
  type Pelicula,
  type SemanaCargada,
} from '../../api/cliente.js'
import { formatearFecha } from '../../utilidades/formato.js'
import {
  Aviso,
  Boton,
  CampoDeFecha,
  CampoDeTexto,
  CampoNumerico,
  Etiqueta,
  Modal,
  Selector,
  Tarjeta,
} from '../base/index.js'
import './administracion.scss'

const SALAS = [
  { id: 1, nombre: 'Sala 1' },
  { id: 2, nombre: 'Sala 2' },
]

/**
 * La carga de la cartelera (RF-1 a RF-5): películas con su duración, semanas
 * de jueves a miércoles y sus funciones, con la apertura de venta como paso
 * explícito (RN-9). El margen de 20 minutos lo arbitra Cartelera: acá solo se
 * muestra el mensaje que devuelve, que dice con cuál choca y la primera hora
 * posible (RF-3, CA-7). Cancelar una función devuelve todas sus compras de
 * una sola vez (RF-23) y por eso pide confirmación y motivo.
 *
 * Se reparte en dos columnas siguiendo el orden real del trabajo: a la
 * izquierda lo que se carga una vez —películas y semanas—, a la derecha las
 * funciones de la semana elegida, que es donde se pasa el rato.
 */
export function CarteleraDeLaDuena() {
  const [peliculas, setPeliculas] = useState<Pelicula[]>([])
  const [semanas, setSemanas] = useState<SemanaCargada[]>([])
  const [semanaId, setSemanaId] = useState<number | null>(null)
  const [funciones, setFunciones] = useState<FuncionAdministrable[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [duracion, setDuracion] = useState(120)
  const [juevesInicio, setJuevesInicio] = useState('')
  const [nueva, setNueva] = useState({ peliculaId: 0, salaId: 1, fecha: '', horaInicio: '19:00' })
  const [aCancelar, setACancelar] = useState<FuncionAdministrable | null>(null)
  const [motivo, setMotivo] = useState('')

  const recargarSemanas = useCallback(() => {
    obtenerSemanas()
      .then((lista) => {
        setSemanas(lista)
        setSemanaId((actual) => actual ?? lista[0]?.semanaId ?? null)
      })
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las semanas'))
  }, [])

  const recargarFunciones = useCallback(() => {
    if (semanaId === null) return
    obtenerFuncionesDeSemana(semanaId)
      .then(setFunciones)
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las funciones'))
  }, [semanaId])

  useEffect(() => {
    obtenerPeliculas()
      .then(setPeliculas)
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar las películas'))
    recargarSemanas()
  }, [recargarSemanas])

  useEffect(recargarFunciones, [recargarFunciones])

  function fallo(error: unknown, porDefecto: string) {
    setError(esErrorDeApi(error) ? error.mensaje : porDefecto)
    setAviso(null)
  }

  async function agregarPelicula(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      await registrarPelicula(titulo, duracion)
      setPeliculas(await obtenerPeliculas())
      setTitulo('')
      setAviso(`Se registró «${titulo}».`)
    } catch (error) {
      fallo(error, 'No pudimos registrar la película')
    }
  }

  async function agregarSemana(evento: React.FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      const { semanaId: creada } = await crearSemana(juevesInicio)
      setJuevesInicio('')
      setSemanaId(creada)
      recargarSemanas()
      setAviso('Semana cargada. La venta se abre cuando la des por cargada.')
    } catch (error) {
      fallo(error, 'No pudimos cargar la semana')
    }
  }

  async function abrirVenta(semana: SemanaCargada) {
    setError(null)
    try {
      await abrirVentaDeSemana(semana.semanaId)
      recargarSemanas()
      setAviso(`Se abrió la venta de la semana del jueves ${semana.juevesInicio}.`)
    } catch (error) {
      fallo(error, 'No pudimos abrir la venta')
    }
  }

  async function agregarFuncion(evento: React.FormEvent) {
    evento.preventDefault()
    if (semanaId === null) return
    setError(null)
    try {
      await programarFuncion({ ...nueva, semanaId })
      recargarFunciones()
      recargarSemanas()
      setAviso('Función programada.')
    } catch (error) {
      fallo(error, 'No pudimos programar la función')
    }
  }

  async function quitar(funcion: FuncionAdministrable) {
    setError(null)
    try {
      await eliminarFuncion(funcion.funcionId)
      recargarFunciones()
      recargarSemanas()
      setAviso('Función eliminada.')
    } catch (error) {
      fallo(error, 'No pudimos eliminar la función')
    }
  }

  async function cancelar() {
    if (aCancelar === null) return
    setError(null)
    try {
      const devueltas = await cancelarFuncion(aCancelar.funcionId, motivo)
      setACancelar(null)
      setMotivo('')
      recargarFunciones()
      setAviso(
        `Función cancelada. ${devueltas.length} compra${devueltas.length === 1 ? '' : 's'} quedaron devueltas` +
          ' y se le avisó por correo a quien compró por internet.',
      )
    } catch (error) {
      setACancelar(null)
      fallo(error, 'No pudimos cancelar la función')
    }
  }

  return (
    <div className="panel">
      {error !== null ? <Aviso tono="error" titulo="No se pudo" detalle={error} /> : null}
      {aviso !== null ? <Aviso tono="exito" titulo="Listo" detalle={aviso} /> : null}

      <div className="cartelera-duena">
        <div className="cartelera-duena__semanas">
          <Tarjeta>
            <h2 className="panel__titulo">Películas</h2>
            <form onSubmit={agregarPelicula} className="panel__formulario">
              <CampoDeTexto
                id="titulo-pelicula"
                etiqueta="Título"
                value={titulo}
                onChange={(evento) => setTitulo(evento.target.value)}
              />
              <CampoNumerico
                id="duracion-pelicula"
                etiqueta="Duración (min)"
                min={1}
                value={duracion}
                onChange={(evento) => setDuracion(Number(evento.target.value))}
              />
              <Boton type="submit" disabled={titulo.trim() === ''}>
                Registrar
              </Boton>
            </form>
            <ul className="panel__lista">
              {peliculas.map((pelicula) => (
                <li key={pelicula.id}>
                  <span>{pelicula.titulo}</span>
                  <span className="cifra">{pelicula.duracionMinutos} min</span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta>
            <h2 className="panel__titulo">Semanas de cartelera</h2>
            <form onSubmit={agregarSemana} className="panel__formulario">
              <CampoDeFecha
                id="jueves-semana"
                etiqueta="Jueves en que empieza"
                ayuda="De jueves a miércoles; solo la en curso y la siguiente."
                value={juevesInicio}
                onChange={(evento) => setJuevesInicio(evento.target.value)}
              />
              <Boton type="submit" disabled={juevesInicio.trim() === ''}>
                Cargar semana
              </Boton>
            </form>
            <ul className="panel__lista">
              {semanas.map((semana) => (
                <li key={semana.semanaId}>
                  <Boton
                    variante={semana.semanaId === semanaId ? 'secundario' : 'fantasma'}
                    onClick={() => setSemanaId(semana.semanaId)}
                  >
                    Jueves <span className="cifra">{semana.juevesInicio}</span>
                  </Boton>
                  <span className="cifra">
                    {semana.funciones} función{semana.funciones === 1 ? '' : 'es'}
                  </span>
                  {semana.abiertaAVenta ? (
                    <Etiqueta tono="exito">En venta</Etiqueta>
                  ) : (
                    <Boton onClick={() => abrirVenta(semana)}>Abrir la venta</Boton>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>

        <div className="cartelera-duena__funciones">
          {semanaId !== null ? (
            <Tarjeta>
              <h2 className="panel__titulo">Funciones de la semana</h2>
              <form onSubmit={agregarFuncion} className="panel__formulario">
                <Selector
                  id="pelicula-de-funcion"
                  etiqueta="Película"
                  value={nueva.peliculaId}
                  onChange={(evento) => setNueva({ ...nueva, peliculaId: Number(evento.target.value) })}
                >
                  <option value={0}>Elegí una película</option>
                  {peliculas.map((pelicula) => (
                    <option key={pelicula.id} value={pelicula.id}>
                      {pelicula.titulo}
                    </option>
                  ))}
                </Selector>
                <Selector
                  id="sala-de-funcion"
                  etiqueta="Sala"
                  value={nueva.salaId}
                  onChange={(evento) => setNueva({ ...nueva, salaId: Number(evento.target.value) })}
                >
                  {SALAS.map((sala) => (
                    <option key={sala.id} value={sala.id}>
                      {sala.nombre}
                    </option>
                  ))}
                </Selector>
                <CampoDeFecha
                  id="fecha-de-funcion"
                  etiqueta="Fecha"
                  value={nueva.fecha}
                  onChange={(evento) => setNueva({ ...nueva, fecha: evento.target.value })}
                />
                <CampoDeTexto
                  id="hora-de-funcion"
                  etiqueta="Hora de inicio"
                  type="time"
                  className="cifra"
                  value={nueva.horaInicio}
                  onChange={(evento) => setNueva({ ...nueva, horaInicio: evento.target.value })}
                />
                <Boton type="submit" disabled={nueva.peliculaId === 0 || nueva.fecha.trim() === ''}>
                  Programar función
                </Boton>
              </form>

              <div className="tabla-caja">
                <table className="tabla">
                  <caption className="solo-lectores">Funciones de la semana elegida</caption>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Hora</th>
                      <th scope="col">Película</th>
                      <th scope="col">Sala</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funciones.map((funcion) => (
                      <tr key={funcion.funcionId}>
                        <td>{formatearFecha(funcion.fecha)}</td>
                        <td className="cifra">{funcion.horaInicio}</td>
                        <td>{funcion.pelicula}</td>
                        <td>{funcion.sala}</td>
                        <td>
                          {funcion.cancelada ? (
                            <Etiqueta tono="alerta">Cancelada</Etiqueta>
                          ) : (
                            <span className="trabajo__acciones">
                              <Boton variante="fantasma" onClick={() => quitar(funcion)}>
                                Eliminar
                              </Boton>
                              <Boton variante="peligro" onClick={() => setACancelar(funcion)}>
                                Cancelar función
                              </Boton>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          ) : null}
        </div>
      </div>

      <Modal
        titulo="Cancelar la función"
        abierto={aCancelar !== null}
        onCerrar={() => setACancelar(null)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setACancelar(null)}>
              Volver
            </Boton>
            <Boton variante="peligro" disabled={motivo.trim() === ''} onClick={cancelar}>
              Cancelar la función
            </Boton>
          </>
        }
      >
        {aCancelar !== null ? (
          <p className="panel__nota">
            {aCancelar.pelicula} · {aCancelar.fecha} {aCancelar.horaInicio}
          </p>
        ) : null}
        <p>
          Todas sus compras quedan devueltas de una sola vez, hayan pasado por la puerta o no, y se le avisa por
          correo a quien compró por internet. Solo se puede hasta el final de la jornada de la función.
        </p>
        <CampoDeTexto
          id="motivo-de-cancelacion"
          etiqueta="Motivo"
          ayuda="Queda registrado con tu nombre y la hora."
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </Modal>
    </div>
  )
}
