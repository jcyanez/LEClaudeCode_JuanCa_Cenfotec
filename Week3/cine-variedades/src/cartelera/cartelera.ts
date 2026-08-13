import type { Bd } from '../base/bd.js'
import { tieneTomadas } from '../ocupacion/ocupacion.js'

/** Las dos salas del cine, un dato fijo del negocio (RN-1, RN-2). */
const SALAS = [
  { nombre: 'Sala 1', filas: 10, butacasPorFila: 12 },
  { nombre: 'Sala 2', filas: 6, butacasPorFila: 10 },
] as const

const LETRA_A = 'A'.charCodeAt(0)

export interface Butaca {
  id: number
  fila: string
  numero: number
  /** Cómo se nombra en el mapa y en voz alta: `A1`, `F7` (RN-2). */
  etiqueta: string
}

/** Todas las butacas de una sala, ordenadas por fila y número (RN-2, RF-9). */
export function butacasDe(bd: Bd, salaId: number): Butaca[] {
  return bd
    .prepare(
      `SELECT id, fila, numero FROM butaca WHERE sala_id = ? ORDER BY fila, numero`,
    )
    .all(salaId)
    .map((fila) => {
      const b = fila as { id: number; fila: string; numero: number }
      return { ...b, etiqueta: `${b.fila}${b.numero}` }
    })
}

export interface Pelicula {
  id: number
  titulo: string
  duracionMinutos: number
}

/** Registra una película; el título y la duración en minutos son obligatorios (RN-4, RF-1). */
export function registrarPelicula(bd: Bd, titulo: string, duracionMinutos: number): number {
  const tituloLimpio = titulo.trim()
  if (tituloLimpio === '') {
    throw new Error('La película necesita un título')
  }
  if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
    throw new Error('La duración debe ser un número entero de minutos mayor que cero')
  }
  const resultado = bd
    .prepare(`INSERT INTO pelicula (titulo, duracion_minutos) VALUES (?, ?)`)
    .run(tituloLimpio, duracionMinutos)
  return Number(resultado.lastInsertRowid)
}

/** Las películas registradas, con su duración (RN-4). */
export function peliculas(bd: Bd): Pelicula[] {
  return bd
    .prepare(
      `SELECT id, titulo, duracion_minutos AS duracionMinutos FROM pelicula ORDER BY id`,
    )
    .all() as Pelicula[]
}

const JUEVES = 4
const DIAS_DE_UNA_SEMANA = 7

function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay()
}

function sumarDias(fecha: string, dias: number): string {
  const fechaMs = new Date(`${fecha}T00:00:00Z`)
  fechaMs.setUTCDate(fechaMs.getUTCDate() + dias)
  return fechaMs.toISOString().slice(0, 10)
}

/** El jueves de la semana de cartelera a la que pertenece una fecha (RN-3). */
function juevesDeLaSemanaDe(fecha: string): string {
  const corrimiento = (diaDeLaSemana(fecha) - JUEVES + DIAS_DE_UNA_SEMANA) % DIAS_DE_UNA_SEMANA
  return sumarDias(fecha, -corrimiento)
}

/**
 * Carga una semana de cartelera, cerrada a la venta hasta que la dueña la dé
 * por cargada (RN-9). Empieza un jueves (RN-3) y solo pueden estar cargadas la
 * semana en curso y la siguiente (RN-8). `hoy` viene de quien llama: este
 * componente no mira el reloj.
 */
