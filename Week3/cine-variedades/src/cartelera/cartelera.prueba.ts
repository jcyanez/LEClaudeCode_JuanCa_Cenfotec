import { describe, expect, it } from 'vitest'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import { tomar } from '../ocupacion/ocupacion.js'
import {
  abrirVenta,
  butacasDe,
  cancelarFuncion,
  crearSemana,
  eliminarFuncion,
  enVenta,
  fijarPrecios,
  modificarFuncion,
  peliculas,
  precio,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from './cartelera.js'

/** El miércoles 12 de agosto de 2026: su semana va del jueves 06 al miércoles 12. */
const HOY = '2026-08-12'

function bdConEsquema(): Bd {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  return bd
}

describe('cartelera: salas y butacas fijas (T5)', () => {
  it('sembrar crea las dos salas del cine: Sala 1 con 120 butacas y Sala 2 con 60 (RN-1)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const salas = bd
      .prepare(`SELECT nombre, filas, butacas_por_fila AS butacasPorFila FROM sala ORDER BY id`)
      .all()
    expect(salas).toEqual([
      { nombre: 'Sala 1', filas: 10, butacasPorFila: 12 },
      { nombre: 'Sala 2', filas: 6, butacasPorFila: 10 },
    ])

    const porSala = bd
      .prepare(`SELECT sala_id AS salaId, COUNT(*) AS cantidad FROM butaca GROUP BY sala_id`)
      .all()
    expect(porSala).toEqual([
      { salaId: 1, cantidad: 120 },
      { salaId: 2, cantidad: 60 },
    ])
  })

  it('las filas van de la A a la J en Sala 1 y de la A a la F en Sala 2 (RN-1, RN-2)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const filasSala1 = bd
      .prepare(`SELECT DISTINCT fila FROM butaca WHERE sala_id = 1 ORDER BY fila`)
      .all()
      .map((f) => (f as { fila: string }).fila)
    expect(filasSala1).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])

    const filasSala2 = bd
      .prepare(`SELECT DISTINCT fila FROM butaca WHERE sala_id = 2 ORDER BY fila`)
      .all()
      .map((f) => (f as { fila: string }).fila)
    expect(filasSala2).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('butacasDe devuelve las butacas identificadas por fila y número, en orden (RN-2)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)

    const butacas = butacasDe(bd, 2)

    expect(butacas).toHaveLength(60)
    expect(butacas[0]).toEqual({ id: 121, fila: 'A', numero: 1, etiqueta: 'A1' })
    expect(butacas[59]).toEqual({ id: 180, fila: 'F', numero: 10, etiqueta: 'F10' })
    // Dentro de una fila, numeradas de izquierda a derecha mirando la pantalla.
    expect(butacas.slice(0, 10).map((b) => b.etiqueta)).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
    ])
  })

  it('sembrar dos veces no duplica nada: las butacas se crean una sola vez (RN-1)', () => {
    const bd = bdConEsquema()
    sembrarSalas(bd)
    sembrarSalas(bd)

    const total = bd.prepare(`SELECT COUNT(*) AS cantidad FROM butaca`).get() as {
      cantidad: number
    }
    expect(total.cantidad).toBe(180)
  })
})

describe('cartelera: películas (T5)', () => {
  it('registra una película con su duración y la devuelve al consultar (RN-4, RF-1)', () => {
    const bd = bdConEsquema()

    const id = registrarPelicula(bd, 'El séptimo sello', 96)

    expect(peliculas(bd)).toEqual([{ id, titulo: 'El séptimo sello', duracionMinutos: 96 }])
  })

  it('rechaza una película sin título, nombrando lo que falta', () => {
    const bd = bdConEsquema()
    expect(() => registrarPelicula(bd, '   ', 96)).toThrow('La película necesita un título')
    expect(peliculas(bd)).toEqual([])
  })

  it('rechaza una duración que no sea un entero positivo de minutos (RN-4)', () => {
    const bd = bdConEsquema()
    expect(() => registrarPelicula(bd, 'El séptimo sello', 0)).toThrow(
      'La duración debe ser un número entero de minutos mayor que cero',
    )
    expect(() => registrarPelicula(bd, 'El séptimo sello', 95.5)).toThrow(
      'La duración debe ser un número entero de minutos mayor que cero',
    )
    expect(peliculas(bd)).toEqual([])
  })
})

