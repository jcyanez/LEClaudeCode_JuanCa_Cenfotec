import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../../base/bd.js'
import { listaMigraciones } from '../../base/lista-migraciones.js'
import { aplicarMigraciones } from '../../base/migraciones.js'
import {
  ButacasYaTomadas,
  CompraAnulada,
  CompraInexistente,
  EntradaYaUsada,
  FuncionCancelada,
  NumeroDeOtraFuncion,
} from '../../venta/venta.js'
import { crearApp } from './app.js'
import { sesionAnonimaDe } from './compradores-sesion.js'
import { exigirOperador } from './operadores-sesion.js'

function bdConOperadores(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  bd.prepare(
    `INSERT INTO operador (nombre, puesto, credencial) VALUES
       ('Rosa', 'dueña', '1111'), ('Marta', 'taquilla', '2222'), ('Nico', 'puerta', '3333')`,
  ).run()
  return bd
}

function appDePrueba() {
  return crearApp({ bd: bdConOperadores(), secretoCookies: 'secreto-de-prueba-1234567890' })
}

function cookieDe(respuesta: { headers: Record<string, unknown> }, nombre: string): string | undefined {
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : crudas !== undefined ? [String(crudas)] : []
  const fila = lista.find((c) => c.startsWith(`${nombre}=`))
  return fila?.split(';')[0]
}

describe('entrada/servidor: salud (T18)', () => {
  it('responde en /api/salud', async () => {
    const app = appDePrueba()
    const respuesta = await app.inject({ method: 'GET', url: '/api/salud' })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toEqual({ estado: 'ok' })
  })
})

describe('entrada/servidor: sesión de operador (T18, RF-32, RN-54)', () => {
  it('abre sesión con un PIN válido y deja una cookie firmada', async () => {
    const app = appDePrueba()

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/operadores/sesion',
      payload: { pin: '2222' },
    })

    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toEqual({ id: 2, nombre: 'Marta', puesto: 'taquilla' })
    expect(cookieDe(respuesta, 'operador_sesion')).toBeDefined()
  })

  it('rechaza un PIN que no es de nadie, sin dar pistas de cuál sería válido', async () => {
    const app = appDePrueba()

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/operadores/sesion',
      payload: { pin: '0000' },
    })

    expect(respuesta.statusCode).toBe(401)
  })

  it('exige el PIN', async () => {
    const app = appDePrueba()

    const respuesta = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: {} })

    expect(respuesta.statusCode).toBe(400)
  })

  it('cierra la sesión y limpia la cookie', async () => {
    const app = appDePrueba()

    const respuesta = await app.inject({ method: 'DELETE', url: '/api/operadores/sesion' })

    expect(respuesta.statusCode).toBe(204)
    expect(cookieDe(respuesta, 'operador_sesion')).toBe('operador_sesion=')
  })

  it('exigirOperador rechaza sin sesión (401) y sin permiso (403), y deja el operador en el pedido (RN-54)', async () => {
    const app = appDePrueba()
    app.get('/prueba/solo-taquilla', { preHandler: exigirOperador('vender') }, async (request) => ({
      operador: request.operador,
    }))

    const sinSesion = await app.inject({ method: 'GET', url: '/prueba/solo-taquilla' })
    expect(sinSesion.statusCode).toBe(401)

    const login = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin: '3333' } })
    const cookiePuerta = cookieDe(login, 'operador_sesion') as string

    const sinPermiso = await app.inject({
      method: 'GET',
      url: '/prueba/solo-taquilla',
      headers: { cookie: cookiePuerta },
    })
    expect(sinPermiso.statusCode).toBe(403)

    const loginTaquilla = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin: '2222' } })
    const cookieTaquilla = cookieDe(loginTaquilla, 'operador_sesion') as string

    const conPermiso = await app.inject({
      method: 'GET',
      url: '/prueba/solo-taquilla',
      headers: { cookie: cookieTaquilla },
    })
    expect(conPermiso.statusCode).toBe(200)
    expect(conPermiso.json()).toEqual({ operador: { id: 2, nombre: 'Marta', puesto: 'taquilla' } })
  })

  it('una cookie alterada no identifica a nadie', async () => {
    const app = appDePrueba()
    app.get('/prueba/solo-taquilla', { preHandler: exigirOperador('vender') }, async () => ({ ok: true }))

    const respuesta = await app.inject({
      method: 'GET',
      url: '/prueba/solo-taquilla',
      headers: { cookie: 'operador_sesion=algo-inventado' },
    })

    expect(respuesta.statusCode).toBe(401)
  })
})

describe('entrada/servidor: sesión anónima del comprador (T18, RN-55, RF-10)', () => {
  it('se crea sola en la primera visita y se mantiene entre pedidos', async () => {
    const app = appDePrueba()
    app.get('/prueba/sesion-anonima', async (request, reply) => ({ sesion: sesionAnonimaDe(request, reply) }))

    const primera = await app.inject({ method: 'GET', url: '/prueba/sesion-anonima' })
    const cookieSesion = cookieDe(primera, 'sesion_anonima') as string
    expect(cookieSesion).toBeDefined()

    const segunda = await app.inject({
      method: 'GET',
      url: '/prueba/sesion-anonima',
      headers: { cookie: cookieSesion },
    })
    expect(segunda.json()).toEqual(primera.json())
    // No exige identificarse: no hay cuenta para quien compra por internet (RN-55).
  })
})

describe('entrada/servidor: traducción de rechazos de dominio (T18, tabla de errores de DISENO.md)', () => {
  const casos: [string, Error, number, Record<string, unknown>][] = [
    [
      'butacas ya tomadas',
      new ButacasYaTomadas([5, 6]),
      409,
      { error: 'ButacasYaTomadas', butacaIds: [5, 6] },
    ],
    [
      'compra inexistente',
      new CompraInexistente('XXXXXX'),
      404,
      { error: 'CompraInexistente', numero: 'XXXXXX' },
    ],
    [
      'número de otra función',
      new NumeroDeOtraFuncion('ABCDEF', 7),
      409,
      { error: 'NumeroDeOtraFuncion', funcionId: 7 },
    ],
    [
      'entrada ya usada',
      new EntradaYaUsada('ABCDEF', '2026-08-14T18:42:00', 3),
      409,
      { error: 'EntradaYaUsada', usadaInstante: '2026-08-14T18:42:00', usadaOperadorId: 3 },
    ],
    ['función cancelada', new FuncionCancelada('ABCDEF', 7), 410, { error: 'FuncionCancelada', funcionId: 7 }],
    ['compra anulada', new CompraAnulada('ABCDEF'), 409, { error: 'CompraAnulada' }],
    ['un rechazo simple sin clase propia', new Error('La función no está en venta'), 400, {}],
  ]

  it.each(casos)('%s → status y cuerpo correctos', async (_nombre, error, status, extra) => {
    const app = appDePrueba()
    app.get('/prueba/error', async () => {
      throw error
    })

    const respuesta = await app.inject({ method: 'GET', url: '/prueba/error' })

    expect(respuesta.statusCode).toBe(status)
    expect(respuesta.json()).toMatchObject({ mensaje: error.message, ...extra })
  })
})
