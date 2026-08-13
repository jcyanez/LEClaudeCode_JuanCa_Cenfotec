import cron, { type ScheduledTask } from 'node-cron'

export interface ResultadoBarrido {
  reservas: number
  ocupaciones: number
}

export interface ResultadoAvisos {
  enviados: number
  reintentados: number
  fallidos: number
}

export interface ResultadoEnvioReporte {
  mes: string
  destinatario: string
  instante: string
  resultado: 'enviado' | 'fallido'
}

/**
 * Todo lo que el Reloj necesita llamar, ya atado a su base de datos y a su
 * proveedor de correo por quien compone el servidor (T18). El Reloj no
 * sabe qué hay dentro de cada función: solo llama (DISENO.md).
 */
export interface DependenciasReloj {
  barrerVencidos(ahora: string): ResultadoBarrido
  procesarAvisos(ahora: string): Promise<ResultadoAvisos>
  reporteDelMes(mes: string, ahora: string): Promise<ResultadoEnvioReporte>
}

export interface ResultadoTickPeriodico {
  barrido: ResultadoBarrido
  avisos: ResultadoAvisos
}

/**
 * Cada 10 minutos (RN-19, RN-30, RN-48): le pide a Venta que barra los
 * vencidos —que a su vez le pide a Ocupación que borre sus filas vencidas;
 * el Reloj nunca toca esa tabla directamente (DISENO.md)— y le pide a
 * Avisos que procese los correos pendientes (tercer trabajo, aprobado por
 * el usuario en la sesión de T17: sin este llamado ningún correo se
 * llegaría a enviar nunca). No contiene ninguna regla de negocio: si no
 * corre, la venta sigue funcionando (decisión 4 de DISENO.md).
 */
export async function tickPeriodico(
  ahora: string,
  dependencias: Pick<DependenciasReloj, 'barrerVencidos' | 'procesarAvisos'>,
): Promise<ResultadoTickPeriodico> {
  const barrido = dependencias.barrerVencidos(ahora)
  const avisos = await dependencias.procesarAvisos(ahora)
  return { barrido, avisos }
}

/** El mes que recién terminó, visto desde el día 1 del mes siguiente. */
function mesRecienTerminado(ahora: string): string {
  const año = Number(ahora.slice(0, 4))
  const mes = Number(ahora.slice(5, 7))
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const añoDelMesAnterior = mes === 1 ? año - 1 : año
  return `${añoDelMesAnterior}-${String(mesAnterior).padStart(2, '0')}`
}

/**
 * El día 1 de cada mes, sin intervención de nadie (RN-47): le pide a
 * Salidas el reporte del mes recién terminado y su envío. Los demás días
 * no hace nada. Tampoco decide el destinatario ni arma el reporte —eso es
 * de Salidas—, solo dispara la llamada en el momento que corresponde.
 */
export async function tickMensual(
  ahora: string,
  dependencias: Pick<DependenciasReloj, 'reporteDelMes'>,
): Promise<ResultadoEnvioReporte | null> {
  if (ahora.slice(8, 10) !== '01') return null
  return dependencias.reporteDelMes(mesRecienTerminado(ahora), ahora)
}

function instanteActual(): string {
  return new Date().toISOString().slice(0, 19)
}

/**
 * Arranca el planificador embebido real (node-cron, decisión de T0):
 * el tick periódico cada 10 minutos y el mensual a las 06:00 del día 1.
 * Es la única parte de este componente que mira el reloj de verdad; el
 * resto son funciones puras que reciben `ahora` de quien las llama.
 */
export function iniciarReloj(dependencias: DependenciasReloj): { detener(): void } {
  const tareas: ScheduledTask[] = [
    cron.schedule('*/10 * * * *', () => {
      void tickPeriodico(instanteActual(), dependencias)
    }),
    cron.schedule('0 6 1 * *', () => {
      void tickMensual(instanteActual(), dependencias)
    }),
  ]
  return {
    detener() {
      for (const tarea of tareas) tarea.stop()
    },
  }
}
