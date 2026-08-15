/**
 * El póster de una película, con su respaldo para cuando no hay imagen.
 *
 * Reglas que cumple, todas de la prioridad 3 de `ui-ux-pro-max`:
 *
 * - **La caja tiene alto antes de que la imagen cargue.** `aspect-ratio` más
 *   `width`/`height` declarados: la tarjeta no salta cuando entra el póster.
 * - **Se sirve WebP**, no el PNG original de 2,6 MB. Se probó también AVIF y
 *   salía más pesado que WebP en las tres, así que habría servido el archivo
 *   grande: se descartó.
 * - **`loading="lazy"` en la rejilla**, porque casi ninguna tarjeta se ve al
 *   entrar. El hero manda `prioritario` y carga de una.
 *
 * Y una que es de la prioridad 1: **nunca aparece el icono roto del navegador**.
 * Si la película no tiene ficha, o si el archivo falla al cargar, se dibuja un
 * respaldo con el mismo tamaño y el texto «Sin póster».
 */
import { useState } from 'react'
import { fichaDe, PROPORCION_POSTER } from './posters.js'

interface Props {
  titulo: string
  /** El del hero carga de inmediato; los de la rejilla, al acercarse. */
  prioritario?: boolean
  className?: string
}

export function Poster({ titulo, prioritario = false, className }: Props) {
  const ficha = fichaDe(titulo)
  const [fallo, setFallo] = useState(false)
  const clases = className === undefined ? 'poster' : `poster ${className}`

  if (ficha === null || fallo) {
    return (
      <div className={`${clases} poster--sin-imagen`} style={{ aspectRatio: PROPORCION_POSTER }}>
        {/* Decorativo: el texto de al lado ya dice lo mismo. */}
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m4 17 5-5 4 4 3-3 4 4" />
          <circle cx="9" cy="9" r="1.4" />
        </svg>
        <span className="poster__aviso">Sin póster</span>
      </div>
    )
  }

  return (
    <img
      className={clases}
      src={`${ficha.poster}-320.webp`}
      srcSet={`${ficha.poster}-320.webp 320w, ${ficha.poster}-640.webp 640w`}
      /* Cuánto mide el cartel en pantalla, para que el navegador elija bien
         entre 320 y 640. Tiene que seguir a la rejilla de `cartelera.scss`: a
         partir de 64 rem son tres columnas dentro de 84 rem, o sea unos 26 rem
         por cartel. Si acá dijera menos, se serviría la imagen chica estirada
         y se vería blanda. */
      sizes="(min-width: 64rem) 26rem, (min-width: 30rem) 45vw, 92vw"
      width={320}
      height={480}
      alt={`Póster de ${titulo}`}
      loading={prioritario ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFallo(true)}
    />
  )
}
