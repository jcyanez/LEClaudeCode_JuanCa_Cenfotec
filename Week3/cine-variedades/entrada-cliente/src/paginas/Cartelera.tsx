import { useEffect, useMemo, useState } from 'react'
import { esErrorDeApi, obtenerCartelera, type FuncionEnCartelera } from '../api/cliente.js'
import { Aviso, Cargando } from '../componentes/base/index.js'
import {
  agruparPorPelicula,
  fechaInicial,
  fechaLocalDeHoy,
  fechasDisponibles,
  FiltroDeSala,
  funcionDestacada,
  FuncionDestacada,
  RejillaDePeliculas,
  salasDisponibles,
  SelectorDeFecha,
  TODAS_LAS_SALAS,
} from '../componentes/publico/index.js'
import { etiquetaDeDia } from '../componentes/publico/agrupar.js'

/**
 * La cartelera pública: cualquiera la ve sin identificarse (`RF-8`, `RN-55`).
 *
 * Se entra por la función más próxima, se elige un día y se ve una tarjeta por
 * película con sus horarios. Antes era una lista plana de funciones, que es la
 * forma de la tabla: la misma película aparecía tantas veces como horarios
 * tuviera. Los datos son exactamente los mismos; lo que cambió es el orden en
 * que se leen.
 */
export function Cartelera() {
  const [funciones, setFunciones] = useState<FuncionEnCartelera[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fechaElegida, setFechaElegida] = useState<string | null>(null)
  const [salaElegida, setSalaElegida] = useState<string>(TODAS_LAS_SALAS)

  const hoy = useMemo(() => fechaLocalDeHoy(), [])

  useEffect(() => {
    obtenerCartelera()
      .then((recibidas) => {
        setFunciones(recibidas)
        setFechaElegida(fechaInicial(fechasDisponibles(recibidas), hoy))
      })
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar la cartelera'))
  }, [hoy])

  if (error !== null) {
    return <Aviso tono="error" titulo="No se pudo cargar" detalle={error} />
  }
  if (funciones === null) {
    return <Cargando descripcion="Cargando cartelera…" />
  }

  if (funciones.length === 0) {
    return (
      <div className="pagina pagina--galeria">
        <h1 className="pagina__titulo">Cartelera</h1>
        <Aviso
          tono="informacion"
          titulo="No hay funciones en venta por ahora"
          detalle="Volvé a mirar cuando se cargue la semana."
        />
      </div>
    )
  }

  const fechas = fechasDisponibles(funciones)
  const salas = salasDisponibles(funciones)
  const destacada = funcionDestacada(funciones)

  const delDia = funciones.filter((funcion) => funcion.fecha === fechaElegida)
  const visibles = salaElegida === TODAS_LAS_SALAS ? delDia : delDia.filter((funcion) => funcion.sala === salaElegida)
  const peliculas = agruparPorPelicula(visibles)

  const diaVisible = fechaElegida === null ? '' : etiquetaDeDia(fechaElegida, hoy).accesible

  return (
    <div className="pagina pagina--galeria">
      {destacada === null ? null : <FuncionDestacada funcion={destacada} />}

      <div className="filtros">
        <SelectorDeFecha
          fechas={fechas}
          elegida={fechaElegida ?? ''}
          onElegir={setFechaElegida}
          hoy={hoy}
        />
        <FiltroDeSala salas={salas} elegida={salaElegida} onElegir={setSalaElegida} />
      </div>

      <section aria-live="polite">
        <h2 className="seccion__titulo">En cartelera · {diaVisible}</h2>

        {peliculas.length === 0 ? (
          <Aviso
            tono="informacion"
            titulo="No hay funciones con esos filtros"
            detalle="Probá con otro día o mirá todas las salas."
          />
        ) : (
          <RejillaDePeliculas peliculas={peliculas} />
        )}
      </section>
    </div>
  )
}
