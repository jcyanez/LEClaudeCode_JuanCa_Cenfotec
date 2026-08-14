import {
  Button,
  InlineNotification,
  Modal,
  NumberInput,
  Select,
  SelectItem,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react'
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
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {error !== null ? (
        <div role="alert" aria-live="polite">
          <InlineNotification kind="error" title="No se pudo" subtitle={error} hideCloseButton />
        </div>
      ) : null}
      {aviso !== null ? (
        <div role="status" aria-live="polite">
          <InlineNotification kind="success" title="Listo" subtitle={aviso} onCloseButtonClick={() => setAviso(null)} />
        </div>
      ) : null}

      <Tile>
        <h2 style={{ fontSize: '1rem' }}>Películas</h2>
        <form onSubmit={agregarPelicula} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <TextInput
            id="titulo-pelicula"
            labelText="Título"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
          />
          <NumberInput
            id="duracion-pelicula"
            label="Duración (minutos)"
            min={1}
            value={duracion}
            onChange={(_evento, estado) => setDuracion(Number(estado.value))}
          />
          <Button type="submit" disabled={titulo.trim() === ''}>
            Registrar película
          </Button>
        </form>
        <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
          {peliculas.map((pelicula) => (
            <li key={pelicula.id}>
              {pelicula.titulo} · {pelicula.duracionMinutos} min
            </li>
          ))}
        </ul>
      </Tile>

      <Tile>
        <h2 style={{ fontSize: '1rem' }}>Semanas de cartelera</h2>
        <form onSubmit={agregarSemana} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <TextInput
            id="jueves-semana"
            labelText="Jueves en que empieza"
            placeholder="AAAA-MM-DD"
            helperText="Una semana va de jueves a miércoles (RN-3); solo la en curso y la siguiente (RN-8)."
            value={juevesInicio}
            onChange={(evento) => setJuevesInicio(evento.target.value)}
          />
          <Button type="submit" disabled={juevesInicio.trim() === ''}>
            Cargar semana
          </Button>
        </form>
        <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
          {semanas.map((semana) => (
            <li key={semana.semanaId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button
                kind={semana.semanaId === semanaId ? 'tertiary' : 'ghost'}
                size="sm"
                onClick={() => setSemanaId(semana.semanaId)}
              >
                Jueves {semana.juevesInicio}
              </Button>
              <span>
                {semana.funciones} función{semana.funciones === 1 ? '' : 'es'}
              </span>
              {semana.abiertaAVenta ? (
                <Tag type="green">En venta</Tag>
              ) : (
                <Button size="sm" onClick={() => abrirVenta(semana)}>
                  Dar por cargada y abrir la venta
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Tile>

      {semanaId !== null ? (
        <Tile>
          <h2 style={{ fontSize: '1rem' }}>Funciones de la semana</h2>
          <form onSubmit={agregarFuncion} style={{ display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Select
              id="pelicula-de-funcion"
              labelText="Película"
              value={nueva.peliculaId}
              onChange={(evento) => setNueva({ ...nueva, peliculaId: Number(evento.target.value) })}
            >
              <SelectItem value={0} text="Elegí una película" />
              {peliculas.map((pelicula) => (
                <SelectItem key={pelicula.id} value={pelicula.id} text={pelicula.titulo} />
              ))}
            </Select>
            <Select
              id="sala-de-funcion"
              labelText="Sala"
              value={nueva.salaId}
              onChange={(evento) => setNueva({ ...nueva, salaId: Number(evento.target.value) })}
            >
              {SALAS.map((sala) => (
                <SelectItem key={sala.id} value={sala.id} text={sala.nombre} />
              ))}
            </Select>
            <TextInput
              id="fecha-de-funcion"
              labelText="Fecha"
              placeholder="AAAA-MM-DD"
              value={nueva.fecha}
              onChange={(evento) => setNueva({ ...nueva, fecha: evento.target.value })}
            />
            <TextInput
              id="hora-de-funcion"
              labelText="Hora de inicio"
              placeholder="HH:MM"
              value={nueva.horaInicio}
              onChange={(evento) => setNueva({ ...nueva, horaInicio: evento.target.value })}
            />
            <Button type="submit" disabled={nueva.peliculaId === 0 || nueva.fecha.trim() === ''}>
              Programar función
            </Button>
          </form>

          <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
            <caption className="cds--visually-hidden">Funciones de la semana elegida</caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>Fecha</th>
                <th scope="col" style={{ textAlign: 'left' }}>Hora</th>
                <th scope="col" style={{ textAlign: 'left' }}>Película</th>
                <th scope="col" style={{ textAlign: 'left' }}>Sala</th>
                <th scope="col" style={{ textAlign: 'left' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {funciones.map((funcion) => (
                <tr key={funcion.funcionId}>
                  <td>{formatearFecha(funcion.fecha)}</td>
                  <td>{funcion.horaInicio}</td>
                  <td>{funcion.pelicula}</td>
                  <td>{funcion.sala}</td>
                  <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {funcion.cancelada ? (
                      <Tag type="red">Cancelada</Tag>
                    ) : (
                      <>
                        <Button kind="ghost" size="sm" onClick={() => quitar(funcion)}>
                          Eliminar
                        </Button>
                        <Button kind="danger--ghost" size="sm" onClick={() => setACancelar(funcion)}>
                          Cancelar función
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      ) : null}

      <Modal
        open={aCancelar !== null}
        danger
        modalHeading="Cancelar la función"
        modalLabel={aCancelar === null ? '' : `${aCancelar.pelicula} · ${aCancelar.fecha} ${aCancelar.horaInicio}`}
        primaryButtonText="Cancelar la función"
        secondaryButtonText="Volver"
        primaryButtonDisabled={motivo.trim() === ''}
        onRequestClose={() => setACancelar(null)}
        onSecondarySubmit={() => setACancelar(null)}
        onRequestSubmit={cancelar}
      >
        <p style={{ marginBottom: '1rem' }}>
          Todas sus compras quedan devueltas de una sola vez, hayan pasado por la puerta o no, y se le avisa por
          correo a quien compró por internet (RN-41, RF-24). Solo se puede hasta el final de la jornada de la
          función (RN-42).
        </p>
        <TextInput
          id="motivo-de-cancelacion"
          labelText="Motivo"
          helperText="Queda registrado con tu nombre y la hora (REG-4)."
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </Modal>
    </div>
  )
}
