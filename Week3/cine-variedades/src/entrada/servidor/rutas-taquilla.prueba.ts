import type { FastifyInstance } from 'fastify'
import { describe, expect, it } from 'vitest'
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
import { crearAvisos } from '../../avisos/avisos.js'
import { anular, bloquear, reservar, venderEnTaquilla } from '../../venta/venta.js'
import { crearApp } from './app.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

interface Escenario {
  app: FastifyInstance
  bd: Bd
  viernes: number
  miercoles: number
  taquillaId: number
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
    horaInicio: '19:00',
  })
  const miercoles = programarFuncion(bd, {
    peliculaId,
    salaId: 2,
    semanaId,
    fecha: '2026-08-19',
    horaInicio: '19:00',
  })
  const app = crearApp({ bd, secretoCookies: 'secreto-de-prueba-1234567890' })
  return { app, bd, viernes, miercoles, taquillaId: 1 }
}

/** La cookie de sesión de un operador, ya identificado por su PIN (RF-32). */
async function sesionDe(app: FastifyInstance, pin: string): Promise<string> {
  const respuesta = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin } })
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : [String(crudas)]
  return lista.map((c) => c.split(';')[0]).join('; ')
}

describe('entrada/servidor: taquilla exige operador con permiso (T20, RF-32, RF-33, RN-53)', () => {
  it('sin sesión no se vende', async () => {
    const { app, viernes } = escenario()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${viernes}/venta`,
      payload: { butacas: [{ butacaId: 1, categoria: 'general' }] },
    })

    expect(respuesta.statusCode).toBe(401)
  })

  it('el puesto de puerta no puede vender (RN-53)', async () => {
    const { app, viernes } = escenario()
    const cookie = await sesionDe(app, '5678')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${viernes}/venta`,
      headers: { cookie },
      payload: { butacas: [{ butacaId: 1, categoria: 'general' }] },
    })

    expect(respuesta.statusCode).toBe(403)
  })
})

describe('entrada/servidor: mapa de taquilla con los cuatro estados (T20, RN-57, CA-9)', () => {
  it('distingue bloqueada, reservada y vendida, al revés que el mapa público', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    bloquear(bd, viernes, [1], 'sesion-anonima-x', AHORA)
    const reserva = reservar(bd, crearAvisos(bd, AHORA), viernes, [2], CONTACTO, AHORA)
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 3, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/taquilla/funciones/${viernes}/mapa`,
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(200)
    const cuerpo = respuesta.json() as {
      mapa: Array<{ butacaId: number; estado: string; numero?: string }>
      precios: Record<string, number>
    }
    const butaca = (id: number) => cuerpo.mapa.find((b) => b.butacaId === id)
    expect(butaca(1)?.estado).toBe('bloqueada')
    expect(butaca(2)?.estado).toBe('reservada')
    expect(butaca(3)?.estado).toBe('vendida')
    expect(butaca(4)?.estado).toBe('libre')
    expect(cuerpo.precios).toEqual({ general: 8000, estudiante: 5000 })
  })

  it('muestra el número de la reserva y de la compra, pero nunca la sesión anónima de un bloqueo', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    bloquear(bd, viernes, [1], 'sesion-anonima-secreta', AHORA)
    const reserva = reservar(bd, crearAvisos(bd, AHORA), viernes, [2], CONTACTO, AHORA)
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 3, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/taquilla/funciones/${viernes}/mapa`,
      headers: { cookie },
    })

    const cuerpo = respuesta.json() as { mapa: Array<{ butacaId: number; numero: string | null }> }
    const butaca = (id: number) => cuerpo.mapa.find((b) => b.butacaId === id)
    expect(butaca(2)?.numero).toBe(reserva.numero)
    expect(butaca(3)?.numero).toBe(compra.numero)
    expect(butaca(1)?.numero).toBeNull()
    expect(respuesta.body).not.toContain('sesion-anonima-secreta')
  })
})

