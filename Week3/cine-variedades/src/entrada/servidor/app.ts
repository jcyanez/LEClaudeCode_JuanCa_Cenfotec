import cookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'
import type { EnviarCorreo } from '../../avisos/avisos.js'
import type { Bd } from '../../base/bd.js'
import { crearEnviarDesdeEntorno } from './composicion-reloj.js'
import { manejarErrorDeDominio } from './errores.js'
import { registrarSesionOperador } from './operadores-sesion.js'
import { registrarRutasAdministracion } from './rutas-administracion.js'
import { registrarRutasPublicas } from './rutas-publicas.js'
import { registrarRutasPuerta } from './rutas-puerta.js'
import { registrarRutasTaquilla } from './rutas-taquilla.js'

export interface OpcionesApp {
  bd: Bd
  secretoCookies: string
  logger?: boolean
  /**
   * El envío real de correo, para el reenvío a mano del reporte (RF-28). Se
   * inyecta para poder probarlo sin tocar la red; si no viene, se arma desde
   * las variables de entorno igual que el del Reloj (`CLAUDE.md` §6).
   */
  enviarCorreo?: EnviarCorreo
}

/**
 * La capa de Entrada completa: sesión de operador, sesión anónima del
 * comprador y la traducción de rechazos de dominio a la tabla de errores
 * (RF-32, RN-55), más las rutas de los tres públicos —web pública (T19),
 * taquilla (T20), puerta y administración (T21)—. Ninguna regla de negocio
 * vive acá (DISENO.md).
 */
export function crearApp(opciones: OpcionesApp): FastifyInstance {
  const app = Fastify({ logger: opciones.logger ?? false })

  app.register(cookie, { secret: opciones.secretoCookies })
  app.setErrorHandler(manejarErrorDeDominio)

  const enviarCorreo =
    opciones.enviarCorreo ?? crearEnviarDesdeEntorno(process.env, (mensaje) => app.log.warn(mensaje))

  registrarSesionOperador(app, opciones.bd)
  registrarRutasPublicas(app, opciones.bd)
  registrarRutasTaquilla(app, opciones.bd)
  registrarRutasPuerta(app, opciones.bd)
  registrarRutasAdministracion(app, opciones.bd, enviarCorreo)

  app.get('/api/salud', async () => ({ estado: 'ok' }))

  return app
}
