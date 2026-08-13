import type { Bd } from '../base/bd.js'

export interface CierreVentanilla {
  /** Cobrado en efectivo esa jornada, sin importar si después se anuló o devolvió (RN-16). */
  cobrado: number
  /** Devoluciones entregadas en efectivo esa misma jornada, sin importar cuándo se vendieron (RN-44). */
  devuelto: number
  efectivoEsperado: number
}

export interface CierreInternet {
  /** Informativo: no hay efectivo que contar por este canal (RN-46). */
  vendido: number
}

export interface CierreDeCaja {
  jornada: string
  ventanilla: CierreVentanilla
  internet: CierreInternet
}

function sumaMontoPorJornada(bd: Bd, canal: 'taquilla' | 'internet', jornada: string): number {
  const fila = bd
    .prepare(`SELECT COALESCE(SUM(monto_total), 0) AS total FROM compra WHERE canal = ? AND jornada = ?`)
    .get(canal, jornada) as { total: number }
  return fila.total
}

/**
 * El cierre de caja de una jornada, en sus dos partes (RN-46, RF-26): la de
 * ventanilla —lo que hay que contar y entregar— y la de internet, solo
 * informativa. Se calcula al vuelo sobre `compra` cada vez que se pide, sin
 * guardar una foto (decisión de DISENO.md): correr esto dos veces nunca
 * cambia nada, y nunca escribe. Las reservas no pueden sumar acá porque
 * viven en otra tabla (decisión del modelo) que este componente ni siquiera
 * consulta.
 *
 * El efectivo esperado resta las devoluciones **entregadas** en esta
 * jornada (`entrega_jornada`, RF-25), no las anuladas o canceladas en ella:
 * una compra cobrada hoy y devuelta en efectivo la semana próxima descuenta
 * la jornada de la entrega, no la de la venta (RN-44, CA-6, CA-8).
 */
export function cierreDeCaja(bd: Bd, jornada: string): CierreDeCaja {
  const cobrado = sumaMontoPorJornada(bd, 'taquilla', jornada)
  const devuelto = (
    bd
      .prepare(
        `SELECT COALESCE(SUM(monto_total), 0) AS total FROM compra
         WHERE canal = 'taquilla' AND entrega_jornada = ?`,
      )
      .get(jornada) as { total: number }
  ).total
  const vendidoInternet = sumaMontoPorJornada(bd, 'internet', jornada)

  return {
    jornada,
    ventanilla: { cobrado, devuelto, efectivoEsperado: cobrado - devuelto },
    internet: { vendido: vendidoInternet },
  }
}
