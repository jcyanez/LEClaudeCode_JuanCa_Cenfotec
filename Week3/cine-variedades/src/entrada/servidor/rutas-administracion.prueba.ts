import type { FastifyInstance } from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { abrirBd, type Bd } from '../../base/bd.js'
import { listaMigraciones } from '../../base/lista-migraciones.js'
import { aplicarMigraciones } from '../../base/migraciones.js'
import { sembrarSalas } from '../../cartelera/cartelera.js'
import { crearApp } from './app.js'

/** El jueves de la semana en curso, calculado como lo pide RN-3, para no atar la prueba a una fecha fija. */
function juevesDeEstaSemana(): string {
  const hoy = new Date()
  const corrimiento = (hoy.getUTCDay() - 4 + 7) % 7
  const jueves = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - corrimiento))
  return jueves.toISOString().slice(0, 10)
}

function sumarDias(fecha: string, dias: number): string {
  const fechaMs = new Date(`${fecha}T00:00:00Z`)
  fechaMs.setUTCDate(fechaMs.getUTCDate() + dias)
  return fechaMs.toISOString().slice(0, 10)
}

const enviarCorreo = vi.fn(async () => true)

function escenario(): { app: FastifyInstance; bd: Bd } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Rosa', 'dueña', '9999')`).run()
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  const app = crearApp({ bd, secretoCookies: 'secreto-de-prueba-1234567890', enviarCorreo })
  return { app, bd }
}

async function sesionDe(app: FastifyInstance, pin: string): Promise<string> {
  const respuesta = await app.inject({ method: 'POST', url: '/api/operadores/sesion', payload: { pin } })
  const crudas = respuesta.headers['set-cookie']
  const lista = Array.isArray(crudas) ? crudas : [String(crudas)]
  return lista.map((c) => c.split(';')[0]).join('; ')
}

/** Una semana cargada con una película y una función, tal como la carga la dueña. */
async function carteleraCargada(app: FastifyInstance, cookie: string) {
  const jueves = juevesDeEstaSemana()
  const pelicula = await app.inject({
    method: 'POST',
    url: '/api/administracion/peliculas',
    headers: { cookie },
    payload: { titulo: 'La ventana indiscreta', duracionMinutos: 120 },
  })
  const semana = await app.inject({
    method: 'POST',
    url: '/api/administracion/semanas',
    headers: { cookie },
    payload: { juevesInicio: jueves },
  })
  const peliculaId = (pelicula.json() as { id: number }).id
  const semanaId = (semana.json() as { semanaId: number }).semanaId
  const funcion = await app.inject({
    method: 'POST',
    url: '/api/administracion/funciones',
    headers: { cookie },
    payload: { peliculaId, salaId: 1, semanaId, fecha: sumarDias(jueves, 1), horaInicio: '19:00' },
  })
  return { jueves, peliculaId, semanaId, funcion }
}

describe('entrada/servidor: la dueña carga la cartelera (T21, RF-1, RF-2, RF-3, RF-5)', () => {
  it('registra películas con su duración y las lista', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    const alta = await app.inject({
      method: 'POST',
      url: '/api/administracion/peliculas',
      headers: { cookie },
      payload: { titulo: 'La ventana indiscreta', duracionMinutos: 112 },
    })
    const lista = await app.inject({ method: 'GET', url: '/api/administracion/peliculas', headers: { cookie } })

    expect(alta.statusCode).toBe(200)
    expect(lista.json()).toEqual([{ id: 1, titulo: 'La ventana indiscreta', duracionMinutos: 112 }])
  })

  it('una película sin duración no se registra (RN-4)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/administracion/peliculas',
      headers: { cookie },
      payload: { titulo: 'Sin duración' },
    })

    expect(respuesta.statusCode).toBe(400)
  })

  it('CA-7: una función que deja menos de 20 minutos dice con cuál choca y la primera hora posible (RF-3)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { jueves, peliculaId, semanaId } = await carteleraCargada(app, cookie)

    const choque = await app.inject({
      method: 'POST',
      url: '/api/administracion/funciones',
      headers: { cookie },
      payload: { peliculaId, salaId: 1, semanaId, fecha: sumarDias(jueves, 1), horaInicio: '20:30' },
    })

    expect(choque.statusCode).toBe(400)
    expect((choque.json() as { mensaje: string }).mensaje).toContain('La primera hora posible es 21:20')
  })

  it('la venta de una semana se abre cuando la dueña la da por cargada (RN-9, RF-5)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { semanaId } = await carteleraCargada(app, cookie)

    const antes = await app.inject({ method: 'GET', url: '/api/administracion/semanas', headers: { cookie } })
    expect((antes.json() as Array<{ abiertaAVenta: boolean }>)[0]?.abiertaAVenta).toBe(false)

    await app.inject({ method: 'POST', url: `/api/administracion/semanas/${semanaId}/apertura`, headers: { cookie } })

    const despues = await app.inject({ method: 'GET', url: '/api/administracion/semanas', headers: { cookie } })
    expect((despues.json() as Array<{ abiertaAVenta: boolean; funciones: number }>)[0]).toMatchObject({
      abiertaAVenta: true,
      funciones: 1,
    })
  })

  it('taquilla no puede cargar la cartelera (RN-51, RN-52, RF-33)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/administracion/peliculas',
      headers: { cookie },
      payload: { titulo: 'X', duracionMinutos: 100 },
    })

    expect(respuesta.statusCode).toBe(403)
  })
})