export function crearSemana(bd: Bd, juevesInicio: string, hoy: string): number {
  if (diaDeLaSemana(juevesInicio) !== JUEVES) {
    throw new Error('Una semana de cartelera empieza un jueves')
  }
  const juevesEnCurso = juevesDeLaSemanaDe(hoy)
  const juevesSiguiente = sumarDias(juevesEnCurso, DIAS_DE_UNA_SEMANA)
  if (juevesInicio !== juevesEnCurso && juevesInicio !== juevesSiguiente) {
    throw new Error('Solo pueden estar cargadas la semana en curso y la siguiente')
  }
  const yaCargada =
    bd.prepare(`SELECT 1 FROM semana_cartelera WHERE jueves_inicio = ?`).get(juevesInicio) !==
    undefined
  if (yaCargada) {
    throw new Error(`La semana del jueves ${juevesInicio} ya está cargada`)
  }
  const resultado = bd
    .prepare(`INSERT INTO semana_cartelera (jueves_inicio, abierta_a_venta) VALUES (?, 0)`)
    .run(juevesInicio)
  return Number(resultado.lastInsertRowid)
}

/** Abre la venta de las funciones de la semana: la dueña la dio por cargada (RN-9, RF-5). */
export function abrirVenta(bd: Bd, semanaId: number): void {
  bd.prepare(`UPDATE semana_cartelera SET abierta_a_venta = 1 WHERE id = ?`).run(semanaId)
}

/** Margen mínimo entre funciones de la misma sala (RN-6); valor fijo del diseño. */
const MARGEN_MINUTOS = 20
const MINUTOS_DE_UN_DIA = 24 * 60

export interface DatosFuncion {
  peliculaId: number
  salaId: number
  semanaId: number
  fecha: string
  horaInicio: string
}

/** Minutos desde la época para una fecha y hora locales; solo se usa para restar. */
function aMinutos(fecha: string, hora: string): number {
  return Date.parse(`${fecha}T${hora}:00Z`) / 60000
}

function aHora(minutos: number): string {
  const delDia = ((minutos % MINUTOS_DE_UN_DIA) + MINUTOS_DE_UN_DIA) % MINUTOS_DE_UN_DIA
  const horas = String(Math.floor(delDia / 60)).padStart(2, '0')
  return `${horas}:${String(delDia % 60).padStart(2, '0')}`
}

/**
 * Valida una función contra su semana y contra el margen de 20 minutos con las
 * demás programadas de la misma sala (RN-3, RN-5, RN-6, RF-3). Las canceladas
 * no estorban: esa proyección no va a ocurrir (RN-41). Al chocar, el mensaje
 * nombra a la del fin más tardío y la primera hora de inicio admisible.
 */
function validarFuncion(bd: Bd, datos: DatosFuncion, salvoFuncionId?: number): void {
  const pelicula = bd
    .prepare(`SELECT duracion_minutos AS duracion FROM pelicula WHERE id = ?`)
    .get(datos.peliculaId) as { duracion: number } | undefined
  if (pelicula === undefined) throw new Error('No existe esa película')

  const semana = bd
    .prepare(`SELECT jueves_inicio AS jueves FROM semana_cartelera WHERE id = ?`)
    .get(datos.semanaId) as { jueves: string } | undefined
  if (semana === undefined) throw new Error('No existe esa semana de cartelera')
  if (datos.fecha < semana.jueves || datos.fecha > sumarDias(semana.jueves, 6)) {
    throw new Error(`La fecha ${datos.fecha} no cae en la semana del jueves ${semana.jueves}`)
  }

  const inicio = aMinutos(datos.fecha, datos.horaInicio)
  const fin = inicio + pelicula.duracion
  const otras = bd
    .prepare(
      `SELECT f.id, f.fecha, f.hora_inicio AS horaInicio,
              p.duracion_minutos AS duracion, s.nombre AS sala
       FROM funcion f
       JOIN pelicula p ON p.id = f.pelicula_id
       JOIN sala s ON s.id = f.sala_id
       WHERE f.sala_id = ? AND f.estado = 'programada'`,
    )
    .all(datos.salaId) as {
    id: number
    fecha: string
    horaInicio: string
    duracion: number
    sala: string
  }[]

  let choque: { sala: string; fin: number } | null = null
  for (const otra of otras) {
    if (otra.id === salvoFuncionId) continue
    const inicioOtra = aMinutos(otra.fecha, otra.horaInicio)
    const finOtra = inicioOtra + otra.duracion
    const compatibles = inicio >= finOtra + MARGEN_MINUTOS || fin + MARGEN_MINUTOS <= inicioOtra
    if (!compatibles && (choque === null || finOtra > choque.fin)) {
      choque = { sala: otra.sala, fin: finOtra }
    }
  }
  if (choque !== null) {
    throw new Error(
      `Choca con la función de ${choque.sala} que termina a las ${aHora(choque.fin)}. ` +
        `La primera hora posible es ${aHora(choque.fin + MARGEN_MINUTOS)}`,
    )
  }
}

