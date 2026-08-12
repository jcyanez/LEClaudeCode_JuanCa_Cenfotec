import { randomInt } from 'node:crypto'
import type { Bd } from '../base/bd.js'
import { categoriaBase, enVenta, precio, type CategoriaPrecio } from '../cartelera/cartelera.js'
import { cambiarMotivo, tomar } from '../ocupacion/ocupacion.js'

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

/**
 * Contrato fijo de Avisos (PLAN, Fase 3): encolar acepta siempre, nunca falla
 * ni bloquea (RNF-5). La implementación real llega en T14; hasta entonces las
 * pruebas usan una simulada.
 */
export interface Avisos {
  encolar(destinatario: string, asunto: string, cuerpo: string, adjunto?: unknown): void
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