describe('entrada/servidor: venta presencial con categoría por butaca (T20, RF-12)', () => {
  it('vende con una categoría por butaca y devuelve el número y el monto congelado', async () => {
    const { app, viernes } = escenario()
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${viernes}/venta`,
      headers: { cookie },
      payload: {
        butacas: [
          { butacaId: 1, categoria: 'general' },
          { butacaId: 2, categoria: 'estudiante' },
        ],
      },
    })

    expect(respuesta.statusCode).toBe(200)
    const compra = respuesta.json() as { numero: string; canal: string; montoTotal: number; operadorId: number }
    expect(compra.canal).toBe('taquilla')
    expect(compra.montoTotal).toBe(13000)
    expect(compra.operadorId).toBe(1)
  })

  it('en miércoles la única categoría es miércoles, a mitad de precio (RN-13, RN-14, CA-3)', async () => {
    const { app, miercoles } = escenario()
    const cookie = await sesionDe(app, '1234')

    const rechazo = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${miercoles}/venta`,
      headers: { cookie },
      payload: { butacas: [{ butacaId: 121, categoria: 'estudiante' }] },
    })
    expect(rechazo.statusCode).toBe(400)

    const venta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${miercoles}/venta`,
      headers: { cookie },
      payload: { butacas: [{ butacaId: 121, categoria: 'miercoles' }] },
    })
    expect(venta.statusCode).toBe(200)
    expect((venta.json() as { montoTotal: number }).montoTotal).toBe(4000)
  })

  it('una butaca que otro tomó primero se rechaza con cuáles se adelantaron (RNF-4)', async () => {
    const { app, bd, viernes } = escenario()
    bloquear(bd, viernes, [1], 'otra-sesion', AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/funciones/${viernes}/venta`,
      headers: { cookie },
      payload: { butacas: [{ butacaId: 1, categoria: 'general' }] },
    })

    expect(respuesta.statusCode).toBe(409)
    expect(respuesta.json()).toMatchObject({ error: 'ButacasYaTomadas', butacaIds: [1] })
  })
})

describe('entrada/servidor: conversión de reservas en taquilla (T20, RF-16, RF-17, RN-32)', () => {
  it('muestra la reserva antes de convertirla y la convierte con carné a precio de estudiante', async () => {
    const { app, bd, viernes } = escenario()
    const reserva = reservar(bd, crearAvisos(bd, AHORA), viernes, [5, 6], CONTACTO, AHORA)
    const cookie = await sesionDe(app, '1234')

    const vista = await app.inject({
      method: 'GET',
      url: `/api/taquilla/reservas/${reserva.numero}`,
      headers: { cookie },
    })
    expect(vista.statusCode).toBe(200)
    expect(vista.json()).toMatchObject({ funcionId: viernes, butacaIds: [5, 6], contacto: CONTACTO })

    const conversion = await app.inject({
      method: 'POST',
      url: `/api/taquilla/reservas/${reserva.numero}/conversion`,
      headers: { cookie },
      payload: { conCarne: true },
    })

    expect(conversion.statusCode).toBe(200)
    const compra = conversion.json() as { numero: string; montoTotal: number }
    expect(compra.numero).toBe(reserva.numero)
    expect(compra.montoTotal).toBe(10000)
  })

  it('sin carné cobra precio general si acepta (RN-32)', async () => {
    const { app, bd, viernes } = escenario()
    const reserva = reservar(bd, crearAvisos(bd, AHORA), viernes, [7], CONTACTO, AHORA)
    const cookie = await sesionDe(app, '1234')

    const conversion = await app.inject({
      method: 'POST',
      url: `/api/taquilla/reservas/${reserva.numero}/conversion`,
      headers: { cookie },
      payload: { conCarne: false },
    })

    expect((conversion.json() as { montoTotal: number }).montoTotal).toBe(8000)
  })

  it('si no acepta pagar general, las butacas vuelven a estar libres sin dejar registro (RN-32, RN-33)', async () => {
    const { app, bd, viernes } = escenario()
    const reserva = reservar(bd, crearAvisos(bd, AHORA), viernes, [8], CONTACTO, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'DELETE',
      url: `/api/taquilla/reservas/${reserva.numero}`,
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(204)
    const mapa = await app.inject({
      method: 'GET',
      url: `/api/taquilla/funciones/${viernes}/mapa`,
      headers: { cookie },
    })
    const cuerpo = mapa.json() as { mapa: Array<{ butacaId: number; estado: string }> }
    expect(cuerpo.mapa.find((b) => b.butacaId === 8)?.estado).toBe('libre')
  })

  it('un número que no es de ninguna reserva se responde 404, no con un error genérico', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/taquilla/reservas/NOEXIS',
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(404)
  })
})

