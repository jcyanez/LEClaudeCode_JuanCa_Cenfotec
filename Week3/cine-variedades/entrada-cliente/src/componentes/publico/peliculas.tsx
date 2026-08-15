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
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETA_MIERCOLES } from '../../utilidades/formato.js'
import type { PeliculaEnCartelera } from './agrupar.js'
import { textoDePrecios } from './agrupar.js'
import { IconoChevron } from './iconos.js'
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

/**
 * El recorrido de la tarjeta es en tres pasos: **el cartel se toca, aparecen
 * los horarios de esa película, se elige uno y eso lleva a las butacas.**
 *
 * Los horarios arrancan ocultos a propósito. Antes estaban siempre a la vista y
 * el cartel mostraba un rótulo «Ver horarios» que no llevaba a ninguna parte:
 * prometía algo que ya había pasado. Ahora el rótulo hace lo que dice.
 *
 * El costo está asumido: es **un toque más** para llegar a comprar. Se compensa
 * con que la función más próxima sigue teniendo su camino directo desde el
 * encabezado de la página, que es el que la mayoría va a usar.
 *
 * El disparador es el cartel entero, y es **un botón de verdad**: se opera con
 * teclado, anuncia si está abierto o cerrado con `aria-expanded`, y dice de qué
 * película se trata. Su rótulo se ve siempre, no solo al pasar el puntero — en
 * un teléfono no hay puntero, y un cartel que no se anuncia es una caja muda.
 */
export function TarjetaDePelicula({ pelicula }: TarjetaDePeliculaProps) {
  const [abierta, setAbierta] = useState(false)
  const idHorarios = useId()
  const primera = pelicula.funciones[0]
  const ficha = fichaDe(pelicula.pelicula)

  return (
    <article className={abierta ? 'pelicula pelicula--abierta' : 'pelicula'}>
      <button
        type="button"
        className="pelicula__cartel"
        aria-expanded={abierta}
        aria-controls={idHorarios}
        aria-label={`${abierta ? 'Ocultar' : 'Ver'} horarios de ${pelicula.pelicula}`}
        onClick={() => setAbierta((estaba) => !estaba)}
      >
        <Poster titulo={pelicula.pelicula} />
        <span className="pelicula__velo" aria-hidden="true" />
        <span className="pelicula__llamada" aria-hidden="true">
          {abierta ? 'Ocultar horarios' : 'Ver horarios'}
          <IconoChevron className="pelicula__chevron" />
        </span>
        {pelicula.esMiercoles ? <InsigniaPromocion /> : null}
      </button>

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

        {/* `hidden` y no una clase con `display:none`: así los horarios salen
            también del árbol de accesibilidad y del orden de tabulación, en vez
            de quedar invisibles pero alcanzables con el teclado. */}
        <div className="pelicula__horarios" id={idHorarios} hidden={!abierta}>
          <p className="pelicula__instruccion">Elegí una función</p>
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
