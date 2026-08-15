/**
 * El marco de las pantallas del comprador: la barra de marca arriba y el pie
 * abajo. Va en las dos rutas públicas, así que la marca y las promesas del
 * cine se ven igual en la cartelera y en la pantalla de una función.
 *
 * El encabezado **no lleva menú**. Un cine de dos salas tiene dos pantallas
 * públicas —la cartelera y una función—, y una barra con enlaces que no van a
 * ningún lado es decoración que promete lo que no existe. Lo que sí hay es el
 * camino de vuelta: el logo es un enlace a la cartelera.
 */
import { Link } from 'react-router-dom'
import { IconoEntrada, IconoPantalla, IconoReloj } from './iconos.js'
import './cartelera.scss'

export function Encabezado() {
  return (
    <header className="marco-superior">
      <div className="marco-superior__interior">
        <Link className="marco-superior__marca" to="/">
          <picture>
            <source
              type="image/avif"
              srcSet="/marca-320.avif 320w, /marca-640.avif 640w"
              sizes="(min-width: 48rem) 13rem, 9.5rem"
            />
            <source
              type="image/webp"
              srcSet="/marca-320.webp 320w, /marca-640.webp 640w"
              sizes="(min-width: 48rem) 13rem, 9.5rem"
            />
            <img
              className="marco-superior__logo"
              src="/marca-320.webp"
              width={320}
              height={213}
              alt="Cine Variedades"
            />
          </picture>
        </Link>
        {/* El eslogan de la marca, el mismo que acompaña al logo. */}
        <p className="marco-superior__lema">Más que cine, grandes historias</p>
      </div>
    </header>
  )
}

/**
 * Las tres promesas del pie son las tres que este sistema cumple de verdad:
 * elegir butaca (`RF-9`), el miércoles a mitad de precio (`RN-13`) y el precio
 * de estudiante (`RN-31`). No hay programa de puntos ni dulcería que anunciar.
 */
export function PieDePagina() {
  /* El año se calcula, no se escribe: un «2026» fijo envejece solo el 1 de
     enero y nadie se acuerda de volver acá a cambiarlo. */
  const año = new Date().getFullYear()

  return (
    <footer className="marco-inferior">
      <ul className="marco-inferior__promesas">
        <li className="promesa">
          <IconoPantalla className="promesa__icono" />
          <span className="promesa__titulo">Elegí tu butaca</span>
          <span className="promesa__detalle">El mapa de la sala, desde el teléfono</span>
        </li>
        <li className="promesa">
          <IconoEntrada className="promesa__icono" />
          <span className="promesa__titulo">Miércoles a mitad de precio</span>
          <span className="promesa__detalle">Todas las funciones, sin carné</span>
        </li>
        <li className="promesa">
          <IconoReloj className="promesa__icono" />
          <span className="promesa__titulo">Precio de estudiante</span>
          <span className="promesa__detalle">Reservás acá y pagás en taquilla con el carné</span>
        </li>
      </ul>

      <div className="marco-inferior__base">
        <p className="marco-inferior__firma">© {año} Cine Variedades</p>
        <p className="marco-inferior__credito">
          Empowered by <span className="marco-inferior__autor">JuanCa</span>
        </p>
      </div>
    </footer>
  )
}
