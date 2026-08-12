import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import {
  abrirVenta,
  cancelarFuncion,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { tomadas, tomar } from '../ocupacion/ocupacion.js'
import {
  bloquear,
  ButacasYaTomadas,
  buscarCompra,
  jornadaDe,
  pagar,
  venderEnTaquilla,
  type Avisos,
} from './venta.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const NUMERO_LEGIBLE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

/** Cartelera lista para vender: semana abierta, precios fijados, un operador de taquilla. */
function bdListaParaVender(): { bd: Bd; viernes: number; semanaId: number; operadorId: number } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(
    `INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`,
  ).run()
  const viernes = programarFuncion(bd, {
    peliculaId,
    salaId: 1,
    semanaId,
    fecha: '2026-08-14',
    horaInicio: '19:00',
  })
  return { bd, viernes, semanaId, operadorId: 1 }
}

function contar(bd: Bd, tabla: 'compra' | 'entrada'): number {
  return (bd.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get() as { n: number }).n
}

describe('venta: compra en taquilla (T8)', () => {
  it('vende butacas libres directo a vendidas y devuelve la compra con sus entradas (RN-20, RF-12, REG-1)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()

    const compra = venderEnTaquilla(
      bd,
      viernes,
      [
        { butacaId: 1, categoria: 'general' },
        { butacaId: 2, categoria: 'estudiante' },
      ],
      operadorId,
      AHORA,
    )

    expect(compra.numero).toMatch(NUMERO_LEGIBLE)
    expect(compra).toMatchObject({
      canal: 'taquilla',
      instante: AHORA,
      jornada: '2026-08-14',
      funcionId: viernes,
      estado: 'pagada',
      montoTotal: 13000,
      operadorId,
    })
    expect(compra.entradas).toEqual([
      { butacaId: 1, categoria: 'general', monto: 8000, usadaInstante: null, usadaOperadorId: null },
      { butacaId: 2, categoria: 'estudiante', monto: 5000, usadaInstante: null, usadaOperadorId: null },
    ])
    // Sin paso intermedio: las butacas quedan tomadas como venta, a nombre del número.
    expect(tomadas(bd, viernes, AHORA)).toEqual([
      { butacaId: 1, motivo: 'venta', referencia: compra.numero },
      { butacaId: 2, motivo: 'venta', referencia: compra.numero },
    ])
  })

  it('cada número de compra: 6 caracteres legibles en voz alta, sin repetirse (RN-25)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()

    const numeros = new Set<string>()
    for (let butacaId = 1; butacaId <= 30; butacaId++) {
      const compra = venderEnTaquilla(bd, viernes, [{ butacaId, categoria: 'general' }], operadorId, AHORA)
      expect(compra.numero).toMatch(NUMERO_LEGIBLE)
      numeros.add(compra.numero)
    }
    expect(numeros.size).toBe(30)
  })

  it('CA-4: un cambio de precio no altera el monto de una compra ya registrada (RN-16)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const vieja = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)

    fijarPrecios(bd, 9000, 6000, '2026-08-14')

    const conservada = buscarCompra(bd, vieja.numero)
    expect(conservada?.montoTotal).toBe(8000)
    expect(conservada?.entradas[0]?.monto).toBe(8000)
    // La venta nueva sí sale al precio nuevo, porque la fecha de la función lo alcanza (RN-15).
    const nueva = venderEnTaquilla(bd, viernes, [{ butacaId: 2, categoria: 'general' }], operadorId, AHORA)
    expect(nueva.montoTotal).toBe(9000)
  })

  it('CA-8: la jornada corta a las 06:00 y queda congelada al escribir (RN-10, RN-11)', () => {
    expect(jornadaDe('2026-08-15T00:15:00')).toBe('2026-08-14')
    expect(jornadaDe('2026-08-15T05:59:59')).toBe('2026-08-14')
    expect(jornadaDe('2026-08-15T06:00:00')).toBe('2026-08-15')

    const { bd, semanaId, operadorId } = bdListaParaVender()
    const madrugada = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-15',
      horaInicio: '01:00',
    })
    const compra = venderEnTaquilla(
      bd,
      madrugada,
      [{ butacaId: 121, categoria: 'general' }],
      operadorId,
      '2026-08-15T00:15:00',
    )
    expect(compra.jornada).toBe('2026-08-14')
  })

  it('todo o nada: si alguna butaca se adelantó, no queda rastro de la compra (RNF-4, RN-22, REG-1)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    tomar(bd, viernes, [3], 'bloqueo', 'sesion-a', AHORA, '2026-08-14T18:05:00')

    let rechazo: unknown
    try {
      venderEnTaquilla(
        bd,
        viernes,
        [
          { butacaId: 2, categoria: 'general' },
          { butacaId: 3, categoria: 'general' },
        ],
        operadorId,
        AHORA,
      )
    } catch (error) {
      rechazo = error
    }

    expect(rechazo).toBeInstanceOf(ButacasYaTomadas)
    expect((rechazo as ButacasYaTomadas).butacaIds).toEqual([3])
    expect(contar(bd, 'compra')).toBe(0)
    expect(contar(bd, 'entrada')).toBe(0)
    // La butaca libre del grupo no quedó tomada: solo sigue el bloqueo ajeno.
    expect(tomadas(bd, viernes, AHORA)).toEqual([
      { butacaId: 3, motivo: 'bloqueo', referencia: 'sesion-a' },
    ])
  })

  it('rechaza una función que no está en venta, sin dejar rastro (RF-13, RN-21, RN-43)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const butacas = [{ butacaId: 1, categoria: 'general' as const }]

    // A la hora exacta de inicio la venta ya cerró (CA-2).
    expect(() => venderEnTaquilla(bd, viernes, butacas, operadorId, '2026-08-14T19:00:00')).toThrow(
      'La función no está en venta',
    )

    cancelarFuncion(bd, viernes, {
      operadorId,
      instante: AHORA,
      jornada: '2026-08-14',
      motivo: 'Falló el proyector',
    })
    expect(() => venderEnTaquilla(bd, viernes, butacas, operadorId, AHORA)).toThrow(
      'La función no está en venta',
    )
    expect(contar(bd, 'compra')).toBe(0)
  })

  it('CA-3: en una función de miércoles vende con la categoría miércoles a mitad del general (RN-13, RN-14)', () => {
    const { bd, semanaId, operadorId } = bdListaParaVender()
    const miercoles = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-19',
      horaInicio: '19:00',
    })

    const compra = venderEnTaquilla(
      bd,
      miercoles,
      [{ butacaId: 121, categoria: 'miercoles' }],
      operadorId,
      '2026-08-19T18:00:00',
    )
    expect(compra.montoTotal).toBe(4000)
    expect(compra.entradas[0]).toMatchObject({ categoria: 'miercoles', monto: 4000 })

    // La categoría estudiante no existe en miércoles, y el rechazo no deja rastro (RN-14).
    expect(() =>
      venderEnTaquilla(bd, miercoles, [{ butacaId: 122, categoria: 'estudiante' }], operadorId, '2026-08-19T18:00:00'),
    ).toThrow('En las funciones de miércoles no existe el precio de estudiante')
    expect(contar(bd, 'compra')).toBe(1)
  })

  it('buscarCompra encuentra por número, y con un número inexistente no devuelve nada', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)

    expect(buscarCompra(bd, compra.numero)).toEqual(compra)
    expect(buscarCompra(bd, 'XXXXXX')).toBeUndefined()
  })

  it('una compra sin butacas no existe: se rechaza antes de tocar nada', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    expect(() => venderEnTaquilla(bd, viernes, [], operadorId, AHORA)).toThrow(
      'Una compra necesita al menos una butaca',
    )
  })
})