/** Programa una función de la semana: película, sala, fecha y hora (RN-5, RF-2, RF-3). */
export function programarFuncion(bd: Bd, datos: DatosFuncion): number {
  validarFuncion(bd, datos)
  const resultado = bd
    .prepare(
      `INSERT INTO funcion (pelicula_id, sala_id, semana_id, fecha, hora_inicio)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(datos.peliculaId, datos.salaId, datos.semanaId, datos.fecha, datos.horaInicio)
  return Number(resultado.lastInsertRowid)
}

function funcionProgramada(bd: Bd, funcionId: number): DatosFuncion {
  const funcion = bd
    .prepare(
      `SELECT pelicula_id AS peliculaId, sala_id AS salaId, semana_id AS semanaId,
              fecha, hora_inicio AS horaInicio
       FROM funcion WHERE id = ?`,
    )
    .get(funcionId) as DatosFuncion | undefined
  if (funcion === undefined) throw new Error('No existe esa función')
  return funcion
}

/**
 * Modifica una función mientras no tenga butacas tomadas (RF-4, vía la única
 * consulta que Cartelera le hace a Ocupación) y vuelve a validar el margen.
 */
export function modificarFuncion(
  bd: Bd,
  funcionId: number,
  cambios: Partial<DatosFuncion>,
  ahora: string,
): void {
  const actual = funcionProgramada(bd, funcionId)
  if (tieneTomadas(bd, funcionId, ahora)) {
    throw new Error('La función tiene butacas tomadas y no se puede modificar')
  }
  const nueva = { ...actual, ...cambios }
  validarFuncion(bd, nueva, funcionId)
  bd.prepare(
    `UPDATE funcion SET pelicula_id = ?, sala_id = ?, semana_id = ?, fecha = ?, hora_inicio = ?
     WHERE id = ?`,
  ).run(nueva.peliculaId, nueva.salaId, nueva.semanaId, nueva.fecha, nueva.horaInicio, funcionId)
}

/** Elimina una función mientras no tenga butacas tomadas (RF-4). */
export function eliminarFuncion(bd: Bd, funcionId: number, ahora: string): void {
  funcionProgramada(bd, funcionId)
  if (tieneTomadas(bd, funcionId, ahora)) {
    throw new Error('La función tiene butacas tomadas y no se puede eliminar')
  }
  bd.prepare(`DELETE FROM funcion WHERE id = ?`).run(funcionId)
}

export interface Cancelacion {
  operadorId: number
  instante: string
  jornada: string
  motivo: string
}

/**
 * Cancelación lógica: marca la función cancelada con operador, instante,
 * jornada y motivo (RN-41, REG-4). El plazo (RN-42) y las devoluciones los
 * arbitra Venta (T12); acá solo cambia el estado.
 */
export function cancelarFuncion(bd: Bd, funcionId: number, cancelacion: Cancelacion): void {
  bd.prepare(
    `UPDATE funcion
     SET estado = 'cancelada', cancelada_operador = ?, cancelada_instante = ?,
         cancelada_jornada = ?, cancelada_motivo = ?
     WHERE id = ?`,
  ).run(
    cancelacion.operadorId,
    cancelacion.instante,
    cancelacion.jornada,
    cancelacion.motivo,
    funcionId,
  )
}

const MIERCOLES = 3

export type CategoriaPrecio = 'general' | 'estudiante' | 'miercoles'

/**
 * Fija el precio general y el de estudiante desde una fecha (RN-12, RF-6).
 * Cada cambio se agrega al historial en vez de pisar el anterior, para poder
 * explicar un monto viejo (decisión de DISENO.md). Montos en céntimos enteros.
 */
export function fijarPrecios(
  bd: Bd,
  montoGeneral: number,
  montoEstudiante: number,
  desde: string,
): void {
  const sonValidos = [montoGeneral, montoEstudiante].every(
    (monto) => Number.isInteger(monto) && monto > 0,
  )
  if (!sonValidos) {
    throw new Error('Los montos deben ser enteros de céntimos mayores que cero')
  }
  bd.prepare(
    `INSERT INTO precio_vigente (monto_general, monto_estudiante, desde) VALUES (?, ?, ?)`,
  ).run(montoGeneral, montoEstudiante, desde)
}

/**
 * El precio de una entrada según la fecha de la función y la categoría (RF-7,
 * RN-15). En miércoles la única categoría es «miércoles», a mitad del precio
 * general (RN-13, RN-14, CA-3). Lo que se cobra lo congela Venta (RN-16), no
 * este componente.
 */
export function precio(bd: Bd, funcionId: number, categoria: CategoriaPrecio): number {
  const funcion = funcionProgramada(bd, funcionId)
  const vigente = bd
    .prepare(
      `SELECT monto_general AS general, monto_estudiante AS estudiante
       FROM precio_vigente WHERE desde <= ? ORDER BY desde DESC LIMIT 1`,
    )
    .get(funcion.fecha) as { general: number; estudiante: number } | undefined
  if (vigente === undefined) {
    throw new Error(`No hay precios vigentes para el ${funcion.fecha}`)
  }

  if (diaDeLaSemana(funcion.fecha) === MIERCOLES) {
    if (categoria === 'estudiante') {
      throw new Error('En las funciones de miércoles no existe el precio de estudiante')
    }
    if (categoria === 'general') {
      throw new Error('En las funciones de miércoles toda entrada se vende a la categoría miércoles')
    }
    // La mitad se redondea al céntimo si el general fuera impar.
    return Math.round(vigente.general / 2)
  }
  if (categoria === 'miercoles') {
    throw new Error('La categoría miércoles es solo para funciones de miércoles')
  }
  return categoria === 'general' ? vigente.general : vigente.estudiante
}

/**
 * La categoría que paga quien no presenta carné de estudiante: «miércoles» en
 * las funciones de miércoles —donde no existe otra—, «general» en el resto
 * (RN-13, RN-14). La usa Venta para la compra por internet (RN-28).
 */
export function categoriaBase(bd: Bd, funcionId: number): CategoriaPrecio {
  const funcion = funcionProgramada(bd, funcionId)
  return diaDeLaSemana(funcion.fecha) === MIERCOLES ? 'miercoles' : 'general'
}

/** El instante de inicio de la función; es el vencimiento de sus reservas (RN-5, RN-30). */
export function inicioDe(bd: Bd, funcionId: number): string {
  const funcion = funcionProgramada(bd, funcionId)
  return `${funcion.fecha}T${funcion.horaInicio}:00`
}

export interface DetalleFuncion {
  funcionId: number
  salaId: number
  pelicula: string
  sala: string
  /** Filas y butacas por fila de la sala (RN-1): con qué arma Entrada el mapa. */
  filas: number
  butacasPorFila: number
  fecha: string
  horaInicio: string
  categoriaBase: CategoriaPrecio
}

interface FilaDetalleFuncion {
  funcionId: number
  salaId: number
  pelicula: string
  sala: string
  filas: number
  butacasPorFila: number
  fecha: string
  horaInicio: string
}

const SELECT_DETALLE_FUNCION = `
  SELECT f.id AS funcionId, f.sala_id AS salaId, p.titulo AS pelicula, s.nombre AS sala,
         s.filas AS filas, s.butacas_por_fila AS butacasPorFila, f.fecha, f.hora_inicio AS horaInicio
  FROM funcion f
  JOIN pelicula p ON p.id = f.pelicula_id
  JOIN sala s ON s.id = f.sala_id
`

/**
 * Los datos de una función que necesita Entrada para armar sus pantallas
 * (T19–T21): con qué sala componer el mapa, y la categoría base para saber
 * qué precios pedir. Ninguna regla de negocio nueva: es la misma
 * información que ya exponen `precio`, `categoriaBase` e `inicioDe`, junta.
 */
export function detalleFuncion(bd: Bd, funcionId: number): DetalleFuncion | undefined {
  const fila = bd.prepare(`${SELECT_DETALLE_FUNCION} WHERE f.id = ?`).get(funcionId) as
    | FilaDetalleFuncion
    | undefined
  if (fila === undefined) return undefined
  return { ...fila, categoriaBase: diaDeLaSemana(fila.fecha) === MIERCOLES ? 'miercoles' : 'general' }
}

/**
 * Las funciones en venta (RF-8): misma condición que `enVenta`, en lista,
 * para la cartelera pública. Cualquiera puede verla sin identificarse
 * (RN-55).
 */
export function funcionesEnVenta(bd: Bd, ahora: string): DetalleFuncion[] {
  const filas = bd
    .prepare(
      `${SELECT_DETALLE_FUNCION}
       JOIN semana_cartelera sem ON sem.id = f.semana_id
       WHERE f.estado = 'programada' AND sem.abierta_a_venta = 1
         AND (f.fecha || 'T' || f.hora_inicio || ':00') > ?
       ORDER BY f.fecha, f.hora_inicio`,
    )
    .all(ahora) as FilaDetalleFuncion[]
  return filas.map((fila) => ({
    ...fila,
    categoriaBase: diaDeLaSemana(fila.fecha) === MIERCOLES ? 'miercoles' : 'general',
  }))
}

/**
 * Si la función está en venta: su semana abierta (RN-9), no cancelada (RN-43)
 * y su hora de inicio todavía no llegó — la venta se cierra a la hora exacta
 * de inicio (RN-21, CA-2).
 */
export function enVenta(bd: Bd, funcionId: number, ahora: string): boolean {
  const funcion = bd
    .prepare(
      `SELECT f.fecha, f.hora_inicio AS horaInicio, f.estado,
              s.abierta_a_venta AS abierta
       FROM funcion f JOIN semana_cartelera s ON s.id = f.semana_id
       WHERE f.id = ?`,
    )
    .get(funcionId) as
    | { fecha: string; horaInicio: string; estado: string; abierta: number }
    | undefined
  if (funcion === undefined) return false
  return (
    funcion.abierta === 1 &&
    funcion.estado === 'programada' &&
    ahora < `${funcion.fecha}T${funcion.horaInicio}:00`
  )
}

/**
 * Crea las dos salas con sus 180 butacas fijas, una sola vez: si ya existen,
 * no hace nada. Las butacas son inmutables después de creadas (RN-1).
 */
export function sembrarSalas(bd: Bd): void {
  const yaHaySalas = bd.prepare(`SELECT 1 FROM sala LIMIT 1`).get() !== undefined
  if (yaHaySalas) return

  const insertarSala = bd.prepare(
    `INSERT INTO sala (nombre, filas, butacas_por_fila) VALUES (?, ?, ?)`,
  )
  const insertarButaca = bd.prepare(
    `INSERT INTO butaca (sala_id, fila, numero) VALUES (?, ?, ?)`,
  )
  bd.transaction(() => {
    for (const sala of SALAS) {
      const salaId = Number(
        insertarSala.run(sala.nombre, sala.filas, sala.butacasPorFila).lastInsertRowid,
      )
      for (let fila = 0; fila < sala.filas; fila++) {
        for (let numero = 1; numero <= sala.butacasPorFila; numero++) {
          insertarButaca.run(salaId, String.fromCharCode(LETRA_A + fila), numero)
        }
      }
    }
  })()
}
