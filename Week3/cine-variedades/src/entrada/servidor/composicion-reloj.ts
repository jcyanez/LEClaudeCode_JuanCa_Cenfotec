import { procesarPendientes, type EnviarCorreo } from '../../avisos/avisos.js'
import { crearEnviarPorSmtp, crearTransportadorSmtp } from '../../avisos/enviarPorSmtp.js'
import type { Bd } from '../../base/bd.js'
import type { DependenciasReloj } from '../../reloj/reloj.js'
import { correoDelDistribuidor, enviarReporte } from '../../salidas/salidas.js'
import { barrerVencidos } from '../../venta/venta.js'

/** Cómo se le cuenta a quien opera el cine lo que pasó en un tick (nunca «error inesperado», DISENO.md). */
export type Avisar = (mensaje: string) => void

/**
 * Ata el Reloj (T17) a sus dependencias reales. El Reloj no sabe qué hay
 * dentro de cada función y no contiene ninguna regla (DISENO.md): quien
 * compone es esta capa, que le pasa el barrido de Venta, el procesamiento de
 * la cola de Avisos y el reporte de Salidas ya conectados a la base y al
 * proveedor de correo.
 *
 * Cada trabajo atrapa sus propios fallos y avisa en vez de dejar una promesa
 * rechazada suelta: `iniciarReloj` los dispara sin esperarlos, y un fallo sin
 * atrapar tumbaría el proceso entero —el cine dejaría de vender por culpa del
 * barrido, exactamente al revés de la decisión 4 de DISENO.md.
 */
export function crearDependenciasReloj(bd: Bd, enviar: EnviarCorreo, avisar: Avisar): DependenciasReloj {
  return {
    barrerVencidos(ahora) {
      try {
        return barrerVencidos(bd, ahora)
      } catch (error) {
        avisar(`El barrido de vencidos no pudo correr: ${(error as Error).message}`)
        return { reservas: 0, ocupaciones: 0 }
      }
    },

    async procesarAvisos(ahora) {
      try {
        return await procesarPendientes(bd, ahora, enviar)
      } catch (error) {
        avisar(`La cola de avisos no pudo procesarse: ${(error as Error).message}`)
        return { enviados: 0, reintentados: 0, fallidos: 0 }
      }
    },

    async reporteDelMes(mes, ahora) {
      const destinatario = correoDelDistribuidor(bd)
      if (destinatario === undefined) {
        // RF-29: la dirección la mantiene la dueña. Sin dirección no hubo
        // intento de envío, así que tampoco se inventa una fila en
        // `envio_reporte` (REG-7 registra envíos reales, no ausencias).
        avisar(`No hay correo del distribuidor configurado: el reporte de ${mes} no se envió (RF-29)`)
        return { mes, destinatario: '', instante: ahora, resultado: 'fallido' }
      }
      try {
        return await enviarReporte(bd, enviar, mes, destinatario, ahora)
      } catch (error) {
        avisar(`El reporte de ${mes} no pudo enviarse: ${(error as Error).message}`)
        return { mes, destinatario, instante: ahora, resultado: 'fallido' }
      }
    },
  }
}

/**
 * El envío real de correo según el entorno: SMTP genérico vía Nodemailer
 * (proveedor elegido por el usuario en T14), con las credenciales siempre en
 * variables de entorno y nunca en el repositorio (`CLAUDE.md` §6).
 *
 * Sin `SMTP_HOST` no hay proveedor, y en vez de fingir un envío responde que
 * no salió: el aviso se queda en la cola, se reintenta y termina marcado como
 * fallido y visible a las 24 horas (RN-48). Es la respuesta honesta y la que
 * deja rastro.
 */
export function crearEnviarDesdeEntorno(entorno: Record<string, string | undefined>, avisar: Avisar): EnviarCorreo {
  const host = entorno.SMTP_HOST?.trim()
  if (host === undefined || host === '') {
    avisar('Sin SMTP configurado (SMTP_HOST): los avisos quedan pendientes en la cola')
    return async () => false
  }
  const remitente = entorno.SMTP_REMITENTE?.trim() ?? 'cine-variedades@localhost'
  const puerto = Number(entorno.SMTP_PUERTO ?? 587)
  return crearEnviarPorSmtp(
    crearTransportadorSmtp({
      host,
      port: puerto,
      secure: entorno.SMTP_SEGURO === 'true' || puerto === 465,
      usuario: entorno.SMTP_USUARIO ?? '',
      clave: entorno.SMTP_CLAVE ?? '',
      remitente,
    }),
    remitente,
  )
}