/** Cola de avisos simulada: T14 trae la real; el contrato ya está fijo (PLAN, Fase 3). */
function avisosSimulados(): Avisos & { encolados: { destinatario: string; asunto: string; cuerpo: string }[] } {
  const encolados: { destinatario: string; asunto: string; cuerpo: string }[] = []
  return {
    encolados,
    encolar(destinatario, asunto, cuerpo) {
      encolados.push({ destinatario, asunto, cuerpo })
    },
  }
}

const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

describe('venta: compra por internet (T9)', () => {
  it('bloquear toma las butacas por 5 minutos a favor de la sesión (RN-19, RF-10)', () => {
    const { bd, viernes } = bdListaParaVender()

    const bloqueo = bloquear(bd, viernes, [1, 2], 'sesion-a', AHORA)

    expect(bloqueo).toMatchObject({
      sesion: 'sesion-a',
      funcionId: viernes,
      butacaIds: [1, 2],
      categoria: 'general',
      vence: '2026-08-14T18:05:00',
    })
    expect(tomadas(bd, viernes, AHORA)).toEqual([
      { butacaId: 1, motivo: 'bloqueo', referencia: 'sesion-a' },
      { butacaId: 2, motivo: 'bloqueo', referencia: 'sesion-a' },
    ])
    // Al vencer, las butacas se comportan como libres desde el instante exacto.
    expect(tomadas(bd, viernes, '2026-08-14T18:05:00')).toEqual([])
  })

  it('bloquear respeta el choque y la función en venta (RNF-4, RF-13)', () => {
    const { bd, viernes } = bdListaParaVender()
    tomar(bd, viernes, [1], 'venta', 'compra-x', AHORA)

    expect(() => bloquear(bd, viernes, [1, 2], 'sesion-a', AHORA)).toThrow(ButacasYaTomadas)
    expect(() => bloquear(bd, viernes, [3], 'sesion-b', '2026-08-14T19:00:00')).toThrow(
      'La función no está en venta',
    )
  })

  it('pagar convierte el bloqueo en venta sin ventana, con contacto y canal internet (RN-26, RN-23, RN-27)', () => {
    const { bd, viernes } = bdListaParaVender()
    const avisos = avisosSimulados()
    const bloqueo = bloquear(bd, viernes, [1, 2], 'sesion-a', AHORA)

    const compra = pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T18:02:00')

    expect(compra).toMatchObject({
      canal: 'internet',
      jornada: '2026-08-14',
      estado: 'pagada',
      montoTotal: 16000,
      operadorId: null,
    })
    expect(compra.entradas).toHaveLength(2)
    const guardada = bd
      .prepare(
        `SELECT contacto_nombre AS nombre, contacto_correo AS correo, contacto_telefono AS telefono
         FROM compra WHERE numero = ?`,
      )
      .get(compra.numero)
    expect(guardada).toEqual({ nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' })
    // La venta no vence: mucho después del bloqueo, las butacas siguen del comprador.
    expect(tomadas(bd, viernes, '2026-08-14T23:00:00')).toEqual([
      { butacaId: 1, motivo: 'venta', referencia: compra.numero },
      { butacaId: 2, motivo: 'venta', referencia: compra.numero },
    ])
  })

  it('el correo del número se encola por Avisos, y su falla no revierte nada (RNF-5)', () => {
    const { bd, viernes } = bdListaParaVender()
    const avisos = avisosSimulados()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-a', AHORA)
    const compra = pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T18:02:00')

    expect(avisos.encolados).toHaveLength(1)
    expect(avisos.encolados[0]?.destinatario).toBe('ana@correo.com')
    expect(avisos.encolados[0]?.cuerpo).toContain(compra.numero)

    // Un Avisos roto no puede impedir la venta: la compra igual queda registrada.
    const avisosRotos: Avisos = {
      encolar() {
        throw new Error('proveedor caído')
      },
    }
    const bloqueo2 = bloquear(bd, viernes, [2], 'sesion-b', AHORA)
    const compra2 = pagar(bd, avisosRotos, bloqueo2, CONTACTO, '2026-08-14T18:02:00')
    expect(buscarCompra(bd, compra2.numero)).toBeDefined()
  })

  it('el pago fallido no deja rastro y el bloqueo sigue vivo (tabla de errores)', () => {
    const { bd, viernes } = bdListaParaVender()
    const avisos = avisosSimulados()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-a', AHORA)

    expect(() =>
      pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T18:02:00', () => false),
    ).toThrow('El pago no se completó. Las butacas siguen tuyas por lo que queda del bloqueo')

    expect(contar(bd, 'compra')).toBe(0)
    expect(avisos.encolados).toEqual([])
    expect(tomadas(bd, viernes, '2026-08-14T18:02:00')).toEqual([
      { butacaId: 1, motivo: 'bloqueo', referencia: 'sesion-a' },
    ])
  })

  it('un bloqueo vencido o una función ya empezada rechazan el pago sin rastro (RN-19, RN-21, REG-8)', () => {
    const { bd, viernes } = bdListaParaVender()
    const avisos = avisosSimulados()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-a', AHORA)

    expect(() => pagar(bd, avisos, bloqueo, CONTACTO, '2026-08-14T18:05:00')).toThrow(
      'Se venció el tiempo. Las butacas volvieron a estar libres',
    )

    const tardio = bloquear(bd, viernes, [2], 'sesion-b', '2026-08-14T18:58:00')
    expect(() => pagar(bd, avisos, tardio, CONTACTO, '2026-08-14T19:00:00')).toThrow(
      'La función no está en venta',
    )
    expect(contar(bd, 'compra')).toBe(0)
  })

  it('exige nombre, correo y teléfono de quien compra (RN-23)', () => {
    const { bd, viernes } = bdListaParaVender()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-a', AHORA)

    expect(() =>
      pagar(bd, avisosSimulados(), bloqueo, { nombre: 'Ana', correo: '  ', telefono: '8812' }, '2026-08-14T18:02:00'),
    ).toThrow('La compra por internet necesita nombre, correo y teléfono')
  })

  it('CA-3: por internet en miércoles se compra a mitad del general, categoría miércoles (RN-13)', () => {
    const { bd, semanaId } = bdListaParaVender()
    const miercoles = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-19',
      horaInicio: '19:00',
    })
    const bloqueo = bloquear(bd, miercoles, [121], 'sesion-a', '2026-08-19T18:00:00')
    expect(bloqueo.categoria).toBe('miercoles')

    const compra = pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-19T18:02:00')
    expect(compra.montoTotal).toBe(4000)
    expect(compra.entradas[0]).toMatchObject({ categoria: 'miercoles', monto: 4000 })
  })
})

