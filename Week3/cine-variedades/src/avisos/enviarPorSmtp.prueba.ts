import { describe, expect, it, vi } from 'vitest'
import { crearEnviarPorSmtp } from './enviarPorSmtp.js'

describe('avisos: adaptador SMTP (T14, proveedor elegido por el usuario)', () => {
  it('traduce un envío exitoso al contrato de un solo método, sin tocar la red directamente', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '1' })
    const enviar = crearEnviarPorSmtp({ sendMail }, 'cine@variedades.test')

    const resultado = await enviar('ana@correo.com', 'Asunto', 'Cuerpo', null)

    expect(resultado).toBe(true)
    expect(sendMail).toHaveBeenCalledWith({
      from: 'cine@variedades.test',
      to: 'ana@correo.com',
      subject: 'Asunto',
      text: 'Cuerpo',
      attachments: undefined,
    })
  })

  it('un adjunto se manda como archivo adjunto', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '1' })
    const enviar = crearEnviarPorSmtp({ sendMail }, 'cine@variedades.test')

    await enviar('distribuidor@correo.com', 'Reporte', 'Ver adjunto', 'col1,col2\n1,2')

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: 'reporte.csv', content: 'col1,col2\n1,2' }],
      }),
    )
  })

  it('si el proveedor falla, el adaptador lo transforma en un simple false, no en una excepción', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('conexión rechazada'))
    const enviar = crearEnviarPorSmtp({ sendMail }, 'cine@variedades.test')

    await expect(enviar('ana@correo.com', 'Asunto', 'Cuerpo', null)).resolves.toBe(false)
  })
})
