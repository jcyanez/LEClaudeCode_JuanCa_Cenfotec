import type { Bd } from '../base/bd.js'

export type Puesto = 'dueña' | 'taquilla' | 'puerta'

export interface OperadorIdentificado {
  id: number
  nombre: string
  puesto: Puesto
}

/**
 * Las operaciones que exige un operador identificado (RF-32). Entrada es
 * quien las exige; este componente solo dice si el puesto las tiene
 * permitidas (RN-54).
 */
export type Operacion =
  | 'cargar-cartelera'
  | 'fijar-precios'
  | 'mantener-correo-distribuidor'
  | 'consultar-reporte'
  | 'consultar-cierre-caja'
  | 'vender'
  | 'convertir-reserva'
  | 'entregar-devolucion'
  | 'cancelar-funcion'
  | 'anular-compra'
  | 'cierre-caja'
  | 'validar'

/** Qué puede hacer cada puesto (RN-50 a RN-53). */
const PERMISOS: Record<Puesto, ReadonlySet<Operacion>> = {
  dueña: new Set<Operacion>([
    'cargar-cartelera',
    'fijar-precios',
    'mantener-correo-distribuidor',
    'consultar-reporte',
    'consultar-cierre-caja',
    'cancelar-funcion',
    'anular-compra',
  ]),
  taquilla: new Set<Operacion>([
    'vender',
    'convertir-reserva',
    'entregar-devolucion',
    'cancelar-funcion',
    'anular-compra',
    'cierre-caja',
  ]),
  puerta: new Set<Operacion>(['validar']),
}

/**
 * Identifica a un operador por su PIN (credencial), corto y propio de cada
 * uno (decisión de DISENO.md). Ninguna sesión se guarda acá: quien exige el
 * operador es Entrada (T18), no los componentes de dominio.
 */
export function identificar(bd: Bd, pin: string): OperadorIdentificado | undefined {
  return bd
    .prepare(`SELECT id, nombre, puesto FROM operador WHERE credencial = ?`)
    .get(pin) as OperadorIdentificado | undefined
}

/** Si el puesto del operador tiene permitida una operación (RN-54, RF-32, RF-33). */
export function puede(operador: OperadorIdentificado, operacion: Operacion): boolean {
  return PERMISOS[operador.puesto].has(operacion)
}
