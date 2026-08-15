import { useEffect, useState } from 'react'
import { esErrorDeApi, obtenerCartelera, type FuncionEnCartelera } from '../api/cliente.js'
import { Aviso, Cargando, TarjetaEnlace } from '../componentes/base/index.js'
import { ETIQUETA_MIERCOLES, formatearColones, formatearFecha } from '../utilidades/formato.js'

function textoDePrecios(funcion: FuncionEnCartelera): string {
  if (funcion.categoriaBase === 'miercoles') {
    return `${formatearColones(funcion.precios.miercoles ?? 0)} general`
  }
  return `${formatearColones(funcion.precios.general ?? 0)} general · ${formatearColones(funcion.precios.estudiante ?? 0)} estudiante`
}

/** La cartelera pública: cualquiera la ve sin identificarse (RF-8, RN-55). */
export function Cartelera() {
  const [funciones, setFunciones] = useState<FuncionEnCartelera[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerCartelera()
      .then(setFunciones)
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar la cartelera'))
  }, [])

  if (error !== null) {
    return <Aviso tono="error" titulo="No se pudo cargar" detalle={error} />
  }
  if (funciones === null) {
    return <Cargando descripcion="Cargando cartelera…" />
  }

  return (
    <div className="pagina">
      <header className="pagina__encabezado">
        <p className="pagina__marca">Cine Variedades</p>
        <h1 className="pagina__titulo">Cartelera</h1>
      </header>

      {funciones.length === 0 ? (
        <Aviso tono="informacion" titulo="No hay funciones en venta por ahora" detalle="Volvé a mirar cuando se cargue la semana." />
      ) : (
        <ul className="cartelera">
          {funciones.map((funcion) => (
            <li key={funcion.funcionId}>
              <TarjetaEnlace href={`/funciones/${funcion.funcionId}`}>
                <h2 className="cartelera__pelicula">{funcion.pelicula}</h2>
                <p className="cartelera__cuando">
                  {formatearFecha(funcion.fecha)} · {funcion.horaInicio} · {funcion.sala}
                </p>
                {funcion.categoriaBase === 'miercoles' ? (
                  <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p>
                ) : null}
                <p className="cartelera__precios">{textoDePrecios(funcion)}</p>
              </TarjetaEnlace>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
