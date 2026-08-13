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

export interface DetalleFuncionReporte {
  funcionId: number
  pelicula: string
  sala: string
  fecha: string
  horaInicio: string
  cancelada: boolean
  entradasVendidas: number
  montoVendido: number
}

/**
 * El detalle función por función de un mes para el distribuidor (RF-27):
 * cuenta las entradas de compras `pagada` o `devuelta` —nunca las
 * `anulada`, que son correcciones que no llegaron a ser una venta real— y
 * marca las funciones canceladas, con sus entradas vendidas y devueltas a
 * la vista (RN-41, CA-5). `mes` en formato `AAAA-MM`.
 */
export function reporteMensual(bd: Bd, mes: string): DetalleFuncionReporte[] {
  const funciones = bd
    .prepare(
      `SELECT f.id AS funcionId, p.titulo AS pelicula, s.nombre AS sala, f.fecha,
              f.hora_inicio AS horaInicio, f.estado AS estado
       FROM funcion f
       JOIN pelicula p ON p.id = f.pelicula_id
       JOIN sala s ON s.id = f.sala_id
       WHERE f.fecha LIKE ? || '%'
       ORDER BY f.fecha, f.hora_inicio`,
    )
    .all(mes) as {
    funcionId: number
    pelicula: string
    sala: string
    fecha: string
    horaInicio: string
    estado: string
  }[]

  const entradasDe = bd.prepare(
    `SELECT COUNT(*) AS entradas, COALESCE(SUM(e.monto), 0) AS monto
     FROM entrada e JOIN compra c ON c.id = e.compra_id
     WHERE c.funcion_id = ? AND c.estado IN ('pagada', 'devuelta')`,
  )

  return funciones.map((funcion) => {
    const agregado = entradasDe.get(funcion.funcionId) as { entradas: number; monto: number }
    return {
      funcionId: funcion.funcionId,
      pelicula: funcion.pelicula,
      sala: funcion.sala,
      fecha: funcion.fecha,
      horaInicio: funcion.horaInicio,
      cancelada: funcion.estado === 'cancelada',
      entradasVendidas: agregado.entradas,
      montoVendido: agregado.monto,
    }
  })
}

function comoHojaDeCalculo(detalle: DetalleFuncionReporte[]): string {
  const filas = detalle.map((f) =>
    [f.fecha, f.horaInicio, f.sala, f.pelicula, f.cancelada ? 'cancelada' : 'programada', f.entradasVendidas, f.montoVendido].join(','),
  )
  return ['fecha,hora,sala,pelicula,estado,entradas,monto', ...filas].join('\n')
}

function comoResumen(mes: string, detalle: DetalleFuncionReporte[]): string {
  if (detalle.length === 0) return `No hubo funciones programadas en ${mes}.`
  const entradas = detalle.reduce((suma, f) => suma + f.entradasVendidas, 0)
  const monto = detalle.reduce((suma, f) => suma + f.montoVendido, 0)
  const canceladas = detalle.filter((f) => f.cancelada).length
  return (
    `Reporte de ${mes}: ${detalle.length} funciones, ${entradas} entradas, ${monto} céntimos` +
    (canceladas > 0 ? `, ${canceladas} canceladas` : '') +
    `. Detalle función por función en el adjunto.`
  )
}

export interface RegistroEnvioReporte {
  mes: string
  destinatario: string
  instante: string
  resultado: 'enviado' | 'fallido'
}

/**
 * Le entrega el reporte del mes al distribuidor: hoja de cálculo adjunta y
 * un resumen en el cuerpo (decisión de DISENO.md). Registra el resultado
 * del envío —salió o falló— con fecha y destinatario (REG-7, RF-28); si
 * falla, el intento fallido queda ahí, visible para que la dueña lo
 * reintente a mano llamando de nuevo (RF-28, RN-48).
 */
export async function enviarReporte(
  bd: Bd,
  enviar: (destinatario: string, asunto: string, cuerpo: string, adjunto: string) => Promise<boolean>,
  mes: string,
  destinatario: string,
  ahora: string,
): Promise<RegistroEnvioReporte> {
  const detalle = reporteMensual(bd, mes)
  const salioBien = await enviar(
    destinatario,
    `Reporte de ${mes} — Cine Variedades`,
    comoResumen(mes, detalle),
    comoHojaDeCalculo(detalle),
  )
  const registro: RegistroEnvioReporte = {
    mes,
    destinatario,
    instante: ahora,
    resultado: salioBien ? 'enviado' : 'fallido',
  }
  bd.prepare(`INSERT INTO envio_reporte (mes, destinatario, instante, resultado) VALUES (?, ?, ?, ?)`).run(
    registro.mes,
    registro.destinatario,
    registro.instante,
    registro.resultado,
  )
  return registro
}

