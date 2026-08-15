import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBd, type Bd } from '../../base/bd.js'
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../../cartelera/cartelera.js'
import { listaMigraciones } from '../../base/lista-migraciones.js'
import { aplicarMigraciones } from '../../base/migraciones.js'
import { venderEnTaquilla } from '../../venta/venta.js'
import { crearApp } from './app.js'

const HOY = '2026-08-12'

function bdListaParaVender(): { bd: Bd; viernes: number; miercoles: number; operadorId: number } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  const viernes = programarFuncion(bd, {
    peliculaId,
    salaId: 1,
    semanaId,
    fecha: '2026-08-14',
    horaInicio: '19:00',
  })
  const miercoles = programarFuncion(bd, {
    peliculaId,
    salaId: 2,
    semanaId,
    fecha: '2026-08-19',
    horaInicio: '19:00',
  })
  return { bd, viernes, miercoles, operadorId: 1 }
}

function appDePrueba() {
  const datos = bdListaParaVender()
  const app = crearApp({ bd: datos.bd, secretoCookies: 'secreto-de-prueba-1234567890' })
  return { app, ...datos }
}

function cookieDe(respuesta: { headers: Record<string, unknown> }, nombre: string): string | undefined {
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : crudas !== undefined ? [String(crudas)] : []
  return lista.find((c) => c.startsWith(`${nombre}=`))?.split(';')[0]
}

const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

/**
 * Las rutas leen el reloj del servidor (`ahoraServidor`), así que sin congelarlo
 * el escenario caduca solo: pasado el 14/08/2026 a las 19:00 la función del
 * viernes deja de estar en venta (RN-21) y estas pruebas fallarían por el
 * calendario, no por el sistema. Se congela en el mismo instante que el
 * escenario ya usa para vender, una hora antes de esa función.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-14T18:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('entrada/servidor: cartelera pública (T19, RF-8)', () => {
  it('lista las funciones en venta con sus precios, sin exigir sesión', async () => {
    const { app, viernes, miercoles } = appDePrueba()

    const respuesta = await app.inject({ method: 'GET', url: '/api/cartelera' })

    expect(respuesta.statusCode).toBe(200)
    const cuerpo = respuesta.json() as Array<Record<string, unknown>>
    expect(cuerpo.map((f) => f.funcionId)).toEqual([viernes, miercoles])
    expect(cuerpo[0]).toMatchObject({ categoriaBase: 'general', precios: { general: 8000, estudiante: 5000 } })
    expect(cuerpo[1]).toMatchObject({ categoriaBase: 'miercoles', precios: { miercoles: 4000 } })
  })
})

describe('entrada/servidor: mapa de butacas público (T19, RF-9, RN-56, CA-9)', () => {
  it('colapsa cualquier motivo a "no-disponible": una bloqueada y una vendida se ven igual', async () => {
    const { app, bd, viernes, operadorId } = appDePrueba()
    await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1] },
    })
    // Butaca 2 vendida directamente en el dominio, sin pasar por taquilla (T20).
    venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], operadorId, '2026-08-14T18:00:00')

    const respuesta = await app.inject({ method: 'GET', url: `/api/funciones/${viernes}/mapa` })

    expect(respuesta.statusCode).toBe(200)
    const cuerpo = respuesta.json() as { mapa: Array<{ butacaId: number; estado: string }> }
    expect(cuerpo.mapa.find((b) => b.butacaId === 1)?.estado).toBe('no-disponible')
    expect(cuerpo.mapa.find((b) => b.butacaId === 2)?.estado).toBe('no-disponible')
    expect(cuerpo.mapa.find((b) => b.butacaId === 3)?.estado).toBe('libre')
  })

  it('responde 404 si la función no existe', async () => {
    const { app } = appDePrueba()

    const respuesta = await app.inject({ method: 'GET', url: '/api/funciones/999/mapa' })

    expect(respuesta.statusCode).toBe(404)
  })
})

describe('entrada/servidor: flujo bloqueo → pago → número (T19, RF-10, RF-11, RN-19)', () => {
  it('bloquea, paga y devuelve el número de compra, manteniendo la sesión anónima entre pedidos', async () => {
    const { app, viernes } = appDePrueba()

    const bloqueo = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1, 2] },
    })
    expect(bloqueo.statusCode).toBe(200)
    const sesion = cookieDe(bloqueo, 'sesion_anonima') as string
    expect(sesion).toBeDefined()

    const pago = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/pago`,
      headers: { cookie: sesion },
      payload: CONTACTO,
    })

    expect(pago.statusCode).toBe(200)
    const compra = pago.json() as { numero: string; canal: string; montoTotal: number }
    expect(compra.canal).toBe('internet')
    expect(compra.montoTotal).toBe(16000)
    expect(compra.numero).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it('sin cookie de sesión no hay bloqueo que pagar (tabla de errores)', async () => {
    const { app, viernes } = appDePrueba()

    const pago = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/pago`,
      payload: CONTACTO,
    })

    expect(pago.statusCode).toBe(410)
  })

  it('exige nombre, correo y teléfono para pagar', async () => {
    const { app, viernes } = appDePrueba()
    const bloqueo = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1] },
    })
    const sesion = cookieDe(bloqueo, 'sesion_anonima') as string

    const pago = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/pago`,
      headers: { cookie: sesion },
      payload: { nombre: 'Ana' },
    })

    expect(pago.statusCode).toBe(400)
  })

  it('rechaza un bloqueo sin butacas', async () => {
    const { app, viernes } = appDePrueba()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [] },
    })

    expect(respuesta.statusCode).toBe(400)
  })

  it('dos sesiones distintas por la misma butaca: una gana, la otra recibe el rechazo (RNF-4, CA-1)', async () => {
    const { app, viernes } = appDePrueba()

    const primera = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1] },
    })
    expect(primera.statusCode).toBe(200)

    const segunda = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1] },
    })
    expect(segunda.statusCode).toBe(409)
    expect(segunda.json()).toMatchObject({ error: 'ButacasYaTomadas', butacaIds: [1] })
  })
})

describe('entrada/servidor: reserva de estudiante (T19, RF-14)', () => {
  it('reserva sin pago y devuelve el número', async () => {
    const { app, viernes } = appDePrueba()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/reserva`,
      payload: { butacaIds: [1], ...CONTACTO },
    })

    expect(respuesta.statusCode).toBe(200)
    const reserva = respuesta.json() as { numero: string; funcionId: number }
    expect(reserva.funcionId).toBe(viernes)
    expect(reserva.numero).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it('no hay reservas en las funciones de miércoles (RN-14)', async () => {
    const { app, miercoles } = appDePrueba()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/funciones/${miercoles}/reserva`,
      payload: { butacaIds: [1], ...CONTACTO },
    })

    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json()).toMatchObject({ mensaje: 'En las funciones de miércoles no hay reservas de estudiante' })
  })
})
