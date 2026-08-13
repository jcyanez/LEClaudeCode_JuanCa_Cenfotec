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
  anular,
  barrerVencidos,
  bloquear,
  bloqueoVigente,
  ButacasYaTomadas,
  buscarCompra,
  buscarCompraPorContacto,
  cancelarFuncion as cancelarFuncionVenta,
  CompraAnulada,
  CompraInexistente,
  convertir,
  EntradaYaUsada,
  FuncionCancelada,
  jornadaDe,
  liberarReserva,
  marcarDevolucionEntregada,
  NumeroDeOtraFuncion,
  pagar,
  reservar,
  validar,
  venderEnTaquilla,
  type Avisos,
} from './venta.js'

const HOY = '2026-08-12'
const AHORA = '2026-08-14T18:00:00'
const NUMERO_LEGIBLE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

/** Cartelera lista para vender: semana abierta, precios fijados, un operador de taquilla y uno de puerta. */
function bdListaParaVender(): {
  bd: Bd
  viernes: number
  semanaId: number
  operadorId: number
  puertaId: number
} {
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
  const puertaId = Number(
    bd
      .prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Nico', 'puerta', '5678')`)
      .run().lastInsertRowid,
  )
  const viernes = programarFuncion(bd, {
    peliculaId,
    salaId: 1,
    semanaId,
    fecha: '2026-08-14',
    horaInicio: '19:00',
  })
  return { bd, viernes, semanaId, operadorId: 1, puertaId }
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

  it('bloqueoVigente reconstruye el bloqueo de una sesión para pagar en otro pedido (T19)', () => {
    const { bd, viernes } = bdListaParaVender()
    bloquear(bd, viernes, [1, 2], 'sesion-a', AHORA)

    const reconstruido = bloqueoVigente(bd, viernes, 'sesion-a', '2026-08-14T18:03:00')

    expect(reconstruido).toEqual({
      sesion: 'sesion-a',
      funcionId: viernes,
      butacaIds: [1, 2],
      categoria: 'general',
      vence: '2026-08-14T18:05:00',
    })
  })

  it('bloqueoVigente no encuentra nada si venció o nunca existió', () => {
    const { bd, viernes } = bdListaParaVender()
    bloquear(bd, viernes, [1], 'sesion-a', AHORA)

    expect(bloqueoVigente(bd, viernes, 'sesion-a', '2026-08-14T18:05:00')).toBeUndefined()
    expect(bloqueoVigente(bd, viernes, 'nadie', AHORA)).toBeUndefined()
  })
})

