import { describe, expect, it, vi } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { crearAvisos, procesarPendientes } from './avisos.js'

function bdConMigraciones(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  return bd
}

function filaAviso(bd: Bd) {
  return bd
    .prepare(
      `SELECT destinatario, asunto, cuerpo, adjunto, creado_instante AS creadoInstante,
              intentos, proximo_intento AS proximoIntento, estado
       FROM aviso`,
    )
    .get() as Record<string, unknown>
}

const AHORA = '2026-08-14T18:00:00'

describe('avisos: cola (T14)', () => {
  it('encolar nunca falla ni bloquea: solo escribe un pendiente con el instante de creación (RNF-5)', () => {
    const bd = bdConMigraciones()
    const avisos = crearAvisos(bd, AHORA)

    expect(() => avisos.encolar('ana@correo.com', 'Asunto', 'Cuerpo')).not.toThrow()

    expect(filaAviso(bd)).toEqual({
      destinatario: 'ana@correo.com',
      asunto: 'Asunto',
      cuerpo: 'Cuerpo',
      adjunto: null,
      creadoInstante: AHORA,
      intentos: 0,
      proximoIntento: AHORA,
      estado: 'pendiente',
    })
  })

  it('un adjunto de texto se guarda tal cual, y uno estructurado se serializa', () => {
    const bd = bdConMigraciones()
    const avisos = crearAvisos(bd, AHORA)

    avisos.encolar('a@x.com', 'A', 'B', 'ya es texto')
    expect((filaAviso(bd) as { adjunto: string }).adjunto).toBe('ya es texto')

    bd.prepare(`DELETE FROM aviso`).run()
    avisos.encolar('a@x.com', 'A', 'B', { filas: [1, 2, 3] })
    expect(JSON.parse((filaAviso(bd) as { adjunto: string }).adjunto)).toEqual({ filas: [1, 2, 3] })
  })
})

describe('avisos: procesamiento y reintentos (RN-48)', () => {
  it('un envío exitoso queda marcado enviado y no se vuelve a tocar', async () => {
    const bd = bdConMigraciones()
    crearAvisos(bd, AHORA).encolar('ana@correo.com', 'Asunto', 'Cuerpo')
    const enviar = vi.fn().mockResolvedValue(true)

    const resultado = await procesarPendientes(bd, AHORA, enviar)

    expect(resultado).toEqual({ enviados: 1, reintentados: 0, fallidos: 0 })
    expect(enviar).toHaveBeenCalledWith('ana@correo.com', 'Asunto', 'Cuerpo', null)
    expect((filaAviso(bd) as { estado: string }).estado).toBe('enviado')

    // Una segunda pasada no vuelve a intentar un aviso ya enviado.
    const otraVez = await procesarPendientes(bd, AHORA, enviar)
    expect(otraVez).toEqual({ enviados: 0, reintentados: 0, fallidos: 0 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('un envío fallido reintenta con espaciado creciente, duplicando la espera (RN-48)', async () => {
    const bd = bdConMigraciones()
    crearAvisos(bd, AHORA).encolar('ana@correo.com', 'Asunto', 'Cuerpo')
    const enviar = vi.fn().mockResolvedValue(false)

    const primera = await procesarPendientes(bd, AHORA, enviar)
    expect(primera).toEqual({ enviados: 0, reintentados: 1, fallidos: 0 })
    let fila = filaAviso(bd) as { estado: string; intentos: number; proximoIntento: string }
    expect(fila.estado).toBe('pendiente')
    expect(fila.intentos).toBe(1)
    expect(fila.proximoIntento).toBe('2026-08-14T18:02:00') // +2^1 = 2 minutos

    // Todavía no llegó a su próximo intento: no se vuelve a llamar.
    const antesDeHora = await procesarPendientes(bd, '2026-08-14T18:01:00', enviar)
    expect(antesDeHora).toEqual({ enviados: 0, reintentados: 0, fallidos: 0 })
    expect(enviar).toHaveBeenCalledTimes(1)

    const segunda = await procesarPendientes(bd, '2026-08-14T18:02:00', enviar)
    expect(segunda).toEqual({ enviados: 0, reintentados: 1, fallidos: 0 })
    fila = filaAviso(bd) as { estado: string; intentos: number; proximoIntento: string }
    expect(fila.intentos).toBe(2)
    expect(fila.proximoIntento).toBe('2026-08-14T18:06:00') // +2^2 = 4 minutos
  })

  it('pasadas las 24 horas desde que se encoló, queda fallido y visible, y no se reintenta más (RN-48)', async () => {
    const bd = bdConMigraciones()
    crearAvisos(bd, AHORA).encolar('ana@correo.com', 'Asunto', 'Cuerpo')
    // Simula que ya van 10 reintentos, debido justo ahora.
    bd.prepare(`UPDATE aviso SET intentos = 10, proximo_intento = ?`).run(AHORA)
    const enviar = vi.fn().mockResolvedValue(false)

    const resultado = await procesarPendientes(bd, AHORA, enviar)

    expect(resultado).toEqual({ enviados: 0, reintentados: 0, fallidos: 1 })
    const fila = filaAviso(bd) as { estado: string; intentos: number }
    expect(fila.estado).toBe('fallido')
    expect(fila.intentos).toBe(11)

    // Fallido es definitivo: no se vuelve a intentar aunque se procese de nuevo.
    const otraVez = await procesarPendientes(bd, '2026-08-20T00:00:00', enviar)
    expect(otraVez).toEqual({ enviados: 0, reintentados: 0, fallidos: 0 })
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('si el Reloj no corre, los avisos esperan en la cola sin romper nada (decisión 4 de DISENO.md)', async () => {
    const bd = bdConMigraciones()
    crearAvisos(bd, AHORA).encolar('ana@correo.com', 'Asunto', 'Cuerpo')

    expect((filaAviso(bd) as { estado: string }).estado).toBe('pendiente')
    // Nada se rompe con solo encolar: procesarPendientes nunca se llamó.
  })
})