/** Los envíos ya intentados de un mes, más reciente primero (REG-7). */
export function enviosDeReporte(bd: Bd, mes: string): RegistroEnvioReporte[] {
  return bd
    .prepare(
      `SELECT mes, destinatario, instante, resultado FROM envio_reporte
       WHERE mes = ? ORDER BY instante DESC`,
    )
    .all(mes) as RegistroEnvioReporte[]
}

const CLAVE_CORREO_DISTRIBUIDOR = 'correo-distribuidor'

/** El correo del distribuidor que mantiene la dueña (RN-49, RF-29). */
export function correoDelDistribuidor(bd: Bd): string | undefined {
  const fila = bd
    .prepare(`SELECT valor FROM configuracion WHERE clave = ?`)
    .get(CLAVE_CORREO_DISTRIBUIDOR) as { valor: string } | undefined
  return fila?.valor
}

/** Cambia el correo del distribuidor (RF-29); un valor vacío no es un correo. */
export function fijarCorreoDelDistribuidor(bd: Bd, correo: string): void {
  const limpio = correo.trim()
  if (limpio === '') {
    throw new Error('El correo del distribuidor no puede quedar vacío')
  }
  bd.prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
  ).run(CLAVE_CORREO_DISTRIBUIDOR, limpio)
}

export interface OcupacionDeFuncion {
  funcionId: number
  pelicula: string
  fecha: string
  horaInicio: string
  butacas: number
  entradasVendidas: number
  /** Fracción entre 0 y 1: entradas vendidas sobre butacas de la sala. */
  ocupacion: number
}

/** Ocupación de las funciones en un período, para ver qué película y qué horario llenan más (RF-30). */
export function ocupacionDeFunciones(bd: Bd, desde: string, hasta: string): OcupacionDeFuncion[] {
  const funciones = bd
    .prepare(
      `SELECT f.id AS funcionId, p.titulo AS pelicula, f.fecha, f.hora_inicio AS horaInicio,
              s.filas * s.butacas_por_fila AS butacas
       FROM funcion f
       JOIN pelicula p ON p.id = f.pelicula_id
       JOIN sala s ON s.id = f.sala_id
       WHERE f.fecha BETWEEN ? AND ?
       ORDER BY f.fecha, f.hora_inicio`,
    )
    .all(desde, hasta) as {
    funcionId: number
    pelicula: string
    fecha: string
    horaInicio: string
    butacas: number
  }[]

  const vendidasDe = bd.prepare(
    `SELECT COUNT(*) AS n FROM entrada e JOIN compra c ON c.id = e.compra_id
     WHERE c.funcion_id = ? AND c.estado IN ('pagada', 'devuelta')`,
  )

  return funciones.map((funcion) => {
    const entradasVendidas = (vendidasDe.get(funcion.funcionId) as { n: number }).n
    return {
      ...funcion,
      entradasVendidas,
      ocupacion: funcion.butacas === 0 ? 0 : entradasVendidas / funcion.butacas,
    }
  })
}

export interface EntradasPorCategoriaYCanal {
  categoria: string
  canal: string
  entradas: number
  monto: number
}

/** Entradas y monto por categoría de precio y por canal, en un período que se elige (RF-31). */
export function entradasPorCategoriaYCanal(
  bd: Bd,
  desde: string,
  hasta: string,
): EntradasPorCategoriaYCanal[] {
  return bd
    .prepare(
      `SELECT e.categoria AS categoria, c.canal AS canal, COUNT(*) AS entradas,
              COALESCE(SUM(e.monto), 0) AS monto
       FROM entrada e JOIN compra c ON c.id = e.compra_id
       WHERE c.jornada BETWEEN ? AND ? AND c.estado IN ('pagada', 'devuelta')
       GROUP BY e.categoria, c.canal
       ORDER BY e.categoria, c.canal`,
    )
    .all(desde, hasta) as EntradasPorCategoriaYCanal[]
}
