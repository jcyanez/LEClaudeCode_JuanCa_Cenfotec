import { randomInt } from 'node:crypto'
import type { Avisos } from '../avisos/avisos.js'
import type { Bd } from '../base/bd.js'
import {
  cancelarFuncion as marcarFuncionCancelada,
  categoriaBase,
  enVenta,
  inicioDe,
  precio,
  type CategoriaPrecio,
} from '../cartelera/cartelera.js'
import { barrer, cambiarMotivo, liberar, tomadas, tomar } from '../ocupacion/ocupacion.js'

export type { Avisos }

export interface ButacaElegida {
  butacaId: number
  categoria: CategoriaPrecio
}

export interface EntradaDeCompra {
  butacaId: number
  categoria: CategoriaPrecio
  /** Congelado al vender: un cambio de precio no lo altera (RN-16, CA-4). */
  monto: number
  usadaInstante: string | null
  usadaOperadorId: number | null
}

export interface Compra {
  numero: string
  canal: 'taquilla' | 'internet'
  instante: string
  jornada: string
  funcionId: number
  estado: 'pagada' | 'anulada' | 'devuelta'
  montoTotal: number
  operadorId: number | null
  entradas: EntradaDeCompra[]
}

/**
 * Rechazo esperado: otro se adelantó con parte del grupo (RNF-4). Lleva los
 * ids para que Entrada los muestre con su etiqueta y el mapa al día.
 */
export class ButacasYaTomadas extends Error {
  constructor(public readonly butacaIds: number[]) {
    super('Algunas butacas ya no están libres')
    this.name = 'ButacasYaTomadas'
  }
}

const CORTE_JORNADA = '06:00'

/**
 * La jornada a la que se imputa una operación: corta a las 06:00 y se nombra
 * por el día en que empieza (RN-10, RN-11, CA-8). Se calcula al escribir y
 * queda congelada en la fila.
 */
export function jornadaDe(instante: string): string {
  const fecha = instante.slice(0, 10)
  if (instante.slice(11, 16) >= CORTE_JORNADA) return fecha
  const anterior = new Date(`${fecha}T00:00:00Z`)
  anterior.setUTCDate(anterior.getUTCDate() - 1)
  return anterior.toISOString().slice(0, 10)
}

/** Legible en voz alta: sin 0/O ni 1/I/L (RN-25, decisión de DISENO.md). */
const ALFABETO_NUMERO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LARGO_NUMERO = 6

/** Número único entre compras y reservas: la reserva lo conserva al convertirse (RN-25). */
function generarNumero(bd: Bd): string {
  const yaExiste = bd.prepare(
    `SELECT 1 FROM compra WHERE numero = ? UNION SELECT 1 FROM reserva WHERE numero = ?`,
  )
  for (;;) {
    let numero = ''
    for (let i = 0; i < LARGO_NUMERO; i++) {
      numero += ALFABETO_NUMERO[randomInt(ALFABETO_NUMERO.length)]
    }
    if (yaExiste.get(numero, numero) === undefined) return numero
  }
}

/**
 * Compra en taquilla: las butacas pasan de libres a vendidas en la misma
 * operación, sin bloqueo intermedio (RN-20, RF-12). Toda la secuencia —tomar
 * las butacas, registrar la compra y sus entradas— es una sola transacción
 * (promesa transversal de DISENO.md): si algo falla, no queda rastro (REG-1).
 */
