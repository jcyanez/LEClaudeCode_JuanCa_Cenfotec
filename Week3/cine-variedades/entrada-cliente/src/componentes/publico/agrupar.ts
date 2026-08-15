/**
 * La lógica de la cartelera pública, separada de las pantallas para poder
 * probarla sola: agrupar, filtrar y rotular.
 *
 * El cambio de fondo respecto de T19 es **agrupar por película**. Antes cada
 * función era una tarjeta, así que «Ventana indiscreta» aparecía cuatro
 * veces el mismo día. Eso es la forma de la tabla, no la de la decisión: quien
 * entra elige primero qué ver y después a qué hora. Una tarjeta por película,
 * con sus horarios como botones, es la misma información en el orden en que se
 * decide.
 *
 * No se inventa ningún dato: todo sale de `FuncionEnCartelera`, que es lo que
 * el servidor ya devuelve (`RF-8`).
 */
import type { FuncionEnCartelera } from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'

export interface PeliculaEnCartelera {
  pelicula: string
  /** Sus funciones del día elegido, ya ordenadas por hora. */
  funciones: FuncionEnCartelera[]
  /** Las salas donde se da ese día, sin repetir. */
  salas: string[]
  /** `RN-13`: ese día se vende a mitad de precio y sin categoría estudiante. */
  esMiercoles: boolean
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `AAAA-MM-DD` de hoy en hora local: el sistema vive en una sola zona horaria. */
export function fechaLocalDeHoy(ahora: Date = new Date()): string {
  const mes = `${ahora.getMonth() + 1}`.padStart(2, '0')
  const dia = `${ahora.getDate()}`.padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/** Los días con función, en orden y sin repetir. */
export function fechasDisponibles(funciones: FuncionEnCartelera[]): string[] {
  return [...new Set(funciones.map((funcion) => funcion.fecha))].sort()
}

/** Las salas con función, en orden y sin repetir. */
export function salasDisponibles(funciones: FuncionEnCartelera[]): string[] {
  return [...new Set(funciones.map((funcion) => funcion.sala))].sort()
}

export interface EtiquetaDeDia {
  /** «Hoy», «Mañana» o el día de la semana. */
  principal: string
  /** «14 ago», para que nadie tenga que contar días. */
  secundaria: string
  /** Lo que oye quien usa lector de pantalla, sin abreviaturas. */
  accesible: string
}

/**
 * Rotula un día relativo a hoy. «Hoy» y «Mañana» son las dos referencias que
 * alguien usa sin pensar; de ahí en adelante manda el día de la semana.
 */
export function etiquetaDeDia(fecha: string, hoy: string = fechaLocalDeHoy()): EtiquetaDeDia {
  const dias = diasDeDiferencia(hoy, fecha)
  const [, mes, dia] = fecha.split('-').map(Number)
  const secundaria = `${dia} ${MESES_CORTOS[(mes ?? 1) - 1]}`
  const nombreDia = DIAS_CORTOS[diaDeLaSemana(fecha)] ?? ''

  if (dias === 0) return { principal: 'Hoy', secundaria, accesible: `Hoy, ${secundaria}` }
  if (dias === 1) return { principal: 'Mañana', secundaria, accesible: `Mañana, ${secundaria}` }
  return { principal: nombreDia, secundaria, accesible: `${nombreDia} ${secundaria}` }
}

function aUtc(fecha: string): number {
  const [año, mes, dia] = fecha.split('-').map(Number)
  return Date.UTC(año ?? 0, (mes ?? 1) - 1, dia ?? 1)
}

function diasDeDiferencia(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000)
}

function diaDeLaSemana(fecha: string): number {
  return new Date(aUtc(fecha)).getUTCDay()
}

/**
 * El día que se muestra al entrar: hoy si hay funciones, y si no el primero
 * que tenga. Nunca una pantalla vacía habiendo cartelera cargada.
 */
export function fechaInicial(fechas: string[], hoy: string = fechaLocalDeHoy()): string | null {
  if (fechas.length === 0) return null
  return fechas.find((fecha) => fecha >= hoy) ?? fechas[0] ?? null
}

/** Una tarjeta por película, con sus horarios ordenados. */
export function agruparPorPelicula(funciones: FuncionEnCartelera[]): PeliculaEnCartelera[] {
  const porPelicula = new Map<string, FuncionEnCartelera[]>()
  for (const funcion of funciones) {
    const acumuladas = porPelicula.get(funcion.pelicula) ?? []
    acumuladas.push(funcion)
    porPelicula.set(funcion.pelicula, acumuladas)
  }

  return [...porPelicula.entries()]
    .map(([pelicula, suyas]) => {
      const ordenadas = [...suyas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      return {
        pelicula,
        funciones: ordenadas,
        salas: [...new Set(ordenadas.map((funcion) => funcion.sala))].sort(),
        esMiercoles: ordenadas.every((funcion) => funcion.categoriaBase === 'miercoles'),
      }
    })
    .sort((a, b) => {
      const primera = a.funciones[0]?.horaInicio ?? ''
      const segunda = b.funciones[0]?.horaInicio ?? ''
      return primera.localeCompare(segunda) || a.pelicula.localeCompare(b.pelicula)
    })
}

/** La función más próxima de toda la cartelera: la que encabeza la página. */
export function funcionDestacada(funciones: FuncionEnCartelera[]): FuncionEnCartelera | null {
  const ordenadas = [...funciones].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio),
  )
  return ordenadas[0] ?? null
}

/**
 * Los precios de una función, tal como se cobran. El miércoles no compite con
 * el precio de estudiante: lo reemplaza (`RN-13`, `RN-14`), así que ese día no
 * se nombra una categoría que no se puede comprar.
 */
export function textoDePrecios(funcion: FuncionEnCartelera): string {
  if (funcion.categoriaBase === 'miercoles') {
    return `${formatearColones(funcion.precios.miercoles ?? 0)} general`
  }
  const general = formatearColones(funcion.precios.general ?? 0)
  const estudiante = formatearColones(funcion.precios.estudiante ?? 0)
  return `${general} general · ${estudiante} estudiante`
}