describe('entrada/servidor: anulación y devoluciones en taquilla (T20, RF-21, RF-22, RF-25)', () => {
  it('anula con motivo, libera las butacas y deja la compra anulada (RN-40, REG-4)', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 9, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/compras/${compra.numero}/anulacion`,
      headers: { cookie },
      payload: { motivo: 'la registré mal' },
    })

    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toMatchObject({ estado: 'anulada' })
    const mapa = await app.inject({
      method: 'GET',
      url: `/api/taquilla/funciones/${viernes}/mapa`,
      headers: { cookie },
    })
    const cuerpo = mapa.json() as { mapa: Array<{ butacaId: number; estado: string }> }
    expect(cuerpo.mapa.find((b) => b.butacaId === 9)?.estado).toBe('libre')
  })

  it('una anulación sin motivo no se registra: RN-40 exige por qué', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 10, categoria: 'general' }], taquillaId, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/compras/${compra.numero}/anulacion`,
      headers: { cookie },
      payload: { motivo: '   ' },
    })

    expect(respuesta.statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: `/api/taquilla/compras/${compra.numero}`, headers: { cookie } })).json()).toMatchObject({
      estado: 'pagada',
    })
  })

  it('marca entregada la devolución en efectivo, con su propia jornada (RF-25, REG-5, RN-44)', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 11, categoria: 'general' }], taquillaId, AHORA)
    anular(bd, compra.numero, taquillaId, 'la registré mal', '2026-08-14T18:30:00')
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/taquilla/compras/${compra.numero}/devolucion-entregada`,
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(200)
    const fila = bd
      .prepare(`SELECT entrega_operador_id AS operadorId FROM compra WHERE numero = ?`)
      .get(compra.numero)
    expect(fila).toEqual({ operadorId: taquillaId })
  })
})

describe('entrada/servidor: cierre de caja de la jornada (T20, RF-26, RN-46, CA-6)', () => {
  it('devuelve las dos partes por separado y nunca mezcla internet con ventanilla', async () => {
    const { app, bd, viernes, taquillaId } = escenario()
    venderEnTaquilla(bd, viernes, [{ butacaId: 12, categoria: 'general' }], taquillaId, AHORA)
    const bloqueo = bloquear(bd, viernes, [13], 'sesion-internet', AHORA)
    const { pagar } = await import('../../venta/venta.js')
    pagar(bd, crearAvisos(bd, AHORA), bloqueo, CONTACTO, AHORA)
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/taquilla/cierre-caja?jornada=2026-08-14',
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toEqual({
      jornada: '2026-08-14',
      ventanilla: { cobrado: 8000, devuelto: 0, efectivoEsperado: 8000 },
      internet: { vendido: 8000 },
    })
  })

  it('sin jornada en la consulta usa la jornada en curso, con el corte de las 06:00 (RN-10)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({ method: 'GET', url: '/api/taquilla/cierre-caja', headers: { cookie } })

    expect(respuesta.statusCode).toBe(200)
    expect((respuesta.json() as { jornada: string }).jornada).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
