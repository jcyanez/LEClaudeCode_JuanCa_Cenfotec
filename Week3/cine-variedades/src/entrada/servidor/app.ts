import cookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Bd } from '../../base/bd.js'
import { manejarErrorDeDominio } from './errores.js'
import { registrarSesionOperador } from './operadores-sesion.js'

export interface OpcionesApp {
  bd: Bd
  secretoCookies: string
  logger?: boolean
}

/**
 * La base de la capa de Entrada (T18): sesión de operador, sesión anónima
 * del comprador y la traducción de rechazos de dominio a la tabla de
 * errores (RF-32, RN-55). Ninguna regla de negocio vive acá (DISENO.md):
 * las rutas de la web pública, taquilla y puerta se agregan en T19–T21
 * sobre esta misma app.
 */
export function crearApp(opciones: OpcionesApp): FastifyInstance {
  const app = Fastify({ logger: opciones.logger ?? false })

  app.register(cookie, { secret: opciones.secretoCookies })
  app.setErrorHandler(manejarErrorDeDominio)

  registrarSesionOperador(app, opciones.bd)

  app.get('/api/salud', async () => ({ estado: 'ok' }))

  return app
}