export function venderEnTaquilla(
  bd: Bd,
  funcionId: number,
  butacas: ButacaElegida[],
  operadorId: number,
  ahora: string,
): Compra {
  if (butacas.length === 0) {
    throw new Error('Una compra necesita al menos una butaca')
  }
  if (!enVenta(bd, funcionId, ahora)) {
    throw new Error('La función no está en venta')
  }
  // El precio se congela acá, por butaca y categoría (RN-16); miércoles lo arbitra Cartelera (RN-13, RN-14).
  const entradas = butacas.map((butaca) => ({
    ...butaca,
    monto: precio(bd, funcionId, butaca.categoria),
  }))
  const montoTotal = entradas.reduce((suma, entrada) => suma + entrada.monto, 0)
  const numero = generarNumero(bd)

  const insertarCompra = bd.prepare(
    `INSERT INTO compra (numero, canal, instante, jornada, funcion_id, monto_total, operador_id)
     VALUES (?, 'taquilla', ?, ?, ?, ?, ?)`,
  )
  const insertarEntrada = bd.prepare(
    `INSERT INTO entrada (compra_id, butaca_id, categoria, monto) VALUES (?, ?, ?, ?)`,
  )
  bd.transaction(() => {
    const resultado = tomar(
      bd,
      funcionId,
      butacas.map((butaca) => butaca.butacaId),
      'venta',
      numero,
      ahora,
    )
    if (!resultado.tomadas) {
      throw new ButacasYaTomadas(resultado.seAdelantaron)
    }
    const compraId = Number(
      insertarCompra.run(numero, ahora, jornadaDe(ahora), funcionId, montoTotal, operadorId)
        .lastInsertRowid,
    )
    for (const entrada of entradas) {
      insertarEntrada.run(compraId, entrada.butacaId, entrada.categoria, entrada.monto)
    }
  })()

  const compra = buscarCompra(bd, numero)
  if (compra === undefined) throw new Error(`La compra ${numero} no quedó registrada`)
  return compra
}

export interface Contacto {
  nombre: string
  correo: string
  telefono: string
}

export interface Bloqueo {
  sesion: string
  funcionId: number
  butacaIds: number[]
  /** Sin carné no hay estudiante por internet: general, o miércoles (RN-28, RN-13). */
  categoria: CategoriaPrecio
  vence: string
}

/** El bloqueo dura 5 minutos desde que se eligen las butacas (RN-19). */
const MINUTOS_BLOQUEO = 5

function sumarMinutos(instante: string, minutos: number): string {
  const fecha = new Date(`${instante}Z`)
  fecha.setUTCMinutes(fecha.getUTCMinutes() + minutos)
  return fecha.toISOString().slice(0, 19)
}

/**
 * Bloquea butacas a favor de la sesión anónima que las eligió primero
 * (RN-19, RF-10). Al vencer sin compra, vuelven a estar libres solas: el
 * vencimiento vive en la fila y Ocupación lo ignora al leer.
 */
export function bloquear(
  bd: Bd,
  funcionId: number,
  butacaIds: number[],
  sesionAnonima: string,
  ahora: string,
): Bloqueo {
  if (butacaIds.length === 0) {
    throw new Error('Un bloqueo necesita al menos una butaca')
  }
  if (!enVenta(bd, funcionId, ahora)) {
    throw new Error('La función no está en venta')
  }
  const vence = sumarMinutos(ahora, MINUTOS_BLOQUEO)
  const resultado = tomar(bd, funcionId, butacaIds, 'bloqueo', sesionAnonima, ahora, vence)
  if (!resultado.tomadas) {
    throw new ButacasYaTomadas(resultado.seAdelantaron)
  }
  return {
    sesion: sesionAnonima,
    funcionId,
    butacaIds,
    categoria: categoriaBase(bd, funcionId),
    vence,
  }
}

/**
 * El punto único del pago simulado (DISENO.md): decide el pago y, si resulta
 * exitoso, convierte el bloqueo en venta sin ventana —un solo UPDATE vía
 * cambiarMotivo (RN-26)— y registra la compra con contacto y canal internet
 * (RN-23, RN-27, REG-1) en una sola transacción. El correo del número se
 * encola después y jamás revierte nada (RNF-5).
 */