describe('venta: reservas de estudiante (T10)', () => {
  it('reservar aparta butacas sin pago, con número, hasta el inicio de la función (RN-25, RN-29, RN-30, REG-3)', () => {
    const { bd, viernes } = bdListaParaVender()
    const avisos = avisosSimulados()

    const reserva = reservar(bd, avisos, viernes, [1, 2], CONTACTO, AHORA)

    expect(reserva.numero).toMatch(NUMERO_LEGIBLE)
    expect(reserva).toMatchObject({ funcionId: viernes, butacaIds: [1, 2], vence: '2026-08-14T19:00:00' })
    expect(tomadas(bd, viernes, AHORA)).toEqual([
      { butacaId: 1, motivo: 'reserva', referencia: reserva.numero },
      { butacaId: 2, motivo: 'reserva', referencia: reserva.numero },
    ])
    // REG-3: la reserva vigente guarda contacto e instante, en su propia tabla.
    const guardada = bd
      .prepare(`SELECT nombre, correo, telefono, instante FROM reserva WHERE numero = ?`)
      .get(reserva.numero)
    expect(guardada).toEqual({ ...CONTACTO, instante: AHORA })
    // No es una venta: ninguna consulta de compras la ve (decisión del modelo).
    expect(buscarCompra(bd, reserva.numero)).toBeUndefined()
    // El número llega por correo (recorrido de la especificación).
    expect(avisos.encolados[0]?.cuerpo).toContain(reserva.numero)
    // Vence al empezar la función, desde el instante exacto (RN-30).
    expect(tomadas(bd, viernes, '2026-08-14T19:00:00')).toEqual([])
  })

  it('no hay reservas en las funciones de miércoles (RN-14, CA-3)', () => {
    const { bd, semanaId } = bdListaParaVender()
    const miercoles = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-19',
      horaInicio: '19:00',
    })

    expect(() =>
      reservar(bd, avisosSimulados(), miercoles, [121], CONTACTO, '2026-08-19T18:00:00'),
    ).toThrow('En las funciones de miércoles no hay reservas de estudiante')
  })

  it('reservar exige contacto, función en venta y butacas libres (RN-23, RF-13, RNF-4)', () => {
    const { bd, viernes } = bdListaParaVender()
    tomar(bd, viernes, [1], 'venta', 'compra-x', AHORA)

    expect(() =>
      reservar(bd, avisosSimulados(), viernes, [2], { ...CONTACTO, correo: ' ' }, AHORA),
    ).toThrow('La reserva necesita nombre, correo y teléfono')
    expect(() => reservar(bd, avisosSimulados(), viernes, [1], CONTACTO, AHORA)).toThrow(
      ButacasYaTomadas,
    )
    expect(() =>
      reservar(bd, avisosSimulados(), viernes, [2], CONTACTO, '2026-08-14T19:00:00'),
    ).toThrow('La función no está en venta')
  })

  it('convertir con carné cobra precio estudiante y conserva el número (RN-31, RN-25)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const reserva = reservar(bd, avisosSimulados(), viernes, [1, 2], CONTACTO, AHORA)

    const compra = convertir(bd, reserva.numero, true, operadorId, '2026-08-14T18:30:00')

    expect(compra.numero).toBe(reserva.numero)
    expect(compra).toMatchObject({ canal: 'taquilla', montoTotal: 10000, operadorId })
    expect(compra.entradas.map((e) => e.categoria)).toEqual(['estudiante', 'estudiante'])
    // La butaca nunca queda libre en el medio, y la venta ya no vence (RN-26 aplicado a reservas).
    expect(tomadas(bd, viernes, '2026-08-14T23:00:00')).toEqual([
      { butacaId: 1, motivo: 'venta', referencia: reserva.numero },
      { butacaId: 2, motivo: 'venta', referencia: reserva.numero },
    ])
    // La reserva ya no existe como tal: ahora es una compra.
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM reserva`).get()).toEqual({ n: 0 })
  })

  it('convertir sin carné cobra precio general (RN-32)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const reserva = reservar(bd, avisosSimulados(), viernes, [1], CONTACTO, AHORA)

    const compra = convertir(bd, reserva.numero, false, operadorId, '2026-08-14T18:30:00')

    expect(compra.montoTotal).toBe(8000)
    expect(compra.entradas[0]).toMatchObject({ categoria: 'general', monto: 8000 })
  })

  it('una reserva vencida no se convierte: venció al empezar la función (RN-30)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const reserva = reservar(bd, avisosSimulados(), viernes, [1], CONTACTO, AHORA)

    expect(() => convertir(bd, reserva.numero, true, operadorId, '2026-08-14T19:00:00')).toThrow(
      'La reserva venció al empezar la función: las butacas volvieron a estar libres',
    )
    expect(() => convertir(bd, 'XXXXXX', true, operadorId, AHORA)).toThrow(
      'No existe una reserva con ese número',
    )
    expect(contar(bd, 'compra')).toBe(0)
  })

  it('quien no presenta carné y no paga general libera las butacas en el acto (RN-32)', () => {
    const { bd, viernes } = bdListaParaVender()
    const reserva = reservar(bd, avisosSimulados(), viernes, [1, 2], CONTACTO, AHORA)

    liberarReserva(bd, reserva.numero)

    expect(tomadas(bd, viernes, AHORA)).toEqual([])
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM reserva`).get()).toEqual({ n: 0 })
  })

  it('el barrido borra reservas vencidas con sus butacas y no toca las vigentes (RN-34, REG-8)', () => {
    const { bd, viernes, semanaId } = bdListaParaVender()
    const manana = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-15',
      horaInicio: '10:00',
    })
    const vencida = reservar(bd, avisosSimulados(), viernes, [1], CONTACTO, AHORA)
    const vigente = reservar(bd, avisosSimulados(), manana, [121], CONTACTO, AHORA)

    const barrido = barrerVencidos(bd, '2026-08-14T19:00:00')

    expect(barrido.reservas).toBe(1)
    const quedan = bd.prepare(`SELECT numero FROM reserva`).all()
    expect(quedan).toEqual([{ numero: vigente.numero }])
    // Las vencidas no se conservan (RN-34) y sus filas de ocupación tampoco.
    expect(bd.prepare(`SELECT COUNT(*) AS n FROM ocupacion WHERE referencia = ?`).get(vencida.numero)).toEqual({ n: 0 })
    expect(tomadas(bd, manana, '2026-08-14T19:00:00')).toHaveLength(1)
  })
})

