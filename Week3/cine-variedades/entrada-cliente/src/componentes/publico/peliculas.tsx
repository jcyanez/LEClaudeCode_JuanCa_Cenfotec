/**
 * La rejilla de la cartelera: una tarjeta por película, con el póster arriba y
 * sus horarios abajo.
 *
 * El orden de lectura es **póster → título → información → horarios**, que es
 * el de una cartelera de cine: primero se reconoce la película por la imagen,
 * después se confirma con el texto y recién al final se elige la hora. Antes la
 * tarjeta era solo texto y había que leerla entera para saber qué era.
 *
 * Cada horario es un enlace a su función, no un botón que abre otra cosa: el
 * paso siguiente es elegir butacas, y conviene que se pueda abrir en otra
 * pestaña, copiar y compartir como cualquier dirección.
 */
import { Link } from 'react-router-dom'
import { ETIQUETA_MIERCOLES } from '../../utilidades/formato.js'
import type { PeliculaEnCartelera } from './agrupar.js'
import { textoDePrecios } from './agrupar.js'
import { Poster } from './Poster.js'
import { fichaDe } from './posters.js'
import './cartelera.scss'

/** La única promoción que el sistema tiene: el miércoles (`RN-13`). */
export function InsigniaPromocion() {
  return <span className="insignia">{ETIQUETA_MIERCOLES}</span>
}

interface BotonDeHorarioProps {
  funcionId: number
  hora: string
  pelicula: string
  sala: string
}

/**
 * Un horario. El nombre accesible dice película, hora y sala completas, porque
 * «19:00» suelto no le sirve a nadie que navegue saltando de enlace en enlace.
 * El alto mínimo es el objetivo táctil de 44 px que la prioridad 2 de la skill
 * vuelve innegociable.
 */
export function BotonDeHorario({ funcionId, hora, pelicula, sala }: BotonDeHorarioProps) {
  return (
    <Link className="horario" to={`/funciones/${funcionId}`} aria-label={`${pelicula}, ${hora}, ${sala}`}>
      {hora}
    </Link>
  )
}

interface TarjetaDePeliculaProps {
  pelicula: PeliculaEnCartelera
}

export function TarjetaDePelicula({ pelicula }: TarjetaDePeliculaProps) {
  const primera = pelicula.funciones[0]
  const ficha = fichaDe(pelicula.pelicula)

  return (
    <article className="pelicula">
      {/* El velo y su rótulo son puramente visuales: aparecen con el puntero y
          no dicen nada que no esté ya abajo, en botones que siempre se ven. Si
          fueran la única forma de llegar a los horarios, quien navega con
          teclado o con el dedo se quedaría afuera. */}
      <div className="pelicula__cartel">
        <Poster titulo={pelicula.pelicula} />
        <div className="pelicula__velo" aria-hidden="true">
          <span className="pelicula__velo-texto">Ver horarios</span>
        </div>
        {pelicula.esMiercoles ? <InsigniaPromocion /> : null}
      </div>

      <div className="pelicula__cuerpo">
        <h3 className="pelicula__titulo">{pelicula.pelicula}</h3>

        <p className="pelicula__meta">
          {ficha === null ? null : (
            <>
              <span className="pelicula__genero">{ficha.genero}</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          {pelicula.salas.join(' · ')}
        </p>

        {primera === undefined ? null : <p className="pelicula__precios">{textoDePrecios(primera)}</p>}

        <div className="pelicula__horarios">
          <h4 className="pelicula__rotulo">Horarios</h4>
          <ul className="pelicula__lista">
            {pelicula.funciones.map((funcion) => (
              <li key={funcion.funcionId}>
                <BotonDeHorario
                  funcionId={funcion.funcionId}
                  hora={funcion.horaInicio}
                  pelicula={pelicula.pelicula}
                  sala={funcion.sala}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

interface RejillaDePeliculasProps {
  peliculas: PeliculaEnCartelera[]
}

export function RejillaDePeliculas({ peliculas }: RejillaDePeliculasProps) {
  return (
    <ul className="rejilla">
      {peliculas.map((pelicula) => (
        <li key={pelicula.pelicula}>
          <TarjetaDePelicula pelicula={pelicula} />
        </li>
      ))}
    </ul>
  )
}
