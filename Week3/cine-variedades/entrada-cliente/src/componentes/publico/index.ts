/**
 * Las piezas de las pantallas del comprador. Todas se pintan con los tokens de
 * `tokens.scss`: no hay ni un color ni un tamaño escrito a mano acá adentro.
 */
export {
  agruparPorPelicula,
  etiquetaDeDia,
  fechaInicial,
  fechaLocalDeHoy,
  fechasDisponibles,
  funcionDestacada,
  salasDisponibles,
  textoDePrecios,
  type PeliculaEnCartelera,
} from './agrupar.js'
export { FuncionDestacada } from './destacada.js'
export { FiltroDeSala, SelectorDeFecha, TODAS_LAS_SALAS } from './filtros.js'
export { Encabezado, PieDePagina } from './marco.js'
export { BotonDeHorario, InsigniaPromocion, RejillaDePeliculas, TarjetaDePelicula } from './peliculas.js'
export { Poster } from './Poster.js'
export { fichaDe, type FichaDePelicula } from './posters.js'
