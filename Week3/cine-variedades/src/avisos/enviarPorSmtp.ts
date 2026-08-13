import nodemailer, { type Transporter } from 'nodemailer'
import type { EnviarCorreo } from './avisos.js'

export interface ConfiguracionSmtp {
  host: string
  port: number
  secure: boolean
  usuario: string
  clave: string
  remitente: string
}

/**
 * El transportador real de Nodemailer (proveedor elegido por el usuario,
 * T14). Las credenciales las lee quien compone el servidor (T18) desde
 * variables de entorno; nunca viven en el repositorio (`CLAUDE.md` §6).
 */
export function crearTransportadorSmtp(configuracion: ConfiguracionSmtp): Transporter {
  return nodemailer.createTransport({
    host: configuracion.host,
    port: configuracion.port,
    secure: configuracion.secure,
    auth: { user: configuracion.usuario, pass: configuracion.clave },
  })
}

/**
 * Adapta un transportador de correo al método único al que Avisos aísla
 * cualquier proveedor (decisión de DISENO.md): cambiar de proveedor no
 * toca a quien encola. Acepta cualquier objeto con `sendMail`, para poder
 * probar este adaptador sin tocar la red.
 */
export function crearEnviarPorSmtp(
  transportador: Pick<Transporter, 'sendMail'>,
  remitente: string,
): EnviarCorreo {
  return async (destinatario, asunto, cuerpo, adjunto) => {
    try {
      await transportador.sendMail({
        from: remitente,
        to: destinatario,
        subject: asunto,
        text: cuerpo,
        attachments: adjunto === null ? undefined : [{ filename: 'reporte.csv', content: adjunto }],
      })
      return true
    } catch {
      return false
    }
  }
}