describe('cartelera: semanas de cartelera (T6)', () => {
  it('crea una semana que empieza un jueves, cerrada a la venta hasta que se abra (RN-3, RN-9)', () => {
    const bd = bdConEsquema()

    const id = crearSemana(bd, '2026-08-13', HOY)

    const semana = bd
      .prepare(
        `SELECT jueves_inicio AS juevesInicio, abierta_a_venta AS abierta
         FROM semana_cartelera WHERE id = ?`,
      )
      .get(id)
    expect(semana).toEqual({ juevesInicio: '2026-08-13', abierta: 0 })
  })

  it('rechaza una semana que no empieza un jueves (RN-3)', () => {
    const bd = bdConEsquema()
    expect(() => crearSemana(bd, '2026-08-14', HOY)).toThrow(
      'Una semana de cartelera empieza un jueves',
    )
  })

  it('solo pueden estar cargadas la semana en curso y la siguiente (RN-8)', () => {
    const bd = bdConEsquema()
    crearSemana(bd, '2026-08-06', HOY) // la en curso
    crearSemana(bd, '2026-08-13', HOY) // la siguiente

    // Ni una tercera hacia adelante, ni una semana que ya pasó.
    expect(() => crearSemana(bd, '2026-08-20', HOY)).toThrow(
      'Solo pueden estar cargadas la semana en curso y la siguiente',
    )
    expect(() => crearSemana(bd, '2026-07-30', HOY)).toThrow(
      'Solo pueden estar cargadas la semana en curso y la siguiente',
    )
  })

  it('una semana ya cargada no se carga dos veces (RN-8)', () => {
    const bd = bdConEsquema()
    crearSemana(bd, '2026-08-13', HOY)
    expect(() => crearSemana(bd, '2026-08-13', HOY)).toThrow(
      'La semana del jueves 2026-08-13 ya está cargada',
    )
  })

  it('abrirVenta abre la venta de las funciones de la semana (RN-9, RF-5)', () => {
    const bd = bdConEsquema()
    const id = crearSemana(bd, '2026-08-13', HOY)

    abrirVenta(bd, id)

    const semana = bd
      .prepare(`SELECT abierta_a_venta AS abierta FROM semana_cartelera WHERE id = ?`)
      .get(id)
    expect(semana).toEqual({ abierta: 1 })
  })
})

/** Base con salas sembradas, una película de 120 minutos y la semana del jueves 13. */
function bdConCartelera(): { bd: Bd; peliculaId: number; semanaId: number } {
  const bd = bdConEsquema()
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La película', 120)
  const semanaId = crearSemana(bd, '2026-08-13', HOY)
  return { bd, peliculaId, semanaId }
}

