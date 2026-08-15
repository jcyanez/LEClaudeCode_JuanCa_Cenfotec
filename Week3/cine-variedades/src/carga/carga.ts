/**
 * T22 — Prueba de carga de `RNF-1`: 200 personas usando el sistema al mismo
 * tiempo en el peor momento (un viernes por la noche), sobre el mapa y la
 * compra (`PLAN.md`, Cierre).
 *
 * No es una prueba de la suite: levanta el **servidor real** (Fastify sobre
 * SQLite en modo WAL, el stack decidido en T0) contra una base de datos de
 * archivo temporal, dispara 200 clientes HTTP concurrentes y mide. Se corre a
 * mano con `npm run carga`.
 *
 * El escenario reparte 200 compradores sobre las 120 butacas de la Sala 1, así
 * que 80 chocan por diseño: eso es exactamente lo que pone a prueba `RNF-4`
 * —dos personas que eligen la misma butaca, una recibe el rechazo— bajo
 * concurrencia real de proceso, que es lo que la suite no puede reproducir.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { crearApp } from '../entrada/servidor/app.js'

const USUARIOS = 200
const BUTACAS_SALA_1 = 120
/** Cada comprador mira el mapa varias veces antes de decidirse: el sondeo de 3 s de T19. */
const SONDEOS_POR_USUARIO = 3
const PRECIO_GENERAL = 8000
const PRECIO_ESTUDIANTE = 5000

const JUEVES = 4
const DIAS_DE_UNA_SEMANA = 7

function sumarDias(fecha: string, dias: number): string {
  const fechaMs = new Date(`${fecha}T00:00:00Z`)
  fechaMs.setUTCDate(fechaMs.getUTCDate() + dias)
  return fechaMs.toISOString().slice(0, 10)
}

/**
 * La función de la prueba se programa en la semana siguiente para que esté en
 * venta con el reloj real del servidor, corra el día que corra (RN-3, RN-8,
 * RN-21): el sábado de esa semana, a las 19:00.
 */
function fechasDelEscenario(): { hoy: string; jueves: string; funcion: string } {
  const hoy = new Date().toISOString().slice(0, 10)
  const corrimiento = (new Date(`${hoy}T00:00:00Z`).getUTCDay() - JUEVES + DIAS_DE_UNA_SEMANA) % DIAS_DE_UNA_SEMANA
  const juevesEnCurso = sumarDias(hoy, -corrimiento)
  const jueves = sumarDias(juevesEnCurso, DIAS_DE_UNA_SEMANA)
  return { hoy, jueves, funcion: sumarDias(jueves, 2) }
}

function prepararBase(ruta: string): { bd: Bd; funcionId: number } {
  const { hoy, jueves, funcion } = fechasDelEscenario()
  const bd = abrirBd(ruta)
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La ventana indiscreta', 120)
  const semanaId = crearSemana(bd, jueves, hoy)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, PRECIO_GENERAL, PRECIO_ESTUDIANTE, hoy)
  const funcionId = programarFuncion(bd, {
    peliculaId,
    salaId: 1,
    semanaId,
    fecha: funcion,
    horaInicio: '19:00',
  })
  return { bd, funcionId }
}

interface Medicion {
  operacion: string
  milisegundos: number
  estado: number
}

async function medir(operacion: string, hacer: () => Promise<Response>): Promise<{ medicion: Medicion; respuesta: Response }> {
  const desde = performance.now()
  const respuesta = await hacer()
  return {
    medicion: { operacion, milisegundos: performance.now() - desde, estado: respuesta.status },
    respuesta,
  }
}

function percentil(valores: number[], fraccion: number): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const indice = Math.min(ordenados.length - 1, Math.floor(fraccion * ordenados.length))
  return ordenados[indice] ?? 0
}

