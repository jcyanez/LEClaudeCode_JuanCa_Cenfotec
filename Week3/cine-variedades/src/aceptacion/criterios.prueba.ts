/**
 * T22 — Verificación final: los diez criterios de aceptación de
 * `ESPECIFICACION.md`, uno por prueba y nombrados por su identificador, para
 * que el recorrido quede como constancia ejecutable y no como una lista en un
 * documento (`PLAN.md`, Cierre).
 *
 * Cada criterio se ejerce por donde lo enuncia: los que hablan de canales o de
 * pantallas (CA-1, CA-3, CA-9, CA-10) pasan por las rutas HTTP reales, y los
 * que fijan un instante al segundo o una jornada (CA-2, CA-4, CA-5, CA-6,
 * CA-7, CA-8) van por el dominio, que recibe `ahora` como parámetro. Ninguna
 * regla nueva se define acá: esta suite solo observa.
 */
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearAvisos } from '../avisos/avisos.js'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import {
  abrirVenta,
  butacasDe,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { cierreDeCaja, reporteMensual } from '../salidas/salidas.js'
import {
  anular,
  bloquear,
  cancelarFuncion,
  marcarDevolucionEntregada,
  pagar,
  reservar,
  validar,
  venderEnTaquilla,
  buscarCompra,
} from '../venta/venta.js'
import { crearApp } from '../entrada/servidor/app.js'

/** El jueves que abre la semana de cartelera; la carga la dueña el miércoles anterior (RN-3, RN-9). */
const JUEVES = '2026-08-13'
const CARGA = '2026-08-12'
/** Una hora antes de la función del viernes: el instante en que se opera en todas estas pruebas. */
const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }
const PRECIO_GENERAL = 8000
const PRECIO_ESTUDIANTE = 5000

interface Escenario {
  bd: Bd
  app: FastifyInstance
  /** Viernes 19:00 en Sala 1 (120 butacas), película de 120 minutos. */
  viernes: number
  /** Miércoles 19:00 en Sala 2: media entrada y sin estudiante ni reservas (RN-13, RN-14). */
  miercoles: number
  peliculaId: number
  semanaId: number
  taquillaId: number
  puertaId: number
}

function escenario(): Escenario {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La ventana indiscreta', 120)
  const semanaId = crearSemana(bd, JUEVES, CARGA)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, PRECIO_GENERAL, PRECIO_ESTUDIANTE, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Luis', 'puerta', '5678')`).run()
  const viernes = programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '19:00' })
  const miercoles = programarFuncion(bd, { peliculaId, salaId: 2, semanaId, fecha: '2026-08-19', horaInicio: '19:00' })
  const app = crearApp({ bd, secretoCookies: 'secreto-de-prueba-1234567890' })
  return { bd, app, viernes, miercoles, peliculaId, semanaId, taquillaId: 1, puertaId: 2 }
}

