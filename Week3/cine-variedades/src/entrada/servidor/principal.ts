import { abrirBd } from '../../base/bd.js'
import { listaMigraciones } from '../../base/lista-migraciones.js'
import { aplicarMigraciones } from '../../base/migraciones.js'
import { sembrarSalas } from '../../cartelera/cartelera.js'
import { crearApp } from './app.js'

/**
 * El punto de entrada real del servidor (composición pendiente desde T18):
 * abre la base de datos de archivo, aplica las migraciones y siembra las
 * dos salas fijas (RN-1, idempotente) — nunca datos de negocio de mentira:
 * la cartelera la carga la dueña (T21). El secreto de cookies y el puerto
 * vienen de variables de entorno; nunca hardcodeados (`CLAUDE.md` §6).
 */
const bd = abrirBd(process.env.RUTA_BD ?? 'cine-variedades.db')
aplicarMigraciones(bd, listaMigraciones)
sembrarSalas(bd)

const app = crearApp({
  bd,
  secretoCookies: process.env.SECRETO_COOKIES ?? 'secreto-de-desarrollo-cambiar-en-produccion',
  logger: true,
})

const puerto = Number(process.env.PUERTO ?? 3001)
app.listen({ port: puerto, host: '0.0.0.0' }, (error, direccion) => {
  if (error) {
    app.log.error(error)
    process.exit(1)
  }
  app.log.info(`Cine Variedades escuchando en ${direccion}`)
})