describe('venta: validación en puerta (T11)', () => {
  it('marca instante y operador en cada entrada de la compra (RF-18, RF-19, REG-2)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const compra = venderEnTaquilla(
      bd,
      viernes,
      [
        { butacaId: 1, categoria: 'general' },
        { butacaId: 2, categoria: 'general' },
      ],
      operadorId,
      AHORA,
    )
    const puerta = puertaId

    const validada = validar(bd, viernes, compra.numero, puerta, '2026-08-14T18:45:00')

    expect(validada.entradas).toEqual([
      { butacaId: 1, categoria: 'general', monto: 8000, usadaInstante: '2026-08-14T18:45:00', usadaOperadorId: puerta },
      { butacaId: 2, categoria: 'general', monto: 8000, usadaInstante: '2026-08-14T18:45:00', usadaOperadorId: puerta },
    ])
  })

  it('un número inexistente ofrece la búsqueda alternativa, sin registrar nada (RF-18)', () => {
    const { bd, viernes, puertaId } = bdListaParaVender()

    expect(() => validar(bd, viernes, 'XXXXXX', puertaId, AHORA)).toThrow(CompraInexistente)
  })

  it('un número de otra función dice de cuál es, y no se valida (tabla de errores)', () => {
    const { bd, viernes, semanaId, operadorId, puertaId } = bdListaParaVender()
    const sabado = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-15',
      horaInicio: '21:00',
    })
    const compra = venderEnTaquilla(bd, sabado, [{ butacaId: 121, categoria: 'general' }], operadorId, AHORA)

    let rechazo: unknown
    try {
      validar(bd, viernes, compra.numero, puertaId, AHORA)
    } catch (error) {
      rechazo = error
    }

    expect(rechazo).toBeInstanceOf(NumeroDeOtraFuncion)
    expect((rechazo as NumeroDeOtraFuncion).funcionId).toBe(sabado)
    expect(bd.prepare(`SELECT usada_instante FROM entrada`).get()).toEqual({ usada_instante: null })
  })

  it('unas entradas ya usadas no se vuelven a validar, y se muestra quién y cuándo (RN-37, REG-2)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    validar(bd, viernes, compra.numero, puertaId, '2026-08-14T18:42:00')

    let rechazo: unknown
    try {
      validar(bd, viernes, compra.numero, puertaId, '2026-08-14T18:50:00')
    } catch (error) {
      rechazo = error
    }

    expect(rechazo).toBeInstanceOf(EntradaYaUsada)
    expect((rechazo as EntradaYaUsada).usadaInstante).toBe('2026-08-14T18:42:00')
    expect((rechazo as EntradaYaUsada).usadaOperadorId).toBe(puertaId)
  })

  it('una compra de una función cancelada aparece devuelta y no se valida (tabla de errores)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    cancelarFuncionVenta(bd, avisosSimulados(), viernes, operadorId, 'Falló el proyector', AHORA)

    expect(() => validar(bd, viernes, compra.numero, puertaId, AHORA)).toThrow(FuncionCancelada)
  })

  it('una compra anulada no se valida (RF-20)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    anular(bd, compra.numero, operadorId, 'Venta duplicada', AHORA)

    expect(() => validar(bd, viernes, compra.numero, puertaId, AHORA)).toThrow(CompraAnulada)
  })

  it('buscarCompraPorContacto encuentra por nombre o correo, sin distinguir mayúsculas (RF-18)', () => {
    const { bd, viernes } = bdListaParaVender()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-a', AHORA)
    const compra = pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-14T18:02:00')

    expect(buscarCompraPorContacto(bd, 'ana solano').map((c) => c.numero)).toEqual([compra.numero])
    expect(buscarCompraPorContacto(bd, 'ANA@correo.com').map((c) => c.numero)).toEqual([compra.numero])
    expect(buscarCompraPorContacto(bd, 'nadie')).toEqual([])
  })
})