describe('entrada/servidor: modificar, eliminar y cancelar funciones (T21, RF-4, RF-23, RF-24)', () => {
  it('modifica y elimina una función mientras no tenga butacas tomadas (RF-4)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { jueves, semanaId, funcion } = await carteleraCargada(app, cookie)
    const funcionId = (funcion.json() as { funcionId: number }).funcionId

    const cambio = await app.inject({
      method: 'PATCH',
      url: `/api/administracion/funciones/${funcionId}`,
      headers: { cookie },
      payload: { horaInicio: '21:00' },
    })
    expect(cambio.statusCode).toBe(200)

    const lista = await app.inject({
      method: 'GET',
      url: `/api/administracion/semanas/${semanaId}/funciones`,
      headers: { cookie },
    })
    expect((lista.json() as Array<{ horaInicio: string }>)[0]?.horaInicio).toBe('21:00')
    expect(jueves).toBeDefined()

    const borrado = await app.inject({
      method: 'DELETE',
      url: `/api/administracion/funciones/${funcionId}`,
      headers: { cookie },
    })
    expect(borrado.statusCode).toBe(204)
  })

  it('cancela una función con motivo y devuelve todas sus compras de una vez (RN-41, RF-23)', async () => {
    const { app, bd } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { semanaId, funcion } = await carteleraCargada(app, cookie)
    const funcionId = (funcion.json() as { funcionId: number }).funcionId
    await app.inject({ method: 'POST', url: `/api/administracion/semanas/${semanaId}/apertura`, headers: { cookie } })
    await app.inject({
      method: 'POST',
      url: '/api/administracion/precios',
      headers: { cookie },
      payload: { general: 8000, estudiante: 5000, desde: '2026-01-01' },
    })
    // Una compra por internet, para comprobar que se le encola el aviso (RF-24).
    const bloqueo = await app.inject({
      method: 'POST',
      url: `/api/funciones/${funcionId}/bloqueo`,
      payload: { butacaIds: [1] },
    })
    const crudas = bloqueo.headers['set-cookie']
    const sesionAnonima = (Array.isArray(crudas) ? crudas : [String(crudas)])[0]?.split(';')[0] as string
    await app.inject({
      method: 'POST',
      url: `/api/funciones/${funcionId}/pago`,
      headers: { cookie: sesionAnonima },
      payload: { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' },
    })

    const cancelacion = await app.inject({
      method: 'POST',
      url: `/api/administracion/funciones/${funcionId}/cancelacion`,
      headers: { cookie },
      payload: { motivo: 'falló el proyector' },
    })

    expect(cancelacion.statusCode).toBe(200)
    expect((cancelacion.json() as Array<{ estado: string }>).map((c) => c.estado)).toEqual(['devuelta'])
    const avisos = bd.prepare(`SELECT destinatario FROM aviso WHERE asunto LIKE '%canceló%'`).all()
    expect(avisos).toEqual([{ destinatario: 'ana@correo.com' }])
  })

  it('una cancelación sin motivo no se registra (RN-41, REG-4)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { funcion } = await carteleraCargada(app, cookie)
    const funcionId = (funcion.json() as { funcionId: number }).funcionId

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/administracion/funciones/${funcionId}/cancelacion`,
      headers: { cookie },
      payload: { motivo: '' },
    })

    expect(respuesta.statusCode).toBe(400)
  })

  it('taquilla sí puede cancelar una función, aunque no cargue cartelera (RN-52)', async () => {
    const { app } = escenario()
    const deLaDueña = await sesionDe(app, '9999')
    const { funcion } = await carteleraCargada(app, deLaDueña)
    const funcionId = (funcion.json() as { funcionId: number }).funcionId
    const deTaquilla = await sesionDe(app, '1234')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/administracion/funciones/${funcionId}/cancelacion`,
      headers: { cookie: deTaquilla },
      payload: { motivo: 'falló el proyector' },
    })

    expect(respuesta.statusCode).toBe(200)
  })
})

