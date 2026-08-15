/**
 * T22 — Las tres promesas transversales de `DISENO.md` (sección «Manejo de
 * errores»), verificadas una por una:
 *
 *   1. Toda operación que toca butacas es una sola transacción: si falla en el
 *      medio, no queda ninguna butaca tomada.
 *   2. Ningún aviso revierte nada (`RNF-5`).
 *   3. Ningún mensaje dice «error inesperado»: todos nombran el objeto
 *      concreto —la butaca, la hora, el operador—.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { Avisos } from '../avisos/avisos.js'
import { abrirBd, type Bd } from '../base/bd.js'
import { listaMigraciones } from '../base/lista-migraciones.js'
import { aplicarMigraciones } from '../base/migraciones.js'
import {
  abrirVenta,
  crearSemana,
  fijarPrecios,
  programarFuncion,
  registrarPelicula,
  sembrarSalas,
} from '../cartelera/cartelera.js'
import { tomadas } from '../ocupacion/ocupacion.js'
import { bloquear, cancelarFuncion, pagar, reservar, venderEnTaquilla } from '../venta/venta.js'
import { crearApp } from '../entrada/servidor/app.js'

const AHORA = '2026-08-14T18:00:00'
const CONTACTO = { nombre: 'Ana Solano', correo: 'ana@correo.com', telefono: '8812 4455' }

function escenario(): { bd: Bd; viernes: number; taquillaId: number } {
  const bd = abrirBd()
  aplicarMigraciones(bd, listaMigraciones)
  sembrarSalas(bd)
  const peliculaId = registrarPelicula(bd, 'La ventana indiscreta', 120)
  const semanaId = crearSemana(bd, '2026-08-13', '2026-08-12')
  abrirVenta(bd, semanaId)
  fijarPrecios(bd, 8000, 5000, '2026-08-01')
  bd.prepare(`INSERT INTO operador (nombre, puesto, credencial) VALUES ('Marta', 'taquilla', '1234')`).run()
  const viernes = programarFuncion(bd, { peliculaId, salaId: 1, semanaId, fecha: '2026-08-14', horaInicio: '19:00' })
  return { bd, viernes, taquillaId: 1 }
}

/** Avisos que se cae siempre: el peor caso de RNF-5. */
const avisosCaidos: Avisos = {
  encolar() {
    throw new Error('El correo no está disponible')
  },
}

describe('Promesa 1 — toda operación que toca butacas es una sola transacción', () => {
  it('si otro se adelantó con una del grupo, ninguna del grupo queda tomada (RN-22, REG-1)', () => {
    const { bd, viernes, taquillaId } = escenario()
    venderEnTaquilla(bd, viernes, [{ butacaId: 3, categoria: 'general' }], taquillaId, AHORA)

    expect(() =>
      venderEnTaquilla(
        bd,
        viernes,
        [
          { butacaId: 1, categoria: 'general' },
          { butacaId: 2, categoria: 'general' },
          { butacaId: 3, categoria: 'general' },
        ],
        taquillaId,
        AHORA,
      ),
    ).toThrow('Algunas butacas ya no están libres')

    const ocupadas = tomadas(bd, viernes, AHORA).map((b) => b.butacaId)
    expect(ocupadas).toEqual([3])
    expect((bd.prepare(`SELECT COUNT(*) AS n FROM compra`).get() as { n: number }).n).toBe(1)
  })

  it('si algo falla después de tomar las butacas, no queda ninguna tomada ni media compra', () => {
    const { bd, viernes, taquillaId } = escenario()
    // Se rompe a propósito el INSERT de las entradas, que ocurre **después** de
    // que las butacas ya fueron tomadas dentro de la misma transacción: es el
    // único modo de observar el «falla en el medio» que promete DISENO.md.
    const prepararReal = bd.prepare.bind(bd)
    vi.spyOn(bd, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO entrada')) {
        return {
          run() {
            throw new Error('Se cayó el disco a mitad de la escritura')
          },
        } as unknown as ReturnType<typeof prepararReal>
      }
      return prepararReal(sql)
    })

    expect(() =>
      venderEnTaquilla(bd, viernes, [{ butacaId: 1, categoria: 'general' }], taquillaId, AHORA),
    ).toThrow('Se cayó el disco a mitad de la escritura')

    vi.restoreAllMocks()
    expect(tomadas(bd, viernes, AHORA)).toEqual([])
    expect((bd.prepare(`SELECT COUNT(*) AS n FROM compra`).get() as { n: number }).n).toBe(0)
    expect((bd.prepare(`SELECT COUNT(*) AS n FROM entrada`).get() as { n: number }).n).toBe(0)
  })
})

