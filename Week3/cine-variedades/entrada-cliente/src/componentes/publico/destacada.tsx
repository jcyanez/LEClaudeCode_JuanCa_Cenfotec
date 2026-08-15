/**
 * La función que encabeza la cartelera: la más próxima de todas.
 *
 * El póster entra **como recurso visual, no como bloque**: ocupa la derecha del
 * panel y un degradado lo funde hacia la izquierda, donde vive el texto. Así
 * aporta la atmósfera de la película sin que el título, la hora y la llamada a
 * la acción pierdan legibilidad, que es lo único innegociable acá.
 *
 * Si la película no tiene póster vuelve el haz de proyector en SVG, que era el
 * recurso de antes justamente para este caso. El hero nunca se queda sin nada.
 */
import { Link } from 'react-router-dom'
import type { FuncionEnCartelera } from '../../api/cliente.js'
import { formatearFecha } from '../../utilidades/formato.js'
import { textoDePrecios } from './agrupar.js'
import { IconoFlecha, IconoPantalla, IconoReloj } from './iconos.js'
import { InsigniaPromocion } from './peliculas.js'
import { Poster } from './Poster.js'
import { fichaDe } from './posters.js'
import './cartelera.scss'

interface Props {
  funcion: FuncionEnCartelera
}

export function FuncionDestacada({ funcion }: Props) {
  const ficha = fichaDe(funcion.pelicula)

  return (
    <section className="destacada" aria-labelledby="destacada-titulo">
      {ficha === null ? (
        <Haz />
      ) : (
        /* `aria-hidden`: el póster no agrega nada que el texto de al lado no
           diga, y anunciarlo obligaría a oír «Póster de…» antes del título. */
        <div className="destacada__cartel" aria-hidden="true">
          <Poster titulo={funcion.pelicula} prioritario className="destacada__poster" />
          <div className="destacada__velo" />
        </div>
      )}

      <div className="destacada__contenido">
        <p className="destacada__eyebrow">Próxima función</p>
        <h1 className="destacada__titulo" id="destacada-titulo">
          {funcion.pelicula}
        </h1>

        {ficha === null ? null : <p className="destacada__genero">{ficha.genero}</p>}
        {funcion.categoriaBase === 'miercoles' ? <InsigniaPromocion /> : null}

        <ul className="destacada__datos">
          <li>
            <IconoReloj />
            <span>
              {formatearFecha(funcion.fecha)} · {funcion.horaInicio}
            </span>
          </li>
          <li>
            <IconoPantalla />
            <span>{funcion.sala}</span>
          </li>
        </ul>

        <p className="destacada__precios">{textoDePrecios(funcion)}</p>

        <Link className="destacada__accion" to={`/funciones/${funcion.funcionId}`}>
          Elegir butacas
          <IconoFlecha />
        </Link>
      </div>
    </section>
  )
}

/**
 * El haz del proyector, decorativo, para cuando no hay póster. Va en SVG y no
 * como imagen: pesa lo que pesa su marcado, escala sin perder filo y toma el
 * color del acento por `currentColor`.
 */
function Haz() {
  return (
    <svg className="destacada__haz" viewBox="0 0 320 200" aria-hidden="true" focusable="false" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <linearGradient id="haz-degradado" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="url(#haz-degradado)">
        <path d="M0 100 L320 18 L320 46 Z" />
        <path d="M0 100 L320 62 L320 84 Z" />
        <path d="M0 100 L320 116 L320 138 Z" />
        <path d="M0 100 L320 154 L320 182 Z" />
      </g>
      <circle cx="0" cy="100" r="5" fill="currentColor" opacity="0.7" />
    </svg>
  )
}
