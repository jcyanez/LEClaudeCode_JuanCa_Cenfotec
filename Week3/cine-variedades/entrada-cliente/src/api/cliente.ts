export interface ErrorDeApi {
  status: number
  mensaje: string
  [clave: string]: unknown
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(ruta, {
    ...opciones,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opciones?.headers },
  })
  const cuerpo = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>
  if (!respuesta.ok) {
    const error: ErrorDeApi = {
      status: respuesta.status,
      mensaje: typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : 'Algo no salió bien',
      ...cuerpo,
    }
    throw error
  }
  return cuerpo as T
}

export interface PreciosFuncion {
  general?: number
  estudiante?: number
  miercoles?: number
}

export interface FuncionEnCartelera {
  funcionId: number
  pelicula: string
  sala: string
  fecha: string
  horaInicio: string
  categoriaBase: 'general' | 'miercoles'
  precios: PreciosFuncion
}

export function obtenerCartelera(): Promise<FuncionEnCartelera[]> {
  return pedir('/api/cartelera')
}

export type EstadoButacaPublico = 'libre' | 'no-disponible'

export interface ButacaEnMapa {
  butacaId: number
  etiqueta: string
  estado: EstadoButacaPublico
}

export interface MapaDeFuncion {
  funcion: FuncionEnCartelera & { salaId: number; filas: number; butacasPorFila: number }
  precios: PreciosFuncion
  enVenta: boolean
  mapa: ButacaEnMapa[]
}

export function obtenerMapa(funcionId: number): Promise<MapaDeFuncion> {
  return pedir(`/api/funciones/${funcionId}/mapa`)
}

export interface Bloqueo {
  sesion: string
  funcionId: number
  butacaIds: number[]
  categoria: 'general' | 'estudiante' | 'miercoles'
  vence: string
}

export function bloquearButacas(funcionId: number, butacaIds: number[]): Promise<Bloqueo> {
  return pedir(`/api/funciones/${funcionId}/bloqueo`, {
    method: 'POST',
    body: JSON.stringify({ butacaIds }),
  })
}

export interface Contacto {
  nombre: string
  correo: string
  telefono: string
}

export interface Compra {
  numero: string
  canal: 'taquilla' | 'internet'
  montoTotal: number
}

export function pagar(funcionId: number, contacto: Contacto): Promise<Compra> {
  return pedir(`/api/funciones/${funcionId}/pago`, {
    method: 'POST',
    body: JSON.stringify(contacto),
  })
}

export interface Reserva {
  numero: string
  funcionId: number
  butacaIds: number[]
  vence: string
}

export function reservar(funcionId: number, butacaIds: number[], contacto: Contacto): Promise<Reserva> {
  return pedir(`/api/funciones/${funcionId}/reserva`, {
    method: 'POST',
    body: JSON.stringify({ butacaIds, ...contacto }),
  })
}

export function esErrorDeApi(valor: unknown): valor is ErrorDeApi {
  return typeof valor === 'object' && valor !== null && 'mensaje' in valor && 'status' in valor
}