describe('cartelera: funciones (T6)', () => {
  it('programa una función con película, sala, fecha y hora de inicio (RN-5, RF-2)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()

    const id = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
    })

    const funcion = bd
      .prepare(
        `SELECT pelicula_id AS peliculaId, sala_id AS salaId, semana_id AS semanaId,
                fecha, hora_inicio AS horaInicio, estado
         FROM funcion WHERE id = ?`,
      )
      .get(id)
    expect(funcion).toEqual({
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
      estado: 'programada',
    })
  })

  it('rechaza una fecha que no cae en la semana de jueves a miércoles (RN-3, RF-2)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const base = { peliculaId, salaId: 1, semanaId, horaInicio: '19:00' }

    expect(() => programarFuncion(bd, { ...base, fecha: '2026-08-12' })).toThrow(
      'La fecha 2026-08-12 no cae en la semana del jueves 2026-08-13',
    )
    expect(() => programarFuncion(bd, { ...base, fecha: '2026-08-20' })).toThrow(
      'La fecha 2026-08-20 no cae en la semana del jueves 2026-08-13',
    )
    // El miércoles final sí es parte de la semana.
    expect(() => programarFuncion(bd, { ...base, fecha: '2026-08-19' })).not.toThrow()
  })

  it('CA-7: una de 120 minutos a las 19:00 impide otra en la misma sala antes de las 21:20, y admite las 21:20 (RN-6, RF-3)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const base = { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14' }
    programarFuncion(bd, { ...base, horaInicio: '19:00' })

    const mensaje =
      'Choca con la función de Sala 1 que termina a las 21:00. La primera hora posible es 21:20'
    expect(() => programarFuncion(bd, { ...base, horaInicio: '21:00' })).toThrow(mensaje)
    expect(() => programarFuncion(bd, { ...base, horaInicio: '21:19' })).toThrow(mensaje)
    expect(() => programarFuncion(bd, { ...base, horaInicio: '21:20' })).not.toThrow()
  })

  it('rechaza también a la que terminaría a menos de 20 minutos de la siguiente (RN-6, RF-3)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const base = { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14' }
    programarFuncion(bd, { ...base, horaInicio: '19:00' })

    // 16:50 + 120 min termina 18:50: deja solo 10 minutos antes de las 19:00.
    expect(() => programarFuncion(bd, { ...base, horaInicio: '16:50' })).toThrow(
      'Choca con la función de Sala 1 que termina a las 21:00. La primera hora posible es 21:20',
    )
    // 16:40 termina 18:40: los 20 minutos quedan justos.
    expect(() => programarFuncion(bd, { ...base, horaInicio: '16:40' })).not.toThrow()
  })

  it('funciones de salas distintas no se estorban: el margen es por sala (RN-6)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '19:00' })

    expect(() =>
      programarFuncion(bd, { peliculaId, salaId: 2, semanaId, fecha: '2026-08-14', horaInicio: '19:00' }),
    ).not.toThrow()
  })

  it('modificar cambia la función y vuelve a validar el margen (RF-4, RN-6)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const base = { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14' }
    programarFuncion(bd, { ...base, horaInicio: '19:00' })
    const id = programarFuncion(bd, { ...base, horaInicio: '21:20' })

    expect(() => modificarFuncion(bd, id, { horaInicio: '21:10' }, '2026-08-12T10:00:00')).toThrow(
      'Choca con la función de Sala 1 que termina a las 21:00. La primera hora posible es 21:20',
    )

    modificarFuncion(bd, id, { horaInicio: '21:30' }, '2026-08-12T10:00:00')
    const funcion = bd.prepare(`SELECT hora_inicio AS horaInicio FROM funcion WHERE id = ?`).get(id)
    expect(funcion).toEqual({ horaInicio: '21:30' })
  })

  it('una función con butacas tomadas no se modifica ni se elimina (RF-4)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const id = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
    })
    tomar(bd, id, [1], 'venta', 'compra-1', '2026-08-12T10:00:00')

    expect(() => modificarFuncion(bd, id, { horaInicio: '20:00' }, '2026-08-12T10:00:00')).toThrow(
      'La función tiene butacas tomadas y no se puede modificar',
    )
    expect(() => eliminarFuncion(bd, id, '2026-08-12T10:00:00')).toThrow(
      'La función tiene butacas tomadas y no se puede eliminar',
    )
  })

  it('eliminar borra una función sin butacas tomadas (RF-4)', () => {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const id = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
    })

    eliminarFuncion(bd, id, '2026-08-12T10:00:00')

    expect(bd.prepare(`SELECT 1 FROM funcion WHERE id = ?`).get(id)).toBeUndefined()
  })
})

describe('cartelera: cancelación y funciones en venta (T6)', () => {
  const OPERADOR = { operadorId: 1, instante: '2026-08-14T20:15:00', jornada: '2026-08-14' }

  function bdConFuncion(): { bd: Bd; funcionId: number; semanaId: number } {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    bd.prepare(
      `INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`,
    ).run()
    const funcionId = programarFuncion(bd, {
      peliculaId,
      salaId: 1,
      semanaId,
      fecha: '2026-08-14',
      horaInicio: '19:00',
    })
    return { bd, funcionId, semanaId }
  }

  it('cancelar deja la función cancelada con operador, instante, jornada y motivo (RN-41, REG-4)', () => {
    const { bd, funcionId } = bdConFuncion()

    cancelarFuncion(bd, funcionId, { ...OPERADOR, motivo: 'Falló el proyector' })

    const funcion = bd
      .prepare(
        `SELECT estado, cancelada_operador AS operadorId, cancelada_instante AS instante,
                cancelada_jornada AS jornada, cancelada_motivo AS motivo
         FROM funcion WHERE id = ?`,
      )
      .get(funcionId)
    expect(funcion).toEqual({
      estado: 'cancelada',
      operadorId: 1,
      instante: '2026-08-14T20:15:00',
      jornada: '2026-08-14',
      motivo: 'Falló el proyector',
    })
  })

  it('una función cancelada no bloquea el margen: su proyección no va a ocurrir (RN-6, RN-41)', () => {
    const { bd, funcionId, semanaId } = bdConFuncion()
    cancelarFuncion(bd, funcionId, { ...OPERADOR, motivo: 'Falló el proyector' })

    expect(() =>
      programarFuncion(bd, {
        peliculaId: 1,
        salaId: 1,
        semanaId,
        fecha: '2026-08-14',
        horaInicio: '19:30',
      }),
    ).not.toThrow()
  })

  it('en venta exige la semana abierta: antes de abrirla, ninguna función se vende (RN-9)', () => {
    const { bd, funcionId, semanaId } = bdConFuncion()
    const antesDeLaFuncion = '2026-08-14T18:00:00'

    expect(enVenta(bd, funcionId, antesDeLaFuncion)).toBe(false)
    abrirVenta(bd, semanaId)
    expect(enVenta(bd, funcionId, antesDeLaFuncion)).toBe(true)
  })

  it('la venta se cierra a la hora exacta de inicio (RN-21, CA-2)', () => {
    const { bd, funcionId, semanaId } = bdConFuncion()
    abrirVenta(bd, semanaId)

    expect(enVenta(bd, funcionId, '2026-08-14T18:59:59')).toBe(true)
    expect(enVenta(bd, funcionId, '2026-08-14T19:00:00')).toBe(false)
  })

  it('una función cancelada no está en venta (RN-43)', () => {
    const { bd, funcionId, semanaId } = bdConFuncion()
    abrirVenta(bd, semanaId)
    cancelarFuncion(bd, funcionId, { ...OPERADOR, motivo: 'Falló el proyector' })

    expect(enVenta(bd, funcionId, '2026-08-14T18:00:00')).toBe(false)
  })
})

