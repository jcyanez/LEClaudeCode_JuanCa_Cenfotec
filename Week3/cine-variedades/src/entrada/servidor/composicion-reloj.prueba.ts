import { describe, expect, it, vi } from 'vitest'
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
import { fijarCorreoDelDistribuidor } from '../../salidas/salidas.js'
import { venderEnTaquilla } from '../../venta/venta.js'
import { crearDependenciasReloj, crearEnviarDesdeEntorno } from './composicion-reloj.js'

const HOY = '2026-08-12'

function bdConUnaFuncion(): { bd: Bd; viernes: number } {
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
  return { bd, viernes }
}

const ENVIAR_QUE_SALE = vi.fn(async () => true)

describe('entrada/servidor: el Reloj atado a sus dependencias reales (deuda de T17)', () => {
  it('barre los vencidos de verdad: un bloqueo vencido deja de ocupar la butaca', () => {
    const { bd, viernes } = bdConUnaFuncion()
    bd.prepare(
      `INSERT INTO ocupacion (funcion_id, butaca_id, motivo, referencia, vence)
       VALUES (?, 1, 'bloqueo', 'sesion-vieja', '2026-08-14T18:00:00')`,
    ).run(viernes)
    const dependencias = crearDependenciasReloj(bd, ENVIAR_QUE_SALE, () => {})

    const barrido = dependencias.barrerVencidos('2026-08-14T18:30:00')

    expect(barrido.ocupaciones).toBe(1)
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM ocupacion`).get()).toEqual({ n: 0 })
  })

  it('procesa la cola de avisos con el envío real: sin esto ningún correo saldría nunca', async () => {
    const { bd } = bdConUnaFuncion()
    crearAvisos(bd, '2026-08-14T18:00:00').encolar('ana@correo.com', 'Tu compra', 'ABC123')
    const enviar = vi.fn(async () => true)
    const dependencias = crearDependenciasReloj(bd, enviar, () => {})

    const resultado = await dependencias.procesarAvisos('2026-08-14T18:10:00')

    expect(resultado.enviados).toBe(1)
    expect(enviar).toHaveBeenCalledWith('ana@correo.com', 'Tu compra', 'ABC123', null)
  })

  it('el reporte del mes se envía al correo del distribuidor y queda registrado (REG-7)', async () => {
    const { bd, viernes } = bdConUnaFuncion()
    venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], 1, '2026-08-14T18:00:00')
    fijarCorreoDelDistribuidor(bd, 'distribuidor@correo.com')
    const dependencias = crearDependenciasReloj(bd, ENVIAR_QUE_SALE, () => {})

    const registro = await dependencias.reporteDelMes('2026-08', '2026-09-01T06:00:00')

    expect(registro).toMatchObject({ destinatario: 'distribuidor@correo.com', resultado: 'enviado' })
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM envio_reporte`).get()).toEqual({ n: 1 })
  })

  it('sin correo del distribuidor configurado avisa y no tumba el proceso ni registra un envío', async () => {
    const { bd } = bdConUnaFuncion()
    const avisos: string[] = []
    const dependencias = crearDependenciasReloj(bd, ENVIAR_QUE_SALE, (mensaje) => avisos.push(mensaje))

    const registro = await dependencias.reporteDelMes('2026-08', '2026-09-01T06:00:00')

    expect(registro.resultado).toBe('fallido')
    expect(avisos.join(' ')).toContain('distribuidor')
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM envio_reporte`).get()).toEqual({ n: 0 })
  })

  it('un fallo al procesar la cola no tumba el proceso: se avisa y el tick sigue', async () => {
    const { bd } = bdConUnaFuncion()
    crearAvisos(bd, '2026-08-14T18:00:00').encolar('ana@correo.com', 'Tu compra', 'ABC123')
    const avisos: string[] = []
    const enviar = vi.fn(async () => {
      throw new Error('el proveedor explotó')
    })
    const dependencias = crearDependenciasReloj(bd, enviar, (mensaje) => avisos.push(mensaje))

    const resultado = await dependencias.procesarAvisos('2026-08-14T18:10:00')

    expect(resultado).toEqual({ enviados: 0, reintentados: 0, fallidos: 0 })
    expect(avisos.join(' ')).toContain('explotó')
  })
})

describe('entrada/servidor: el envío de correo según el entorno (T14, CLAUDE.md §6)', () => {
  it('sin SMTP configurado no inventa un envío: responde que no salió y el aviso espera en la cola (RN-48)', async () => {
    const avisos: string[] = []
    const enviar = crearEnviarDesdeEntorno({}, (mensaje) => avisos.push(mensaje))

    await expect(enviar('ana@correo.com', 'Asunto', 'Cuerpo', null)).resolves.toBe(false)
    expect(avisos.join(' ')).toContain('SMTP')
  })

  it('con SMTP configurado arma el envío real sin credenciales en el repositorio', () => {
    const enviar = crearEnviarDesdeEntorno(
      {
        SMTP_HOST: 'smtp.correo.com',
        SMTP_PUERTO: '587',
        SMTP_USUARIO: 'cine',
        SMTP_CLAVE: 'secreta',
        SMTP_REMITENTE: 'cine@correo.com',
      },
      () => {},
    )

    expect(typeof enviar).toBe('function')
  })
})