export function pagar(
  bd: Bd,
  avisos: Avisos,
  bloqueo: Bloqueo,
  contacto: Contacto,
  ahora: string,
  pagoSimulado: () => boolean = () => true,
): Compra {
  const contactoCompleto = [contacto.nombre, contacto.correo, contacto.telefono].every(
    (dato) => dato.trim() !== '',
  )
  if (!contactoCompleto) {
    throw new Error('La compra por internet necesita nombre, correo y teléfono')
  }
  if (ahora >= bloqueo.vence) {
    throw new Error('Se venció el tiempo. Las butacas volvieron a estar libres')
  }
  if (!enVenta(bd, bloqueo.funcionId, ahora)) {
    throw new Error('La función no está en venta')
  }
  if (!pagoSimulado()) {
    throw new Error('El pago no se completó. Las butacas siguen tuyas por lo que queda del bloqueo')
  }

  const monto = precio(bd, bloqueo.funcionId, bloqueo.categoria)
  const numero = generarNumero(bd)
  const insertarCompra = bd.prepare(
    `INSERT INTO compra (numero, canal, instante, jornada, funcion_id, monto_total,
                         contacto_nombre, contacto_correo, contacto_telefono)
     VALUES (?, 'internet', ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertarEntrada = bd.prepare(
    `INSERT INTO entrada (compra_id, butaca_id, categoria, monto) VALUES (?, ?, ?, ?)`,
  )
  bd.transaction(() => {
    cambiarMotivo(bd, bloqueo.sesion, 'venta', numero)
    const compraId = Number(
      insertarCompra.run(
        numero,
        ahora,
        jornadaDe(ahora),
        bloqueo.funcionId,
        monto * bloqueo.butacaIds.length,
        contacto.nombre,
        contacto.correo,
        contacto.telefono,
      ).lastInsertRowid,
    )
    for (const butacaId of bloqueo.butacaIds) {
      insertarEntrada.run(compraId, butacaId, bloqueo.categoria, monto)
    }
  })()

  const compra = buscarCompra(bd, numero)
  if (compra === undefined) throw new Error(`La compra ${numero} no quedó registrada`)
  try {
    avisos.encolar(
      contacto.correo,
      `Tu compra ${numero} — Cine Variedades`,
      `Tu número de compra es ${numero}. Dictalo en la puerta para entrar.`,
    )
  } catch {
    // RNF-5: la venta ya está registrada; el correo que no sale no revierte nada.
  }
  return compra
}

export interface Reserva {
  numero: string
  funcionId: number
  butacaIds: number[]
  /** La reserva vence al empezar la función (RN-30). */
  vence: string
}

/**
 * Reserva de estudiante: solo por internet, sin pago (RN-28, RN-29). Aparta
 * las butacas hasta el inicio de la función con un número propio que se
 * conserva al convertirse (RN-25, RN-30). Vive en su propia tabla para que
 * ninguna consulta de ventas pueda contarla (decisión del modelo, REG-3).
 */
export function reservar(
  bd: Bd,
  avisos: Avisos,
  funcionId: number,
  butacaIds: number[],
  contacto: Contacto,
  ahora: string,
): Reserva {
  if (butacaIds.length === 0) {
    throw new Error('Una reserva necesita al menos una butaca')
  }
  const contactoCompleto = [contacto.nombre, contacto.correo, contacto.telefono].every(
    (dato) => dato.trim() !== '',
  )
  if (!contactoCompleto) {
    throw new Error('La reserva necesita nombre, correo y teléfono')
  }
  if (!enVenta(bd, funcionId, ahora)) {
    throw new Error('La función no está en venta')
  }
  if (categoriaBase(bd, funcionId) === 'miercoles') {
    throw new Error('En las funciones de miércoles no hay reservas de estudiante')
  }
  const numero = generarNumero(bd)
  const vence = inicioDe(bd, funcionId)
  const insertarReserva = bd.prepare(
    `INSERT INTO reserva (numero, funcion_id, nombre, correo, telefono, instante)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  bd.transaction(() => {
    const resultado = tomar(bd, funcionId, butacaIds, 'reserva', numero, ahora, vence)
    if (!resultado.tomadas) {
      throw new ButacasYaTomadas(resultado.seAdelantaron)
    }
    insertarReserva.run(numero, funcionId, contacto.nombre, contacto.correo, contacto.telefono, ahora)
  })()
  try {
    avisos.encolar(
      contacto.correo,
      `Tu reserva ${numero} — Cine Variedades`,
      `Tu número de reserva es ${numero}. Presentá tu carné en taquilla antes del inicio de la función.`,
    )
  } catch {
    // RNF-5: la reserva ya está hecha; el correo que no sale no revierte nada.
  }
  return { numero, funcionId, butacaIds, vence }
}

/**
 * Convierte una reserva en compra, solo en taquilla: con carné cobra precio
 * de estudiante, sin carné precio general si la persona acepta (RN-31,
 * RN-32). Conserva el número (RN-25) y la butaca nunca queda libre en el
 * medio: es el mismo cambio de motivo sin ventana de los bloqueos.
 */
export function convertir(
  bd: Bd,
  numero: string,
  conCarne: boolean,
  operadorId: number,
  ahora: string,
): Compra {
  const reserva = bd
    .prepare(
      `SELECT funcion_id AS funcionId, nombre, correo, telefono FROM reserva WHERE numero = ?`,
    )
    .get(numero) as { funcionId: number; nombre: string; correo: string; telefono: string } | undefined
  if (reserva === undefined) {
    throw new Error('No existe una reserva con ese número')
  }
  if (ahora >= inicioDe(bd, reserva.funcionId)) {
    throw new Error('La reserva venció al empezar la función: las butacas volvieron a estar libres')
  }
  const butacaIds = tomadas(bd, reserva.funcionId, ahora)
    .filter((butaca) => butaca.referencia === numero)
    .map((butaca) => butaca.butacaId)
  const categoria: CategoriaPrecio = conCarne ? 'estudiante' : 'general'
  const monto = precio(bd, reserva.funcionId, categoria)
  const insertarCompra = bd.prepare(
    `INSERT INTO compra (numero, canal, instante, jornada, funcion_id, monto_total, operador_id,
                         contacto_nombre, contacto_correo, contacto_telefono)
     VALUES (?, 'taquilla', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertarEntrada = bd.prepare(
    `INSERT INTO entrada (compra_id, butaca_id, categoria, monto) VALUES (?, ?, ?, ?)`,
  )
  bd.transaction(() => {
    cambiarMotivo(bd, numero, 'venta', numero)
    bd.prepare(`DELETE FROM reserva WHERE numero = ?`).run(numero)
    const compraId = Number(
      insertarCompra.run(
        numero,
        ahora,
        jornadaDe(ahora),
        reserva.funcionId,
        monto * butacaIds.length,
        operadorId,
        reserva.nombre,
        reserva.correo,
        reserva.telefono,
      ).lastInsertRowid,
    )
    for (const butacaId of butacaIds) {
      insertarEntrada.run(compraId, butacaId, categoria, monto)
    }
  })()
  const compra = buscarCompra(bd, numero)
  if (compra === undefined) throw new Error(`La compra ${numero} no quedó registrada`)
  return compra
}

/**
 * Libera una reserva no convertida: quien no presenta carné y no paga precio
 * general deja las butacas libres en el acto (RN-32), sin dejar registro.
 */
export function liberarReserva(bd: Bd, numero: string): void {
  bd.transaction(() => {
    liberar(bd, numero)
    bd.prepare(`DELETE FROM reserva WHERE numero = ?`).run(numero)
  })()
}

/**
 * El barrido de Venta (lo llama el Reloj en T17): borra las reservas cuya
 * función ya empezó (RN-30, RN-34) y le pide a Ocupación que barra sus filas
 * vencidas. Si no corre, nada se rompe: la corrección vive en cada operación
 * (decisión 4 de DISENO.md).
 */
export function barrerVencidos(bd: Bd, ahora: string): { reservas: number; ocupaciones: number } {
  const reservas = bd
    .prepare(`SELECT numero, funcion_id AS funcionId FROM reserva`)
    .all() as { numero: string; funcionId: number }[]
  let borradas = 0
  for (const reserva of reservas) {
    if (inicioDe(bd, reserva.funcionId) <= ahora) {
      bd.prepare(`DELETE FROM reserva WHERE numero = ?`).run(reserva.numero)
      borradas++
    }
  }
  return { reservas: borradas, ocupaciones: barrer(bd, ahora) }
}

/** Rechazo esperado: ninguna compra tiene ese número (RF-18, RF-20). */
export class CompraInexistente extends Error {
  constructor(public readonly numero: string) {
    super(`No encontramos ninguna compra con el número ${numero}`)
    this.name = 'CompraInexistente'
  }
}

/** Rechazo esperado: el número existe, pero es de otra función (tabla de errores). */
export class NumeroDeOtraFuncion extends Error {
  constructor(
    public readonly numero: string,
    public readonly funcionId: number,
  ) {
    super(`El número ${numero} es de otra función`)
    this.name = 'NumeroDeOtraFuncion'
  }
}

/** Rechazo esperado: las entradas ya se validaron antes (RN-37, RF-20, RF-22, REG-2). */
export class EntradaYaUsada extends Error {
  constructor(
    public readonly numero: string,
    public readonly usadaInstante: string,
    public readonly usadaOperadorId: number,
  ) {
    super(`Las entradas de ${numero} ya se validaron a las ${usadaInstante.slice(11, 16)}`)
    this.name = 'EntradaYaUsada'
  }
}

/** Rechazo esperado: la función de esa compra se canceló y quedó devuelta (RF-20). */
export class FuncionCancelada extends Error {
  constructor(
    public readonly numero: string,
    public readonly funcionId: number,
  ) {
    super(`La función de ${numero} se canceló: la compra quedó devuelta`)
    this.name = 'FuncionCancelada'
  }
}

/** Rechazo esperado: la compra ya fue anulada (RF-20). */
export class CompraAnulada extends Error {
  constructor(public readonly numero: string) {
    super(`La compra ${numero} ya fue anulada`)
    this.name = 'CompraAnulada'
  }
}

/**
 * Valida una compra en la puerta: marca instante y operador en cada entrada,
 * todas a la vez (RF-18, RF-19, REG-2). Rechaza sin registrar nada si el
 * número no existe, es de otra función, la función se canceló, la compra
 * está anulada, o las entradas ya se usaron (RF-20, RN-37, tabla de errores
 * de DISENO.md).
 */
export function validar(
  bd: Bd,
  funcionId: number,
  numero: string,
  operadorId: number,
  ahora: string,
): Compra {
  const compra = buscarCompra(bd, numero)
  if (compra === undefined) {
    throw new CompraInexistente(numero)
  }
  if (compra.funcionId !== funcionId) {
    throw new NumeroDeOtraFuncion(numero, compra.funcionId)
  }
  if (compra.estado === 'devuelta') {
    throw new FuncionCancelada(numero, compra.funcionId)
  }
  if (compra.estado === 'anulada') {
    throw new CompraAnulada(numero)
  }
  const yaUsada = compra.entradas.find((entrada) => entrada.usadaInstante !== null)
  if (yaUsada !== undefined) {
    throw new EntradaYaUsada(numero, yaUsada.usadaInstante as string, yaUsada.usadaOperadorId as number)
  }
  bd.prepare(
    `UPDATE entrada SET usada_instante = ?, usada_operador_id = ?
     WHERE compra_id = (SELECT id FROM compra WHERE numero = ?)`,
  ).run(ahora, operadorId, numero)
  const validada = buscarCompra(bd, numero)
  if (validada === undefined) throw new Error(`La compra ${numero} no quedó registrada`)
  return validada
}

/** Búsqueda alternativa cuando no se tiene el número, por nombre o correo (RF-18). */
export function buscarCompraPorContacto(bd: Bd, texto: string): Compra[] {
  const numeros = bd
    .prepare(
      `SELECT numero FROM compra
       WHERE contacto_nombre LIKE '%' || ? || '%' COLLATE NOCASE
          OR contacto_correo LIKE '%' || ? || '%' COLLATE NOCASE
       ORDER BY instante DESC`,
    )
    .all(texto, texto) as { numero: string }[]
  return numeros
    .map(({ numero }) => buscarCompra(bd, numero))
    .filter((compra): compra is Compra => compra !== undefined)
}

/**
 * Anula una compra hasta la hora de inicio de su función, con motivo (RN-38,
 * RN-40, RF-21). No se puede si sus entradas ya se usaron (RN-39, RF-22).
 * Libera todas las butacas de una sola vez y registra quién, cuándo y por
 * qué (REG-4).
 */
export function anular(bd: Bd, numero: string, operadorId: number, motivo: string, ahora: string): void {
  const compra = buscarCompra(bd, numero)
  if (compra === undefined) {
    throw new CompraInexistente(numero)
  }
  if (compra.estado !== 'pagada') {
    throw new Error(`La compra ${numero} ya no está vigente`)
  }
  const yaUsada = compra.entradas.find((entrada) => entrada.usadaInstante !== null)
  if (yaUsada !== undefined) {
    throw new EntradaYaUsada(numero, yaUsada.usadaInstante as string, yaUsada.usadaOperadorId as number)
  }
  if (ahora >= inicioDe(bd, compra.funcionId)) {
    throw new Error('La función ya empezó: no se puede anular la compra')
  }
  bd.transaction(() => {
    liberar(bd, numero)
    bd.prepare(
      `UPDATE compra
       SET estado = 'anulada', reversa_operador_id = ?, reversa_instante = ?,
           reversa_jornada = ?, reversa_motivo = ?
       WHERE numero = ?`,
    ).run(operadorId, ahora, jornadaDe(ahora), motivo, numero)
  })()
}

/**
 * Cancela una función hasta el final de la jornada a la que pertenece
 * (RN-41, RN-42, RF-23): sus compras pagadas quedan devueltas de una sola
 * vez, hayan sido validadas en la puerta o no, y libera todas sus butacas.
 * Avisa por correo a cada comprador de internet (RF-24); ningún aviso
 * revierte nada (RNF-5). Nunca toca la tabla de reservas: viven aparte
 * (decisión del modelo) y no pueden convertirse en compras de una función
 * que ya no va a ocurrir.
 */
export function cancelarFuncion(
  bd: Bd,
  avisos: Avisos,
  funcionId: number,
  operadorId: number,
  motivo: string,
  ahora: string,
): Compra[] {
  const funcionJornada = jornadaDe(inicioDe(bd, funcionId))
  if (jornadaDe(ahora) > funcionJornada) {
    throw new Error('La jornada de esa función ya cerró: no se puede cancelar')
  }
  const jornada = jornadaDe(ahora)
  const compras = bd
    .prepare(
      `SELECT numero, canal, contacto_correo AS contactoCorreo
       FROM compra WHERE funcion_id = ? AND estado = 'pagada'`,
    )
    .all(funcionId) as { numero: string; canal: string; contactoCorreo: string | null }[]

  bd.transaction(() => {
    for (const compra of compras) {
      liberar(bd, compra.numero)
      bd.prepare(
        `UPDATE compra
         SET estado = 'devuelta', reversa_operador_id = ?, reversa_instante = ?,
             reversa_jornada = ?, reversa_motivo = ?
         WHERE numero = ?`,
      ).run(operadorId, ahora, jornada, motivo, compra.numero)
    }
    marcarFuncionCancelada(bd, funcionId, { operadorId, instante: ahora, jornada, motivo })
  })()

  for (const compra of compras) {
    if (compra.canal === 'internet' && compra.contactoCorreo !== null) {
      try {
        avisos.encolar(
          compra.contactoCorreo,
          'Tu función se canceló — Cine Variedades',
          `La función de tu compra ${compra.numero} se canceló. Tu compra quedó devuelta.`,
        )
      } catch {
        // RNF-5: la cancelación ya es firme; el correo que no sale no revierte nada.
      }
    }
  }

  return compras
    .map((compra) => buscarCompra(bd, compra.numero))
    .filter((compra): compra is Compra => compra !== undefined)
}

/**
 * Marca entregada en efectivo la devolución de una compra de taquilla
 * (RF-25, REG-5): un evento aparte de la anulación o la cancelación, con su
 * propio operador, instante y jornada — la jornada que descuenta el cierre
 * de caja es la de la entrega, no la de la anulación (RN-44).
 */
export function marcarDevolucionEntregada(
  bd: Bd,
  numero: string,
  operadorId: number,
  ahora: string,
): void {
  const compra = buscarCompra(bd, numero)
  if (compra === undefined) {
    throw new CompraInexistente(numero)
  }
  if (compra.canal !== 'taquilla') {
    throw new Error('Solo las devoluciones de una compra de taquilla se entregan en efectivo')
  }
  if (compra.estado === 'pagada') {
    throw new Error(`La compra ${numero} no está anulada ni devuelta`)
  }
  bd.prepare(
    `UPDATE compra
     SET entrega_operador_id = ?, entrega_instante = ?, entrega_jornada = ?
     WHERE numero = ?`,
  ).run(operadorId, ahora, jornadaDe(ahora), numero)
}

/** La compra con sus entradas, por número (RF-18 la usa desde la puerta). */
export function buscarCompra(bd: Bd, numero: string): Compra | undefined {
  const compra = bd
    .prepare(
      `SELECT id, numero, canal, instante, jornada, funcion_id AS funcionId, estado,
              monto_total AS montoTotal, operador_id AS operadorId
       FROM compra WHERE numero = ?`,
    )
    .get(numero) as (Compra & { id: number }) | undefined
  if (compra === undefined) return undefined
  const entradas = bd
    .prepare(
      `SELECT butaca_id AS butacaId, categoria, monto,
              usada_instante AS usadaInstante, usada_operador_id AS usadaOperadorId
       FROM entrada WHERE compra_id = ? ORDER BY butaca_id`,
    )
    .all(compra.id) as EntradaDeCompra[]
  const { id: _id, ...sinId } = compra
  return { ...sinId, entradas }
}