describe('Promesa 2 — ningún aviso revierte nada (RNF-5)', () => {
  it('la compra por internet queda registrada y con su número aunque el correo se caiga', () => {
    const { bd, viernes } = escenario()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-anonima', AHORA)

    const compra = pagar(bd, avisosCaidos, bloqueo, CONTACTO, AHORA)

    expect(compra.estado).toBe('pagada')
    expect(compra.numero).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    expect(tomadas(bd, viernes, AHORA)).toEqual([
      expect.objectContaining({ butacaId: 1, motivo: 'venta', referencia: compra.numero }),
    ])
  })

  it('la reserva de estudiante queda hecha aunque el correo se caiga', () => {
    const { bd, viernes } = escenario()

    const reserva = reservar(bd, avisosCaidos, viernes, [2], CONTACTO, AHORA)

    expect(reserva.numero).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    expect(tomadas(bd, viernes, AHORA).map((b) => b.butacaId)).toEqual([2])
  })

  it('la cancelación de una función es firme aunque no salga el aviso a los compradores (RF-24)', () => {
    const { bd, viernes } = escenario()
    const bloqueo = bloquear(bd, viernes, [1], 'sesion-anonima', AHORA)
    const compra = pagar(bd, avisosCaidos, bloqueo, CONTACTO, AHORA)

    const devueltas = cancelarFuncion(bd, avisosCaidos, viernes, 1, 'Se dañó el proyector', '2026-08-14T18:30:00')

    expect(devueltas.map((c) => c.numero)).toEqual([compra.numero])
    expect(devueltas.at(0)?.estado).toBe('devuelta')
    expect(tomadas(bd, viernes, AHORA)).toEqual([])
  })
})

describe('Promesa 3 — ningún mensaje dice «error inesperado»', () => {
  const RAIZ_SERVIDOR = fileURLToPath(new URL('../', import.meta.url))
  const RAIZ_CLIENTE = fileURLToPath(new URL('../../entrada-cliente/src/', import.meta.url))
  const PROHIBIDAS = [
    'error inesperado',
    'algo salió mal',
    'algo salio mal',
    'error interno',
    'unexpected error',
    'something went wrong',
    'internal server error',
  ]

  function archivosDeCodigo(raiz: string): string[] {
    const encontrados: string[] = []
    for (const entrada of readdirSync(raiz)) {
      const ruta = join(raiz, entrada)
      if (statSync(ruta).isDirectory()) {
        if (entrada === 'node_modules') continue
        encontrados.push(...archivosDeCodigo(ruta))
        continue
      }
      // Las pruebas nombran las frases prohibidas justamente para buscarlas.
      if (/\.prueba\.tsx?$/.test(entrada)) continue
      if (/\.tsx?$/.test(entrada)) encontrados.push(ruta)
    }
    return encontrados
  }

  /**
   * Los comentarios citan la promesa —«nunca error inesperado, DISENO.md»— así
   * que se descartan: lo que se busca son mensajes que el sistema pueda llegar
   * a mostrar, no las notas que explican por qué no existen.
   */
  function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  it('el barrido sí ve un mensaje real y solo descarta el comentario que lo cita', () => {
    // Sin esta comprobación, un barrido que borrara de más pasaría siempre en verde.
    expect(sinComentarios(`const m = 'error inesperado' // nota`)).toContain('error inesperado')
    expect(sinComentarios(`/** nunca «error inesperado» */ const m = 'La butaca F7 ya no está libre'`)).not.toContain(
      'error inesperado',
    )
  })

  it('ningún mensaje de cara al operador o al comprador usa una frase genérica', () => {
    const archivos = [...archivosDeCodigo(RAIZ_SERVIDOR), ...archivosDeCodigo(RAIZ_CLIENTE)]
    expect(archivos.length).toBeGreaterThan(20)

    const hallazgos = archivos.flatMap((ruta) => {
      const texto = sinComentarios(readFileSync(ruta, 'utf8')).toLowerCase()
      return PROHIBIDAS.filter((frase) => texto.includes(frase)).map((frase) => `${ruta}: «${frase}»`)
    })

    expect(hallazgos).toEqual([])
  })

  it('un rechazo sin clase propia igual llega con el mensaje del dominio, no con uno genérico', async () => {
    const { bd, viernes } = escenario()
    const app = crearApp({ bd, secretoCookies: 'secreto-de-prueba-1234567890' })
    // Con el reloj real, la función del 14/08/2026 ya empezó: el rechazo es un
    // `Error` simple de Cartelera, sin clase propia (límite documentado en errores.ts).
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/funciones/${viernes}/bloqueo`,
      payload: { butacaIds: [1] },
    })

    expect(respuesta.statusCode).toBe(400)
    expect((respuesta.json() as { mensaje: string }).mensaje).toBe('La función no está en venta')
  })
})
