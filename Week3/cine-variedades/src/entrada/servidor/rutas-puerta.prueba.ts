import type { FastifyInstance } from 'fastify'
import { describe, expect, it } from 'vitest'
import { crearAvisos } from '../../avisos/avisos.js'
import { abrirBd, type Bd } from '../../base/bd.js'
import { listaMigraciones } from '../../base/lista-migraciones.js'
import { aplicarMigraciones } from '../../base/migraciones.js'
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../../cartelera/cartelera.js'
import { bloquear, cancelarFuncion, pagar, venderEnTaquilla } from '../../venta/venta.js'
import { crearApp } from './app.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

interface Escenario {
  app: FastifyInstance
  bd: Bd
  viernes: number
  sabado: number
  taquillaId: number
  puertaId: number
}

function escenario(): Escenario {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Luis', 'puerta', '5678')`).run()
  const viernes = programarFuncion(bd, {
    peliculaId,
    salaId: 1,
    semanaId,
    fecha: '2026-08-14',
    horaInicio: '23:00',
  })
  const sabado = programarFuncion(bd, {
    peliculaId,
    salaId: 2,
    semanaId,
    fecha: '2026-08-15',
    horaInicio: '19:00',
  })
  const app = crearApp({ bd, secretoCookies: 'secreto-de-prueba-1234567890' })
  return { app, bd, viernes, sabado, taquillaId: 1, puertaId: 2 }
}

async function sesionDe(app: FastifyInstance, pin: string): Promise<string> {
  const respuesta = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin } })
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : [String(crudas)]
  return lista.map((c) => c.split(';')[0]).join('; ')
}

describe('entrada/servidor: la puerta valida por número (T21, RF-18, RF-19, REG-2)', () => {
  it('marca las entradas de la compra como usadas, con hora y operador', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/puerta/funciones/${viernes}/validacion`,
      headers: { cookie },
      payload: { numero: compra.numero },
    })

    expect(respuesta.statusCode).toBe(200)
    const validada = respuesta.json() as { entradas: Array<{ usadaInstante: string | null; usadaOperadorId: number | null }> }
    expect(validada.entradas[0]?.usadaInstante).not.toBeNull()
    expect(validada.entradas[0]?.usadaOperadorId).toBe(2)
  })

  it('un número que no existe se rechaza ofreciendo buscar por nombre o correo (tabla de errores)', async () => {
    const { app, viernes } = escenario()
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/puerta/funciones/${viernes}/validacion`,
      headers: { cookie },
      payload: { numero: 'NOEXIS' },
    })

    expect(respuesta.statusCode).toBe(404)
    expect(respuesta.json()).toMatchObject({ error: 'CompraInexistente' })
  })

  it('un número de otra función dice de cuál es, y no valida nada', async () => {
    const { app, bd, viernes, sabado, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, sabado, [{ butacaId: 121, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/puerta/funciones/${viernes}/validacion`,
      headers: { cookie },
      payload: { numero: compra.numero },
    })

    expect(respuesta.statusCode).toBe(409)
    expect(respuesta.json()).toMatchObject({ error: 'NumeroDeOtraFuncion', funcionId: sabado })
  })

  it('unas entradas ya usadas se rechazan diciendo a qué hora y quién las validó (RN-37, RF-20)', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '5678')
    const url = `/api/puerta/funciones/${viernes}/validacion`
    await app.inject({ method: 'POST', url, headers: { cookie }, payload: { numero: compra.numero } })

    const segunda = await app.inject({ method: 'POST', url, headers: { cookie }, payload: { numero: compra.numero } })

    expect(segunda.statusCode).toBe(409)
    expect(segunda.json()).toMatchObject({ error: 'EntradaYaUsada', usadaOperadorId: 2 })
  })

  it('una compra de función cancelada no se valida: quedó devuelta (RF-20)', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 3, categoria: 'general' }], taquillaId, AHORA)
    cancelarFuncion(bd, crearAvisos(bd, AHORA), viernes, taquillaId, 'falló el proyector', AHORA)
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/puerta/funciones/${viernes}/validacion`,
      headers: { cookie },
      payload: { numero: compra.numero },
    })

    expect(respuesta.statusCode).toBe(410)
    expect(respuesta.json()).toMatchObject({ error: 'FuncionCancelada' })
  })

  it('busca por nombre o correo cuando el número está mal dictado (RF-18)', async () => {
    const { app, bd, viernes } = escenario()
    const bloqueo = bloquear(bd, viernes, [4], 'sesion-anonima', AHORA)
    const compra = pagar(bd, crearAvisos(bd, AHORA), bloqueo, CONTACTO, AHORA)
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/puerta/compras?contacto=ana@correo',
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(200)
    expect((respuesta.json() as Array<{ numero: string }>).map((c) => c.numero)).toEqual([compra.numero])
  })

  it('taquilla no puede validar en la puerta (RN-52, RN-53, RF-33)', async () => {
    const { app, viernes } = escenario()
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/puerta/funciones/${viernes}/validacion`,
      headers: { cookie },
      payload: { numero: 'ABC123' },
    })

    expect(respuesta.statusCode).toBe(403)
  })
})

describe('entrada/servidor: las funciones de una jornada en la puerta (T21, RN-10, CA-8)', () => {
  it('la función de las 23:00 del viernes pertenece a la jornada del viernes, no a la del sábado', async () => {
    const { app, viernes, sabado } = escenario()
    const cookie = await sesionDe(app, '5678')

    const delViernes = await app.inject({
      method: 'GET',
      url: '/api/puerta/funciones?jornada=2026-08-14',
      headers: { cookie },
    })
    const delSabado = await app.inject({
      method: 'GET',
      url: '/api/puerta/funciones?jornada=2026-08-15',
      headers: { cookie },
    })

    expect((delViernes.json() as Array<{ funcionId: number }>).map((f) => f.funcionId)).toEqual([viernes])
    expect((delSabado.json() as Array<{ funcionId: number }>).map((f) => f.funcionId)).toEqual([sabado])
  })
})