describe('entrada/servidor: precios y correo del distribuidor (T21, RF-6, RF-29)', () => {
  it('fija los precios y los devuelve como vigentes', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    await app.inject({
      method: 'POST',
      url: '/api/administracion/precios',
      headers: { cookie },
      payload: { general: 8000, estudiante: 5000, desde: '2026-08-01' },
    })

    const vigentes = await app.inject({
      method: 'GET',
      url: '/api/administracion/precios?fecha=2026-08-14',
      headers: { cookie },
    })
    expect(vigentes.json()).toEqual({ general: 8000, estudiante: 5000, desde: '2026-08-01' })
  })

  it('guarda y devuelve el correo del distribuidor, y no lo deja vacío (RN-49)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    await app.inject({
      method: 'PUT',
      url: '/api/administracion/distribuidor',
      headers: { cookie },
      payload: { correo: 'distribuidor@correo.com' },
    })
    const leido = await app.inject({ method: 'GET', url: '/api/administracion/distribuidor', headers: { cookie } })
    const vacio = await app.inject({
      method: 'PUT',
      url: '/api/administracion/distribuidor',
      headers: { cookie },
      payload: { correo: '   ' },
    })

    expect(leido.json()).toEqual({ correo: 'distribuidor@correo.com' })
    expect(vacio.statusCode).toBe(400)
  })
})

describe('entrada/servidor: reporte y consultas de la dueña (T21, RF-27 a RF-31)', () => {
  it('arma el reporte del mes y deja reenviarlo a mano, registrando cada intento (RF-28, REG-7)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    await app.inject({
      method: 'PUT',
      url: '/api/administracion/distribuidor',
      headers: { cookie },
      payload: { correo: 'distribuidor@correo.com' },
    })

    const reporte = await app.inject({ method: 'GET', url: '/api/administracion/reporte/2026-08', headers: { cookie } })
    expect(reporte.statusCode).toBe(200)
    expect(reporte.json()).toMatchObject({ mes: '2026-08', detalle: [], envios: [] })

    const envio = await app.inject({
      method: 'POST',
      url: '/api/administracion/reporte/2026-08/envio',
      headers: { cookie },
    })

    expect(envio.statusCode).toBe(200)
    expect(envio.json()).toMatchObject({ destinatario: 'distribuidor@correo.com', resultado: 'enviado' })
    const despues = await app.inject({ method: 'GET', url: '/api/administracion/reporte/2026-08', headers: { cookie } })
    expect((despues.json() as { envios: unknown[] }).envios).toHaveLength(1)
  })

  it('sin correo del distribuidor no se puede enviar el reporte, y se dice por qué (RF-29)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/administracion/reporte/2026-08/envio',
      headers: { cookie },
    })

    expect(respuesta.statusCode).toBe(400)
    expect((respuesta.json() as { mensaje: string }).mensaje).toContain('distribuidor')
  })

  it('responde las consultas de ocupación y de categoría por canal en un período (RF-30, RF-31)', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')
    const { jueves } = await carteleraCargada(app, cookie)

    const ocupacion = await app.inject({
      method: 'GET',
      url: `/api/administracion/ocupacion?desde=${jueves}&hasta=${sumarDias(jueves, 6)}`,
      headers: { cookie },
    })
    const categorias = await app.inject({
      method: 'GET',
      url: `/api/administracion/categorias?desde=${jueves}&hasta=${sumarDias(jueves, 6)}`,
      headers: { cookie },
    })

    expect(ocupacion.statusCode).toBe(200)
    expect((ocupacion.json() as Array<{ butacas: number; ocupacion: number }>)[0]).toMatchObject({
      butacas: 120,
      ocupacion: 0,
    })
    expect(categorias.json()).toEqual([])
  })

  it('exige un período en las consultas, en vez de devolver todo el histórico por accidente', async () => {
    const { app } = escenario()
    const cookie = await sesionDe(app, '9999')

    const respuesta = await app.inject({ method: 'GET', url: '/api/administracion/ocupacion', headers: { cookie } })

    expect(respuesta.statusCode).toBe(400)
  })
})