/** Un comprador: mira el mapa varias veces, bloquea su butaca y, si la consigue, paga. */
async function comprador(base: string, funcionId: number, indice: number): Promise<Medicion[]> {
  const mediciones: Medicion[] = []
  for (let i = 0; i < SONDEOS_POR_USUARIO; i++) {
    const { medicion } = await medir('mapa', () => fetch(`${base}/api/funciones/${funcionId}/mapa`))
    mediciones.push(medicion)
  }

  const butacaId = (indice % BUTACAS_SALA_1) + 1
  const { medicion: medicionBloqueo, respuesta: bloqueo } = await medir('bloqueo', () =>
    fetch(`${base}/api/funciones/${funcionId}/bloqueo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ butacaIds: [butacaId] }),
    }),
  )
  mediciones.push(medicionBloqueo)
  if (bloqueo.status !== 200) {
    await bloqueo.text()
    return mediciones
  }

  const cookie = (bloqueo.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ')
  await bloqueo.text()

  const { medicion: medicionPago } = await medir('pago', () =>
    fetch(`${base}/api/funciones/${funcionId}/pago`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        nombre: `Comprador ${indice}`,
        correo: `comprador${indice}@correo.com`,
        telefono: '8888 0000',
      }),
    }).then(async (r) => {
      await r.text()
      return r
    }),
  )
  mediciones.push(medicionPago)
  return mediciones
}

function informe(mediciones: Medicion[]): void {
  const operaciones = ['mapa', 'bloqueo', 'pago']
  console.log('\n  Operación   Pedidos     p50       p95       máx')
  console.log('  ' + '-'.repeat(48))
  for (const operacion of operaciones) {
    const tiempos = mediciones.filter((m) => m.operacion === operacion).map((m) => m.milisegundos)
    if (tiempos.length === 0) continue
    const fila = [
      operacion.padEnd(11),
      String(tiempos.length).padStart(7),
      `${percentil(tiempos, 0.5).toFixed(1)} ms`.padStart(9),
      `${percentil(tiempos, 0.95).toFixed(1)} ms`.padStart(9),
      `${Math.max(...tiempos).toFixed(1)} ms`.padStart(9),
    ]
    console.log('  ' + fila.join(''))
  }
}

async function main(): Promise<void> {
  const carpeta = mkdtempSync(join(tmpdir(), 'cine-carga-'))
  const rutaBd = join(carpeta, 'carga.db')
  const { bd, funcionId } = prepararBase(rutaBd)
  const app = crearApp({
    bd,
    secretoCookies: 'secreto-de-la-prueba-de-carga-1234567890',
    // El correo no se toca en esta prueba: los avisos solo se encolan (RNF-5).
    enviarCorreo: async () => true,
  })

  await app.listen({ port: 0, host: '127.0.0.1' })
  const direccion = app.server.address()
  const puerto = typeof direccion === 'object' && direccion !== null ? direccion.port : 0
  const base = `http://127.0.0.1:${puerto}`

  console.log(`\nPrueba de carga de RNF-1 — ${USUARIOS} compradores simultáneos`)
  console.log(`  Servidor real en ${base}, SQLite (WAL) en ${rutaBd}`)
  console.log(`  Función ${funcionId} en Sala 1: ${BUTACAS_SALA_1} butacas para ${USUARIOS} personas`)

  const desde = performance.now()
  const porUsuario = await Promise.all(
    Array.from({ length: USUARIOS }, (_, indice) => comprador(base, funcionId, indice)),
  )
  const total = performance.now() - desde
  const mediciones = porUsuario.flat()

  informe(mediciones)

  const bloqueos = mediciones.filter((m) => m.operacion === 'bloqueo')
  const pagos = mediciones.filter((m) => m.operacion === 'pago')
  const conseguidos = bloqueos.filter((m) => m.estado === 200).length
  const rechazados = bloqueos.filter((m) => m.estado === 409).length
  const fallosDelServidor = mediciones.filter((m) => m.estado >= 500).length
  const otrosEstados = mediciones.filter((m) => ![200, 409].includes(m.estado)).length

  const dobles = bd
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT butaca_id FROM ocupacion WHERE funcion_id = ? GROUP BY butaca_id HAVING COUNT(*) > 1
       )`,
    )
    .get(funcionId) as { n: number }
  const entradas = bd
    .prepare(
      `SELECT COUNT(*) AS n FROM entrada e JOIN compra c ON c.id = e.compra_id WHERE c.funcion_id = ?`,
    )
    .get(funcionId) as { n: number }
  const butacasVendidasDosVeces = bd
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT e.butaca_id FROM entrada e JOIN compra c ON c.id = e.compra_id
         WHERE c.funcion_id = ? GROUP BY e.butaca_id HAVING COUNT(*) > 1
       )`,
    )
    .get(funcionId) as { n: number }

  console.log(`\n  Pedidos totales: ${mediciones.length} en ${(total / 1000).toFixed(2)} s`)
  console.log(`  Butacas conseguidas: ${conseguidos} · rechazos por butaca tomada (409): ${rechazados}`)
  console.log(`  Compras pagadas: ${pagos.filter((m) => m.estado === 200).length}`)

  const comprobaciones: Array<[string, boolean, string]> = [
    ['Ningún fallo del servidor (5xx)', fallosDelServidor === 0, `${fallosDelServidor} respuestas 5xx`],
    ['Ninguna respuesta fuera de 200/409', otrosEstados === 0, `${otrosEstados} respuestas inesperadas`],
    [
      'RNF-4: ninguna butaca tomada dos veces',
      dobles.n === 0,
      `${dobles.n} butacas con más de una ocupación`,
    ],
    [
      'RNF-4: ninguna butaca vendida dos veces',
      butacasVendidasDosVeces.n === 0,
      `${butacasVendidasDosVeces.n} butacas en dos compras`,
    ],
    [
      'Nunca más entradas que butacas de la sala',
      entradas.n <= BUTACAS_SALA_1,
      `${entradas.n} entradas sobre ${BUTACAS_SALA_1} butacas`,
    ],
    [
      'Cada uno de los 200 recibió respuesta',
      bloqueos.length === USUARIOS,
      `${bloqueos.length} de ${USUARIOS} intentos de bloqueo`,
    ],
  ]

  console.log('')
  let todoBien = true
  for (const [titulo, cumple, detalle] of comprobaciones) {
    console.log(`  ${cumple ? 'CUMPLE' : 'FALLA '}  ${titulo}${cumple ? '' : ` — ${detalle}`}`)
    todoBien &&= cumple
  }

  await app.close()
  bd.close()
  rmSync(carpeta, { recursive: true, force: true })

  console.log(todoBien ? '\nResultado: RNF-1 y RNF-4 se sostienen con 200 usuarios simultáneos.\n' : '\nResultado: hay comprobaciones en falla.\n')
  process.exit(todoBien ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