describe('venta: anulación, cancelación y devolución (T12)', () => {
  it('anular libera las butacas y registra operador, instante, jornada y motivo (RN-38, RN-40, REG-4)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)

    anular(bd, compra.numero, operadorId, 'Venta duplicada', '2026-08-14T18:45:00')

    expect(tomadas(bd, viernes, '2026-08-14T18:45:00')).toEqual([])
    const fila = bd
      .prepare(
        `SELECT estado, reversa_operador_id AS operadorId, reversa_instante AS instante,
                reversa_jornada AS jornada, reversa_motivo AS motivo
         FROM compra WHERE numero = ?`,
      )
      .get(compra.numero)
    expect(fila).toEqual({
      estado: 'anulada',
      operadorId,
      instante: '2026-08-14T18:45:00',
      jornada: '2026-08-14',
      motivo: 'Venta duplicada',
    })
    // Las butacas liberadas se pueden volver a vender (RN-38).
    const reventa = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, '2026-08-14T18:46:00')
    expect(reventa.numero).not.toBe(compra.numero)
  })

  it('rechaza anular un número inexistente (RF-21)', () => {
    const { bd } = bdListaParaVender()
    expect(() => anular(bd, 'XXXXXX', 1, 'motivo', AHORA)).toThrow(CompraInexistente)
  })

  it('rechaza anular una compra con entradas ya usadas (RN-39, RF-22)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    validar(bd, viernes, compra.numero, puertaId, '2026-08-14T18:45:00')

    expect(() => anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T18:50:00')).toThrow(EntradaYaUsada)
  })

  it('rechaza anular después de que empezó la función (RN-38)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)

    expect(() => anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T19:00:00')).toThrow(
      'La función ya empezó: no se puede anular la compra',
    )
  })

  it('rechaza anular una compra que ya no está vigente', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T18:45:00')

    expect(() => anular(bd, compra.numero, operadorId, 'otro motivo', '2026-08-14T18:46:00')).toThrow(
      `La compra ${compra.numero} ya no está vigente`,
    )
  })

  it('cancelarFuncion devuelve todas las compras pagadas, validadas o no, y libera sus butacas (RN-41, RF-23)', () => {
    const { bd, viernes, operadorId, puertaId } = bdListaParaVender()
    const enTaquilla = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    validar(bd, viernes, enTaquilla.numero, puertaId, '2026-08-14T18:45:00')
    const bloqueo = bloquear(bd, viernes, [2], 'sesion-a', AHORA)
    const porInternet = pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-14T18:02:00')
    const avisos = avisosSimulados()

    const devueltas = cancelarFuncionVenta(bd, avisos, viernes, operadorId, 'Falló el proyector', '2026-08-14T18:50:00')

    expect(devueltas.map((c) => c.numero).sort()).toEqual([enTaquilla.numero, porInternet.numero].sort())
    expect(devueltas.every((c) => c.estado === 'devuelta')).toBe(true)
    expect(tomadas(bd, viernes, '2026-08-14T18:50:00')).toEqual([])
    // Solo se avisa a quien compró por internet (RF-24).
    expect(avisos.encolados).toHaveLength(1)
    expect(avisos.encolados[0]?.destinatario).toBe('ana@correo.com')
    expect(avisos.encolados[0]?.cuerpo).toContain(porInternet.numero)
    // La función queda marcada cancelada (RN-41).
    const funcion = bd.prepare(`SELECT estado, cancelada_motivo AS motivo FROM funcion WHERE id = ?`).get(viernes)
    expect(funcion).toEqual({ estado: 'cancelada', motivo: 'Falló el proyector' })
  })

  it('CA-8: se puede cancelar pasada la medianoche si sigue la misma jornada (RN-42)', () => {
    const { bd, semanaId, operadorId } = bdListaParaVender()
    const nocturna = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '23:00',
    })

    const devueltas = cancelarFuncionVenta(
      bd,
      avisosSimulados(),
      nocturna,
      operadorId,
      'motivo',
      '2026-08-15T00:15:00',
    )
    expect(devueltas).toEqual([])

    // Al día siguiente (jornada ya cerrada) ya no se puede cancelar (RN-42).
    const otraNocturna = programarFuncion(bd, {
      peliculaId: 1,
      salaId: 2,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '20:00',
    })
    expect(() =>
      cancelarFuncionVenta(bd, avisosSimulados(), otraNocturna, operadorId, 'motivo', '2026-08-15T06:01:00'),
    ).toThrow('La jornada de esa función ya cerró: no se puede cancelar')
  })

  it('marcarDevolucionEntregada registra su propio operador, instante y jornada (RF-25, REG-5, RN-44)', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const compra = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    anular(bd, compra.numero, operadorId, 'motivo', '2026-08-14T18:45:00')

    marcarDevolucionEntregada(bd, compra.numero, operadorId, '2026-08-15T10:00:00')

    const fila = bd
      .prepare(
        `SELECT entrega_operador_id AS operadorId, entrega_instante AS instante,
                entrega_jornada AS jornada, reversa_instante AS reversaInstante
         FROM compra WHERE numero = ?`,
      )
      .get(compra.numero)
    expect(fila).toEqual({
      operadorId,
      instante: '2026-08-15T10:00:00',
      jornada: '2026-08-15',
      // El instante de la anulación no se pisa con el de la entrega (dos eventos distintos).
      reversaInstante: '2026-08-14T18:45:00',
    })
  })

  it('rechaza marcar entregada una devolución de internet o de una compra todavía pagada', () => {
    const { bd, viernes, operadorId } = bdListaParaVender()
    const pagada = venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], operadorId, AHORA)
    expect(() => marcarDevolucionEntregada(bd, pagada.numero, operadorId, AHORA)).toThrow(
      `La compra ${pagada.numero} no está anulada ni devuelta`,
    )

    const bloqueo = bloquear(bd, viernes, [2], 'sesion-a', AHORA)
    const internet = pagar(bd, avisosSimulados(), bloqueo, CONTACTO, '2026-08-14T18:02:00')
    anular(bd, internet.numero, operadorId, 'motivo', '2026-08-14T18:45:00')
    expect(() => marcarDevolucionEntregada(bd, internet.numero, operadorId, AHORA)).toThrow(
      'Solo las devoluciones de una compra de taquilla se entregan en efectivo',
    )
  })
})
