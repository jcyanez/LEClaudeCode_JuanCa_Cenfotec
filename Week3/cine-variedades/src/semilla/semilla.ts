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

/**
 * Tres películas de repertorio, de tres tonos distintos, para que la cartelera
 * no se vea como una lista de lo mismo.
 *
 * **El género no se guarda**: `Película` es título y duración (`RN-4`), y no se
 * agregan campos que la especificación no tiene. Que una sea de terror y otra
 * de comedia vive en el título y en nada más; el sistema no puede filtrar ni
 * agrupar por género, y no debería aparentar que sí.
 */
const PELICULAS: Array<{ titulo: string; duracionMinutos: number }> = [
  { titulo: 'Ventanada indiscreta', duracionMinutos: 112 },
  { titulo: 'El resplandor', duracionMinutos: 146 },
  { titulo: 'Tiempos modernos', duracionMinutos: 87 },
]

/**
 * La programación de un día, igual para toda la semana: **tres funciones por
 * sala**, que es lo que este cine programa.
 *
 * El margen de `RN-6` —20 minutos libres entre el fin de una función y el
 * inicio de la siguiente en la misma sala— está comprobado acá abajo función
 * por función. Si alguien mueve una hora, tiene que rehacer la cuenta: el
 * servidor la va a rechazar igual (`RF-3`), pero es mejor verlo escrito.
 */
const PROGRAMACION_DIARIA: Array<{ salaId: number; horaInicio: string; titulo: string }> = [
  // Sala 1, 120 butacas.
  { salaId: 1, horaInicio: '15:00', titulo: 'Tiempos modernos' }, //      87 min → 16:27
  { salaId: 1, horaInicio: '17:00', titulo: 'Ventanada indiscreta' }, // 33 min de margen; 112 min → 18:52
  { salaId: 1, horaInicio: '19:30', titulo: 'Ventanada indiscreta' }, // 38 min de margen; 112 min → 21:22
  // Sala 2, 60 butacas.
  { salaId: 2, horaInicio: '15:30', titulo: 'Tiempos modernos' }, //      87 min → 16:57
  { salaId: 2, horaInicio: '17:30', titulo: 'El resplandor' }, //         33 min de margen; 146 min → 19:56
  { salaId: 2, horaInicio: '20:30', titulo: 'El resplandor' }, //         34 min de margen; 146 min → 22:56
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
 * Programa la grilla diaria en las dos salas, a partir de mañana y hasta que
 * termine la semana. Se salta la función si ya hay una de esa sala a esa hora,
 * para poder correr la semilla dos veces sin chocar con el margen de 20 minutos
 * entre funciones (`RN-6`).
 */
function sembrarFunciones(bd: Bd, semanaId: number, jueves: string, idPorTitulo: Map<string, number>): number {
  const desde = sumarDias(hoy(), 1)
  let creadas = 0
  for (let dia = 0; dia < DIAS_DE_UNA_SEMANA; dia++) {
    const fecha = sumarDias(jueves, dia)
    if (fecha < desde) continue
    for (const funcion of PROGRAMACION_DIARIA) {
      const yaEsta = bd
        .prepare(`SELECT 1 FROM funcion WHERE sala_id = ? AND fecha = ? AND hora_inicio = ?`)
        .get(funcion.salaId, fecha, funcion.horaInicio)
      if (yaEsta !== undefined) continue
      const peliculaId = idPorTitulo.get(funcion.titulo)
      if (peliculaId === undefined) throw new Error(`La programación nombra una película que no existe: ${funcion.titulo}`)
      programarFuncion(bd, { salaId: funcion.salaId, horaInicio: funcion.horaInicio, peliculaId, semanaId, fecha })
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
  // Por título y no por posición: la programación nombra la película que va en
  // cada horario, así que reordenar la lista de arriba no puede cambiar en
  // silencio qué se proyecta.
  const idPorTitulo = new Map(peliculas(bd).map((pelicula) => [pelicula.titulo, pelicula.id]))

  // Los precios llevan fecha desde: se fijan una sola vez (RN-12, historial de DISENO.md).
  const hayPrecios = bd.prepare(`SELECT 1 FROM precio_vigente LIMIT 1`).get() !== undefined
  if (!hayPrecios) fijarPrecios(bd, PRECIO_GENERAL, PRECIO_ESTUDIANTE, sumarDias(hoy(), -30))

  const juevesEnCurso = juevesDeLaSemanaDe(hoy())
  const juevesSiguiente = sumarDias(juevesEnCurso, DIAS_DE_UNA_SEMANA)

  let funcionesCreadas = 0
  for (const jueves of [juevesEnCurso, juevesSiguiente]) {
    const semanaId = semanaCargada(bd, jueves)
    funcionesCreadas += sembrarFunciones(bd, semanaId, jueves, idPorTitulo)
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