describe('cartelera: precios vigentes (T7)', () => {
  /** Una función por día que interesa: viernes 14, martes 18 y miércoles 19. */
  function bdConFunciones(): { bd: Bd; viernes: number; martes: number; miercoles: number } {
    const { bd, peliculaId, semanaId } = bdConCartelera()
    const base = { peliculaId, salaId: 1, semanaId, horaInicio: '19:00' }
    const viernes = programarFuncion(bd, { ...base, fecha: '2026-08-14' })
    const martes = programarFuncion(bd, { ...base, fecha: '2026-08-18' })
    const miercoles = programarFuncion(bd, { ...base, fecha: '2026-08-19' })
    return { bd, viernes, martes, miercoles }
  }

  it('la dueña fija los dos montos y el precio sale de ahí, por categoría (RN-12, RF-6, RF-7)', () => {
    const { bd, viernes } = bdConFunciones()

    fijarPrecios(bd, 8000, 5000, '2026-08-01')

    expect(precio(bd, viernes, 'general')).toBe(8000)
    expect(precio(bd, viernes, 'estudiante')).toBe(5000)
  })

  it('el precio se determina por la fecha de la función, no por la del cambio (RN-15)', () => {
    const { bd, viernes, martes } = bdConFunciones()
    fijarPrecios(bd, 8000, 5000, '2026-08-01')
    fijarPrecios(bd, 9000, 6000, '2026-08-15')

    // El historial explica el monto viejo aunque el vigente haya cambiado (DISENO.md).
    expect(precio(bd, viernes, 'general')).toBe(8000)
    expect(precio(bd, martes, 'general')).toBe(9000)
  })

  it('CA-3: en una función de miércoles toda entrada vale la mitad del precio general (RN-13)', () => {
    const { bd, miercoles } = bdConFunciones()
    fijarPrecios(bd, 8000, 5000, '2026-08-01')

    expect(precio(bd, miercoles, 'miercoles')).toBe(4000)
  })

  it('CA-3: en miércoles no existen las categorías general ni estudiante (RN-14)', () => {
    const { bd, miercoles } = bdConFunciones()
    fijarPrecios(bd, 8000, 5000, '2026-08-01')

    expect(() => precio(bd, miercoles, 'estudiante')).toThrow(
      'En las funciones de miércoles no existe el precio de estudiante',
    )
    expect(() => precio(bd, miercoles, 'general')).toThrow(
      'En las funciones de miércoles toda entrada se vende a la categoría miércoles',
    )
  })

  it('la categoría miércoles no existe fuera del miércoles (RN-13)', () => {
    const { bd, viernes } = bdConFunciones()
    fijarPrecios(bd, 8000, 5000, '2026-08-01')

    expect(() => precio(bd, viernes, 'miercoles')).toThrow(
      'La categoría miércoles es solo para funciones de miércoles',
    )
  })

  it('sin precios vigentes a la fecha de la función, el rechazo lo dice (RN-15)', () => {
    const { bd, viernes } = bdConFunciones()

    expect(() => precio(bd, viernes, 'general')).toThrow(
      'No hay precios vigentes para el 2026-08-14',
    )
  })

  it('rechaza montos que no sean enteros de céntimos mayores que cero (RN-12)', () => {
    const { bd } = bdConFunciones()

    expect(() => fijarPrecios(bd, 0, 5000, '2026-08-01')).toThrow(
      'Los montos deben ser enteros de céntimos mayores que cero',
    )
    expect(() => fijarPrecios(bd, 8000, 50.5, '2026-08-01')).toThrow(
      'Los montos deben ser enteros de céntimos mayores que cero',
    )
  })
})
