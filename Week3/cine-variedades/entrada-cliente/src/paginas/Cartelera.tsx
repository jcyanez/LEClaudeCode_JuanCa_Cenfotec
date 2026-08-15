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
        {/* La marca aparece una sola vez, acá, que es la puerta de entrada del
            comprador. El original (1536×1024, 1,6 MB) no se sirve nunca: van
            derivados WebP y AVIF de 320 y 640 px, y el ancho y el alto
            declarados evitan el salto de maquetación (prioridad 3 de la skill
            `ui-ux-pro-max`: image-optimization e image-dimension). */}
        <picture className="pagina__marca">
          <source
            type="image/avif"
            srcSet="/marca-320.avif 320w, /marca-640.avif 640w"
            sizes="(min-width: 40rem) 18rem, 62vw"
          />
          <source
            type="image/webp"
            srcSet="/marca-320.webp 320w, /marca-640.webp 640w"
            sizes="(min-width: 40rem) 18rem, 62vw"
          />
          <img
            className="pagina__marca-imagen"
            src="/marca-320.webp"
            width={320}
            height={213}
            alt="Cine Variedades"
          />
        </picture>
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
