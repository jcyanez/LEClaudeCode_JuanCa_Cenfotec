/**
 * Datos de prueba para ver el sistema funcionando (`npm run semilla`).
 *
 * No son datos del negocio: son los que hacen falta para que alguien abra la
 * aplicación y vea una cartelera con funciones en venta, un mapa de butacas y
 * los tres puestos con su PIN. `principal.ts` deliberadamente **no** los carga
 * —siembra solo las salas, que sí son un dato fijo (`RN-1`)—, porque la
 * cartelera real la carga la dueña desde su pantalla.
 *
 * Las fechas se calculan a partir de hoy, nunca fijas: la semana de cartelera
 * va de jueves a miércoles (`RN-3`) y solo pueden estar cargadas la en curso y
 * la siguiente (`RN-8`), así que una semilla con fechas escritas a mano
 * dejaría de servir a los pocos días.
 *
 * Es idempotente: correrla dos veces no duplica nada.
 */
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  peliculas,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { fijarCorreoDelDistribuidor } from '../salidas/salidas.js'

const JUEVES = 4
const DIAS_DE_UNA_SEMANA = 7

/** Precios de ejemplo, en céntimos de colón: ₡8 000 general, ₡5 000 estudiante. */
const PRECIO_GENERAL = 8000
const PRECIO_ESTUDIANTE = 5000

const PELICULAS: Array<{ titulo: string; duracionMinutos: number }> = [
  { titulo: 'La ventana indiscreta', duracionMinutos: 112 },
  { titulo: 'Cinema Paradiso', duracionMinutos: 155 },
]

/** Los tres puestos de `RN-50`, cada uno con un PIN corto para entrar a su pantalla. */
const OPERADORES: Array<{ nombre: string; puesto: string; pin: string }> = [
  { nombre: 'Rosa (dueña)', puesto: 'dueña', pin: '9999' },
  { nombre: 'Marta (taquilla)', puesto: 'taquilla', pin: '1234' },
  { nombre: 'Luis (puerta)', puesto: 'puerta', pin: '5678' },
]

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function sumarDias(fecha: string, dias: number): string {
  const fechaMs = new Date(`${fecha}T00:00:00Z`)
  fechaMs.setUTCDate(fechaMs.getUTCDate() + dias)
  return fechaMs.toISOString().slice(0, 10)
}

function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay()
}

/** El jueves que abre la semana de cartelera a la que pertenece una fecha (`RN-3`). */
function juevesDeLaSemanaDe(fecha: string): string {
  return sumarDias(fecha, -((diaDeLaSemana(fecha) - JUEVES + DIAS_DE_UNA_SEMANA) % DIAS_DE_UNA_SEMANA))
}