/**
 * Las rutas leen el reloj del servidor, así que se congela en el mismo instante
 * en que opera el escenario. Sin esto, la suite caducaría con el calendario:
 * pasado el inicio de la función, ya no está en venta (RN-21).
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${AHORA}Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

async function sesionDe(app: FastifyInstance, pin: string): Promise<string> {
  const respuesta = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin } })
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : [String(crudas)]
  return lista.map((c) => c.split(';')[0]).join('; ')
}

describe('CA-1 — dos personas, la misma butaca: una queda con ella, la otra recibe el rechazo (RNF-4, RF-10)', () => {
  it('nunca las dos: exactamente un bloqueo gana y el otro dice cuál se adelantó', async () => {
    const { app, viernes } = escenario()

    // Dos sesiones anónimas distintas —ninguna manda cookie— pidiendo la misma butaca.
    const [primera, segunda] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/funciones/${viernes}/bloqueo`, payload: { butacaIds: [1] } }),
      app.inject({ method: 'POST', url: `/api/funciones/${viernes}/bloqueo`, payload: { butacaIds: [1] } }),
    ])

    const estados = [primera.statusCode, segunda.statusCode].sort()
    expect(estados).toEqual([200, 409])
    const rechazada = primera.statusCode === 409 ? primera : segunda
    expect(rechazada.json()).toMatchObject({ error: 'ButacasYaTomadas', butacaIds: [1] })
  })

  it('con veinte pidiendo la misma butaca a la vez, la butaca queda una sola vez tomada', async () => {
    const { app, bd, viernes } = escenario()

    const respuestas = await Promise.all(
      Array.from({ length: 20 }, () =>
        app.inject({ method: 'POST', url: `/api/funciones/${viernes}/bloqueo`, payload: { butacaIds: [7] } }),
      ),
    )

    expect(respuestas.filter((r) => r.statusCode === 200)).toHaveLength(1)
    expect(respuestas.filter((r) => r.statusCode === 409)).toHaveLength(19)
    // La garantía no la sostiene el código sino la unicidad de (función, butaca) en el motor (DISENO.md, decisión 2).
    const filas = bd
      .prepare(`SELECT COUNT(*) AS n FROM ocupacion WHERE funcion_id = ? AND butaca_id = 7`)
      .get(viernes) as { n: number }
    expect(filas.n).toBe(1)
  })
})

describe('CA-2 — el borde de un segundo antes y después del inicio (RN-21, RF-13)', () => {
  it('una compra confirmada 1 segundo antes de la hora de inicio se registra', () => {
    const { bd, viernes } = escenario()
    const avisos = crearAvisos(bd, '2026-08-14T18:59:00')
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-anonima', '2026-08-14T18:59:00')

    const compra = pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T18:59:59')

    expect(compra.estado).toBe('pagada')
    expect(buscarCompra(bd, compra.numero)?.numero).toBe(compra.numero)
  })

  it('una compra confirmada 1 segundo después se rechaza y no deja rastro', () => {
    const { bd, viernes } = escenario()
    const avisos = crearAvisos(bd, '2026-08-14T18:59:00')
    // El bloqueo todavía está vivo (vence 19:04): lo que cerró es la venta de la función.
    const bloqueo = bloquear(bd, viernes, [2], 'otra-sesion', '2026-08-14T18:59:00')

    expect(() => pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T19:00:01')).toThrow(
      'La función no está en venta',
    )
    const compras = bd.prepare(`SELECT COUNT(*) AS n FROM compra`).get() as { n: number }
    expect(compras.n).toBe(0)
  })
})

describe('CA-3 — miércoles: ni estudiante ni reservas, y todo a mitad del general (RN-13, RN-14, RF-14)', () => {
  it('la cartelera no ofrece la categoría estudiante para una función de miércoles', async () => {
    const { app, miercoles } = escenario()

    const respuesta = await app.inject({ method: 'GET', url: '/api/cartelera' })

    const funcion = (respuesta.json() as Array<{ funcionId: number; precios: Record<string, number> }>).find(
      (f) => f.funcionId === miercoles,
    )
    expect(funcion?.precios).toEqual({ miercoles: PRECIO_GENERAL / 2 })
    expect(funcion?.precios.estudiante).toBeUndefined()
  })

  it('no permite reservar en una función de miércoles', async () => {
    const { app, miercoles } = escenario()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/funciones/${miercoles}/reserva`,
      payload: { butacaIds: [121], ...CONTACTO },
    })

    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json()).toMatchObject({
      mensaje: 'En las funciones de miércoles no hay reservas de estudiante',
    })
  })

  it('toda entrada sale a la mitad del precio general, y ninguna otra categoría se admite', () => {
    const { bd, miercoles, taquillaId } = escenario()

    const compra = venderEnTaquilla(bd, miercoles, [{ butacaId: 121, categoria: 'miercoles' }], taquillaId, AHORA)

    expect(compra.montoTotal).toBe(PRECIO_GENERAL / 2)
    expect(compra.entradas.at(0)?.monto).toBe(PRECIO_GENERAL / 2)
    expect(() =>
      venderEnTaquilla(bd, miercoles, [{ butacaId: 122, categoria: 'estudiante' }], taquillaId, AHORA),
    ).toThrow('En las funciones de miércoles no existe el precio de estudiante')
    expect(() =>
      venderEnTaquilla(bd, miercoles, [{ butacaId: 122, categoria: 'general' }], taquillaId, AHORA),
    ).toThrow('En las funciones de miércoles toda entrada se vende a la categoría miércoles')
  })
})

describe('CA-4 — un cambio de precio no altera lo ya vendido (RN-16, REG-1)', () => {
  it('la compra anterior conserva su monto en el cierre de caja y en el reporte del mes', () => {
    const { bd, viernes, taquillaId } = escenario()
    const compraVieja = venderEnTaquilla(
      bd,
      viernes,
      [{ butacaId: 1, categoria: 'general' }],
      taquillaId,
      AHORA,
    )

    // La dueña sube el precio con vigencia desde el día anterior a la función (RN-12, RN-15).
    fijarPrecios(bd, 12000, 7000, '2026-08-13')
    const compraNueva = venderEnTaquilla(
      bd,
      viernes,
      [{ butacaId: 2, categoria: 'general' }],
      taquillaId,
      '2026-08-14T18:30:00',
    )

    expect(compraVieja.montoTotal).toBe(PRECIO_GENERAL)
    expect(compraNueva.montoTotal).toBe(12000)
    // El cierre y el reporte suman lo congelado en cada entrada, no el precio de hoy.
    expect(cierreDeCaja(bd, '2026-08-14').ventanilla.cobrado).toBe(PRECIO_GENERAL + 12000)
    const detalle = reporteMensual(bd, '2026-08').find((f) => f.funcionId === viernes)
    expect(detalle?.montoVendido).toBe(PRECIO_GENERAL + 12000)
    expect(buscarCompra(bd, compraVieja.numero)?.entradas.at(0)?.monto).toBe(PRECIO_GENERAL)
  })
})

describe('CA-5 — función cancelada con entradas vendidas y validadas (RN-41, RF-23, RF-27)', () => {
  it('ninguna compra queda pagada y la función aparece cancelada en el reporte, con sus entradas a la vista', () => {
    const { bd, viernes, taquillaId, puertaId } = escenario()
    const avisos = crearAvisos(bd, AHORA)
    const validada = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], taquillaId, AHORA)
    const sinValidar = venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], taquillaId, AHORA)
    validar(bd, viernes, validada.numero, puertaId, '2026-08-14T18:40:00')

    const devueltas = cancelarFuncion(bd, avisos, viernes, taquillaId, 'Se dañó el proyector', '2026-08-14T18:45:00')

    expect(devueltas).toHaveLength(2)
    expect(buscarCompra(bd, validada.numero)?.estado).toBe('devuelta')
    expect(buscarCompra(bd, sinValidar.numero)?.estado).toBe('devuelta')
    const detalle = reporteMensual(bd, '2026-08').find((f) => f.funcionId === viernes)
    expect(detalle?.cancelada).toBe(true)
    expect(detalle?.entradasVendidas).toBe(2)
    expect(detalle?.montoVendido).toBe(PRECIO_GENERAL * 2)
  })
})

describe('CA-6 — la parte de ventanilla del cierre (RN-44, RN-45, RF-26)', () => {
  it('coincide con lo cobrado menos las devoluciones entregadas esa jornada, y no incluye internet', () => {
    const { bd, viernes, taquillaId } = escenario()
    const avisos = crearAvisos(bd, AHORA)
    const enEfectivo = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], taquillaId, AHORA)
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], taquillaId, AHORA)
    const bloqueo = bloquear(bd, viernes, [3], 'sesion-anonima', AHORA)
    pagar(bd, avisos, bloqueo, CONTACTO, AHORA)

    anular(bd, enEfectivo.numero, taquillaId, 'Se arrepintió', '2026-08-14T18:20:00')
    marcarDevolucionEntregada(bd, enEfectivo.numero, taquillaId, '2026-08-14T18:25:00')
    const cierre = cierreDeCaja(bd, '2026-08-14')

    expect(cierre.ventanilla.cobrado).toBe(PRECIO_GENERAL * 2)
    expect(cierre.ventanilla.devuelto).toBe(PRECIO_GENERAL)
    expect(cierre.ventanilla.efectivoEsperado).toBe(PRECIO_GENERAL)
    // Internet queda aparte y solo informativo: nunca se mezcla con el efectivo (RN-46).
    expect(cierre.internet.vendido).toBe(PRECIO_GENERAL)
  })

  it('una devolución entregada en otra jornada no descuenta la de la venta (RN-44)', () => {
    const { bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], taquillaId, AHORA)
    anular(bd, compra.numero, taquillaId, 'Se arrepintió', '2026-08-14T18:20:00')

    marcarDevolucionEntregada(bd, compra.numero, taquillaId, '2026-08-17T10:00:00')

    expect(cierreDeCaja(bd, '2026-08-14').ventanilla.efectivoEsperado).toBe(PRECIO_GENERAL)
    expect(cierreDeCaja(bd, '2026-08-17').ventanilla.devuelto).toBe(PRECIO_GENERAL)
  })
})

describe('CA-7 — el margen de 20 minutos entre funciones de una misma sala (RN-6, RF-3)', () => {
  it('una de 120 minutos a las 19:00 impide otra antes de las 21:20 y admite una a las 21:20', () => {
    const { bd, peliculaId, semanaId } = escenario()

    expect(() =>
      programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '21:19' }),
    ).toThrow('La primera hora posible es 21:20')

    const admitida = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '21:20',
    })
    expect(admitida).toBeGreaterThan(0)
  })
})

describe('CA-8 — la función de las 23:00 del viernes pertenece a la jornada del viernes (RN-10, RN-11, RN-42)', () => {
  it('se puede cancelar a las 00:15 del sábado y su venta aparece en el cierre del viernes', () => {
    const { bd, peliculaId, semanaId, taquillaId } = escenario()
    const avisos = crearAvisos(bd, AHORA)
    const trasnoche = programarFuncion(bd, {
      peliculaId,
      salaId: 2,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '23:00',
    })
    const compra = venderEnTaquilla(
      bd,
      trasnoche,
      [{ butacaId: 121, categoria: 'general' }],
      taquillaId,
      '2026-08-14T22:00:00',
    )

    expect(compra.jornada).toBe('2026-08-14')
    expect(cierreDeCaja(bd, '2026-08-14').ventanilla.cobrado).toBe(PRECIO_GENERAL)

    // Pasada la medianoche sigue siendo la jornada del viernes: el plazo de RN-42 no venció.
    const devueltas = cancelarFuncion(bd, avisos, trasnoche, taquillaId, 'No llegó la copia', '2026-08-15T00:15:00')
    expect(devueltas).toHaveLength(1)
    expect(buscarCompra(bd, compra.numero)?.estado).toBe('devuelta')
  })
})

describe('CA-9 — el mismo estado se ve distinto según quién mira (RN-56, RN-57, RF-9)', () => {
  it('en el mapa público una butaca bloqueada y una vendida se ven exactamente igual', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    bloquear(bd, viernes, [1], 'sesion-anonima', AHORA)
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], taquillaId, AHORA)

    const respuesta = await app.inject({ method: 'GET', url: `/api/funciones/${viernes}/mapa` })

    const mapa = (respuesta.json() as { mapa: Array<{ butacaId: number; estado: string }> }).mapa
    expect(mapa.find((b) => b.butacaId === 1)?.estado).toBe('no-disponible')
    expect(mapa.find((b) => b.butacaId === 2)?.estado).toBe('no-disponible')
    expect(mapa.find((b) => b.butacaId === 3)?.estado).toBe('libre')
  })

  it('en el mapa de taquilla se ven distinto, con la reserva aparte', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const avisos = crearAvisos(bd, AHORA)
    bloquear(bd, viernes, [1], 'sesion-anonima', AHORA)
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], taquillaId, AHORA)
    reservar(bd, avisos, viernes, [3], CONTACTO, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/taquilla/funciones/${viernes}/mapa`,
      headers: { cookie },
    })

    const mapa = (respuesta.json() as { mapa: Array<{ butacaId: number; estado: string; numero: string | null }> })
      .mapa
    expect(mapa.find((b) => b.butacaId === 1)?.estado).toBe('bloqueada')
    expect(mapa.find((b) => b.butacaId === 2)?.estado).toBe('vendida')
    expect(mapa.find((b) => b.butacaId === 3)?.estado).toBe('reservada')
    expect(mapa.find((b) => b.butacaId === 4)?.estado).toBe('libre')
    // El número de la reserva sí; la sesión anónima de quien bloqueó, nunca (RN-55).
    expect(mapa.find((b) => b.butacaId === 3)?.numero).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    expect(mapa.find((b) => b.butacaId === 1)?.numero).toBeNull()
  })
})

describe('CA-10 — el mapa de una función de Sala 1 (RN-1, RN-2, RF-9)', () => {
  it('muestra 120 butacas en 10 filas de 12, de la A1 a la J12', async () => {
    const { app, viernes } = escenario()

    const respuesta = await app.inject({ method: 'GET', url: `/api/funciones/${viernes}/mapa` })

    const cuerpo = respuesta.json() as {
      funcion: { filas: number; butacasPorFila: number }
      mapa: Array<{ etiqueta: string }>
    }
    expect(cuerpo.mapa).toHaveLength(120)
    expect(cuerpo.funcion.filas).toBe(10)
    expect(cuerpo.funcion.butacasPorFila).toBe(12)
    expect(cuerpo.mapa.at(0)?.etiqueta).toBe('A1')
    expect(cuerpo.mapa.at(-1)?.etiqueta).toBe('J12')
    // Las diez filas van de la A a la J, doce butacas cada una (RN-2).
    const porFila = new Map<string, number>()
    for (const butaca of cuerpo.mapa) {
      const fila = butaca.etiqueta.slice(0, 1)
      porFila.set(fila, (porFila.get(fila) ?? 0) + 1)
    }
    expect([...porFila.keys()]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])
    expect([...porFila.values()].every((n) => n === 12)).toBe(true)
  })

  it('las butacas de la sala son fijas y no dependen de la función (RN-1)', () => {
    const { bd } = escenario()

    expect(butacasDe(bd, 1)).toHaveLength(120)
    expect(butacasDe(bd, 2)).toHaveLength(60)
  })
})
