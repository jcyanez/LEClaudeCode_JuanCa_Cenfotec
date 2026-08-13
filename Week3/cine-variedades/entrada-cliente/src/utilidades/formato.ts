/** Colones sin decimales, con espacio como separador de miles (decisión del usuario, T19): ₡8 000. */
export function formatearColones(monto: number): string {
  const entero = Math.trunc(monto).toString()
  const conEspacios = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `₡${conEspacios}`
}

export const ETIQUETA_MIERCOLES = 'MIÉRCOLES ½ PRECIO'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «viernes 14 de agosto», a partir de una fecha `AAAA-MM-DD`. */
export function formatearFecha(fecha: string): string {
  const [año, mes, dia] = fecha.split('-').map(Number)
  const fechaUtc = new Date(Date.UTC(año ?? 0, (mes ?? 1) - 1, dia ?? 1))
  const nombreDia = DIAS[fechaUtc.getUTCDay()]
  return `${nombreDia} ${fechaUtc.getUTCDate()} de ${fechaUtc.toLocaleDateString('es-CR', { month: 'long', timeZone: 'UTC' })}`
}