function sembrarOperadores(bd: Bd): number {
  // El esquema no exige que la credencial sea única (no hay `UNIQUE` en esa
  // columna), así que la repetición se evita acá con una consulta previa.
  const insertar = bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES (?, ?, ?)`)
  let creados = 0
  for (const operador of OPERADORES) {
    const yaEsta = bd.prepare(`SELECT 1 FROM operador WHERE credencial = ?`).get(operador.pin)
    if (yaEsta !== undefined) continue
    insertar.run(operador.nombre, operador.puesto, operador.pin)
    creados++
  }
  return creados
}

/**
 * Programa una función por día en cada sala, a partir de mañana y hasta que
 * termine la semana. Se salta el día si ya hay una función de esa sala a esa
 * hora, para poder correr la semilla dos veces sin chocar con el margen de 20
 * minutos entre funciones (`RN-6`).
 */
function sembrarFunciones(bd: Bd, semanaId: number, jueves: string, peliculaIds: number[]): number {
  const desde = sumarDias(hoy(), 1)
  let creadas = 0
  for (let dia = 0; dia < DIAS_DE_UNA_SEMANA; dia++) {
    const fecha = sumarDias(jueves, dia)
    if (fecha < desde) continue
    // Sala 1 a las 19:00 y Sala 2 a las 20:00: una por sala y por día, sin choques.
    const programadas: Array<{ salaId: number; horaInicio: string; peliculaId: number }> = [
      { salaId: 1, horaInicio: '19:00', peliculaId: peliculaIds[0] as number },
      { salaId: 2, horaInicio: '20:00', peliculaId: peliculaIds[1] as number },
    ]
    for (const funcion of programadas) {
      const yaEsta = bd
        .prepare(`SELECT 1 FROM funcion WHERE sala_id = ? AND fecha = ? AND hora_inicio = ?`)
        .get(funcion.salaId, fecha, funcion.horaInicio)
      if (yaEsta !== undefined) continue
      programarFuncion(bd, { ...funcion, semanaId, fecha })
      creadas++
    }
  }
  return creadas
}

function semanaCargada(bd: Bd, jueves: string): number {
  const existente = bd
    .prepare(`SELECT id FROM semana_cartelera WHERE jueves_inicio = ?`)
    .get(jueves) as { id: number } | undefined
  if (existente !== undefined) return existente.id
  return crearSemana(bd, jueves, hoy())
}

export function sembrarDatosDePrueba(bd: Bd): void {
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)

  const operadoresCreados = sembrarOperadores(bd)

  for (const pelicula of PELICULAS) {
    const yaEsta = peliculas(bd).some((p) => p.titulo === pelicula.titulo)
    if (!yaEsta) registrarPelicula(bd, pelicula.titulo, pelicula.duracionMinutos)
  }
  const peliculaIds = PELICULAS.map(
    (pelicula) => peliculas(bd).find((p) => p.titulo === pelicula.titulo)?.id as number,
  )

  // Los precios llevan fecha desde: se fijan una sola vez (RN-12, historial de DISENO.md).
  const hayPrecios = bd.prepare(`SELECT 1 FROM precio_vigente LIMIT 1`).get() !== undefined
  if (!hayPrecios) fijarPrecios(bd, PRECIO_GENERAL, PRECIO_ESTUDIANTE, sumarDias(hoy(), -30))

  const juevesEnCurso = juevesDeLaSemanaDe(hoy())
  const juevesSiguiente = sumarDias(juevesEnCurso, DIAS_DE_UNA_SEMANA)

  let funcionesCreadas = 0
  for (const jueves of [juevesEnCurso, juevesSiguiente]) {
    const semanaId = semanaCargada(bd, jueves)
    funcionesCreadas += sembrarFunciones(bd, semanaId, jueves, peliculaIds)
    // La venta se abre acá para que la cartelera tenga algo que mostrar; en la
    // vida real la abre la dueña cuando da la semana por cargada (RN-9, RF-5).
    abrirVenta(bd, semanaId)
  }

  if (bd.prepare(`SELECT 1 FROM configuracion WHERE clave = 'correo-distribuidor'`).get() === undefined) {
    fijarCorreoDelDistribuidor(bd, 'distribuidor@ejemplo.com')
  }

  const enVenta = bd.prepare(`SELECT COUNT(*) AS n FROM funcion`).get() as { n: number }
  console.log('Datos de prueba listos:')
  console.log(`  Operadores nuevos: ${operadoresCreados} (PIN dueña 9999 · taquilla 1234 · puerta 5678)`)
  console.log(`  Funciones nuevas: ${funcionesCreadas} · total en la base: ${enVenta.n}`)
  console.log(`  Semanas cargadas y abiertas: ${juevesEnCurso} y ${juevesSiguiente}`)
  console.log(`  Precios: ₡${PRECIO_GENERAL} general · ₡${PRECIO_ESTUDIANTE} estudiante`)
  console.log('  Los miércoles salen a mitad de precio y sin reservas (RN-13, RN-14).')
}

const rutaBd = process.env.RUTA_BD ?? 'cine-variedades.db'
const bd = abrirBd(rutaBd)
console.log(`Base de datos: ${rutaBd}`)
sembrarDatosDePrueba(bd)
bd.close()
