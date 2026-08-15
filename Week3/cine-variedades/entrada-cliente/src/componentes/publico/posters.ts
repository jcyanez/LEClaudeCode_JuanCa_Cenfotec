/**
 * El póster y el género de cada película, por título.
 *
 * **Esto es deuda, y conviene que se lea como deuda.** El póster y el género
 * son datos del negocio: `Película` en `ESPECIFICACION.md` es título y duración
 * (`RN-4`), y nada más. Lo correcto sería que vivieran en la base y viajaran
 * por la API, para que la dueña cargue el póster de una película nueva desde su
 * pantalla (`RF-1`). Se eligió a propósito la vía corta —un mapa en la
 * interfaz— porque no toca la base, ni la API, ni los documentos de diseño.
 *
 * Lo que cuesta, escrito para que nadie se sorprenda después:
 *
 * - Agregar una cuarta película exige **editar este archivo y desplegar**. No
 *   alcanza con cargarla en administración: aparecerá en la cartelera, pero sin
 *   póster y sin género.
 * - La clave es el **título exacto**. Si alguien renombra una película desde la
 *   pantalla de la dueña, acá deja de coincidir y esa película pierde el póster.
 *   No se rompe nada —hay respaldo para ese caso—, pero se ve peor.
 *
 * El día que el póster pase a la base, este archivo se borra entero y
 * `fichaDe` se reemplaza por un campo de `FuncionEnCartelera`.
 *
 * Los archivos son derivados WebP de los originales, que viven fuera de
 * `public/` —en `Week3/carteles-originales/`— para que no viajen enteros al
 * empaquetado. Cómo se regeneran está en el README.
 */

export interface FichaDePelicula {
  /** Ruta base del derivado, sin el sufijo de ancho ni la extensión. */
  poster: string
  genero: string
}

const FICHAS: Record<string, FichaDePelicula> = {
  'Tiempos modernos': { poster: '/cartelera/tiempos-modernos', genero: 'Comedia' },
  'El resplandor': { poster: '/cartelera/el-resplandor', genero: 'Ciencia ficción' },
  'Ventana indiscreta': { poster: '/cartelera/ventana-indiscreta', genero: 'Terror · Suspenso' },
}

/** La ficha de una película, o `null` si no tiene. Nunca lanza. */
export function fichaDe(titulo: string): FichaDePelicula | null {
  return FICHAS[titulo] ?? null
}

/** Los dos anchos generados de cada póster: 1× y 2×. */
export const ANCHOS_DE_POSTER = [320, 640] as const

/** Proporción de cartel de cine. Fija el alto de la caja antes de que cargue la imagen. */
export const PROPORCION_POSTER = '2 / 3'
