import { randomInt } from 'node:crypto'
import type { Bd } from '../base/bd.js'
import { enVenta, precio, type CategoriaPrecio } from '../cartelera/cartelera.js'
import { tomar } from '../ocupacion/ocupacion.js'

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
