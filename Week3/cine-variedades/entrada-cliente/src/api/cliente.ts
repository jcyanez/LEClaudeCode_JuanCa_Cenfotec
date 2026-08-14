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

// ————— Operadores (T20, T21): identificación por PIN antes de operar (RF-32) —————

export type Puesto = 'dueña' | 'taquilla' | 'puerta'

export interface Operador {
  id: number
  nombre: string
  puesto: Puesto
}

export function identificarse(pin: string): Promise<Operador> {
  return pedir('/api/operadores/sesion', { method: 'POST', body: JSON.stringify({ pin }) })
}

export async function cerrarSesion(): Promise<void> {
  await fetch('/api/operadores/sesion', { method: 'DELETE', credentials: 'include' })
}

// ————— Taquilla (T20) —————

/** El mapa de taquilla muestra los cuatro estados de RN-17 (RN-57, CA-9). */
export type EstadoButacaTaquilla = 'libre' | 'bloqueada' | 'reservada' | 'vendida'

export interface ButacaEnMapaTaquilla {
  butacaId: number
  etiqueta: string
  estado: EstadoButacaTaquilla
  /** Número de la reserva o de la compra; nunca la sesión anónima de un bloqueo (RN-55). */
  numero: string | null
}

export interface MapaDeTaquilla {
  funcion: MapaDeFuncion['funcion']
  precios: PreciosFuncion
  enVenta: boolean
  mapa: ButacaEnMapaTaquilla[]
}

export type CategoriaPrecio = 'general' | 'estudiante' | 'miercoles'

export interface ButacaElegida {
  butacaId: number
  categoria: CategoriaPrecio
}

export interface EntradaDeCompra {
  butacaId: number
  categoria: CategoriaPrecio
  monto: number
  usadaInstante: string | null
  usadaOperadorId: number | null
}

export interface CompraCompleta {
  numero: string
  canal: 'taquilla' | 'internet'
  instante: string
  jornada: string
  funcionId: number
  estado: 'pagada' | 'anulada' | 'devuelta'
  montoTotal: number
  operadorId: number | null
  entradas: EntradaDeCompra[]
}

export interface ReservaEnTaquilla {
  numero: string
  funcionId: number
  butacaIds: number[]
  vence: string
  contacto: Contacto
}

export interface CierreDeCaja {
  jornada: string
  ventanilla: { cobrado: number; devuelto: number; efectivoEsperado: number }
  internet: { vendido: number }
}

export function obtenerFuncionesDeTaquilla(): Promise<FuncionEnCartelera[]> {
  return pedir('/api/taquilla/funciones')
}

export function obtenerMapaDeTaquilla(funcionId: number): Promise<MapaDeTaquilla> {
  return pedir(`/api/taquilla/funciones/${funcionId}/mapa`)
}

export function venderEnTaquilla(funcionId: number, butacas: ButacaElegida[]): Promise<CompraCompleta> {
  return pedir(`/api/taquilla/funciones/${funcionId}/venta`, {
    method: 'POST',
    body: JSON.stringify({ butacas }),
  })
}

export function buscarReserva(numero: string): Promise<ReservaEnTaquilla> {
  return pedir(`/api/taquilla/reservas/${numero}`)
}

export function convertirReserva(numero: string, conCarne: boolean): Promise<CompraCompleta> {
  return pedir(`/api/taquilla/reservas/${numero}/conversion`, {
    method: 'POST',
    body: JSON.stringify({ conCarne }),
  })
}

export async function liberarReserva(numero: string): Promise<void> {
  const respuesta = await fetch(`/api/taquilla/reservas/${numero}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!respuesta.ok) {
    throw { status: respuesta.status, mensaje: 'No pudimos liberar la reserva' } as ErrorDeApi
  }
}

export function buscarCompraEnTaquilla(numero: string): Promise<CompraCompleta> {
  return pedir(`/api/taquilla/compras/${numero}`)
}

export function anularCompra(numero: string, motivo: string): Promise<CompraCompleta> {
  return pedir(`/api/taquilla/compras/${numero}/anulacion`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}

export function marcarDevolucionEntregada(numero: string): Promise<CompraCompleta> {
  return pedir(`/api/taquilla/compras/${numero}/devolucion-entregada`, { method: 'POST' })
}

export function obtenerCierreDeCaja(jornada?: string): Promise<CierreDeCaja> {
  return pedir(`/api/taquilla/cierre-caja${jornada === undefined ? '' : `?jornada=${jornada}`}`)
}

// ————— Puerta (T21) —————

export interface FuncionDeJornada extends FuncionEnCartelera {
  salaId: number
  filas: number
  butacasPorFila: number
  cancelada: boolean
}

export function obtenerFuncionesDeLaJornada(jornada?: string): Promise<FuncionDeJornada[]> {
  return pedir(`/api/puerta/funciones${jornada === undefined ? '' : `?jornada=${jornada}`}`)
}

export function validarEnPuerta(funcionId: number, numero: string): Promise<CompraCompleta> {
  return pedir(`/api/puerta/funciones/${funcionId}/validacion`, {
    method: 'POST',
    body: JSON.stringify({ numero }),
  })
}

export function buscarComprasPorContacto(contacto: string): Promise<CompraCompleta[]> {
  return pedir(`/api/puerta/compras?contacto=${encodeURIComponent(contacto)}`)
}

// ————— Administración: pantallas de la dueña (T21) —————

export interface Pelicula {
  id: number
  titulo: string
  duracionMinutos: number
}

export interface SemanaCargada {
  semanaId: number
  juevesInicio: string
  abiertaAVenta: boolean
  funciones: number
}

export interface FuncionAdministrable extends FuncionDeJornada {}

export interface PreciosVigentes {
  general: number
  estudiante: number
  desde: string
}

export interface DetalleFuncionReporte {
  funcionId: number
  pelicula: string
  sala: string
  fecha: string
  horaInicio: string
  cancelada: boolean
  entradasVendidas: number
  montoVendido: number
}

export interface RegistroEnvioReporte {
  mes: string
  destinatario: string
  instante: string
  resultado: 'enviado' | 'fallido'
}

export interface ReporteDelMes {
  mes: string
  detalle: DetalleFuncionReporte[]
  envios: RegistroEnvioReporte[]
  destinatario: string | null
}

export interface OcupacionDeFuncion {
  funcionId: number
  pelicula: string
  fecha: string
  horaInicio: string
  butacas: number
  entradasVendidas: number
  ocupacion: number
}

export interface EntradasPorCategoriaYCanal {
  categoria: string
  canal: string
  entradas: number
  monto: number
}

export function obtenerPeliculas(): Promise<Pelicula[]> {
  return pedir('/api/administracion/peliculas')
}

export function registrarPelicula(titulo: string, duracionMinutos: number): Promise<{ id: number }> {
  return pedir('/api/administracion/peliculas', {
    method: 'POST',
    body: JSON.stringify({ titulo, duracionMinutos }),
  })
}

export function obtenerSemanas(): Promise<SemanaCargada[]> {
  return pedir('/api/administracion/semanas')
}

export function crearSemana(juevesInicio: string): Promise<{ semanaId: number }> {
  return pedir('/api/administracion/semanas', { method: 'POST', body: JSON.stringify({ juevesInicio }) })
}

export function abrirVentaDeSemana(semanaId: number): Promise<{ semanaId: number }> {
  return pedir(`/api/administracion/semanas/${semanaId}/apertura`, { method: 'POST' })
}

export function obtenerFuncionesDeSemana(semanaId: number): Promise<FuncionAdministrable[]> {
  return pedir(`/api/administracion/semanas/${semanaId}/funciones`)
}

export interface DatosFuncion {
  peliculaId: number
  salaId: number
  semanaId: number
  fecha: string
  horaInicio: string
}

export function programarFuncion(datos: DatosFuncion): Promise<{ funcionId: number }> {
  return pedir('/api/administracion/funciones', { method: 'POST', body: JSON.stringify(datos) })
}

export function modificarFuncion(funcionId: number, cambios: Partial<DatosFuncion>): Promise<{ funcionId: number }> {
  return pedir(`/api/administracion/funciones/${funcionId}`, {
    method: 'PATCH',
    body: JSON.stringify(cambios),
  })
}

export async function eliminarFuncion(funcionId: number): Promise<void> {
  const respuesta = await fetch(`/api/administracion/funciones/${funcionId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { mensaje?: string }
    throw { status: respuesta.status, mensaje: cuerpo.mensaje ?? 'No pudimos eliminar la función' } as ErrorDeApi
  }
}

export function cancelarFuncion(funcionId: number, motivo: string): Promise<CompraCompleta[]> {
  return pedir(`/api/administracion/funciones/${funcionId}/cancelacion`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}

export function obtenerPrecios(fecha?: string): Promise<PreciosVigentes> {
  return pedir(`/api/administracion/precios${fecha === undefined ? '' : `?fecha=${fecha}`}`)
}

export function fijarPrecios(general: number, estudiante: number, desde: string): Promise<PreciosVigentes> {
  return pedir('/api/administracion/precios', {
    method: 'POST',
    body: JSON.stringify({ general, estudiante, desde }),
  })
}

export function obtenerCorreoDelDistribuidor(): Promise<{ correo: string | null }> {
  return pedir('/api/administracion/distribuidor')
}

export function fijarCorreoDelDistribuidor(correo: string): Promise<{ correo: string }> {
  return pedir('/api/administracion/distribuidor', { method: 'PUT', body: JSON.stringify({ correo }) })
}

export function obtenerReporte(mes: string): Promise<ReporteDelMes> {
  return pedir(`/api/administracion/reporte/${mes}`)
}

export function enviarReporte(mes: string): Promise<RegistroEnvioReporte> {
  return pedir(`/api/administracion/reporte/${mes}/envio`, { method: 'POST' })
}

export function consultarOcupacion(desde: string, hasta: string): Promise<OcupacionDeFuncion[]> {
  return pedir(`/api/administracion/ocupacion?desde=${desde}&hasta=${hasta}`)
}

export function consultarCategorias(desde: string, hasta: string): Promise<EntradasPorCategoriaYCanal[]> {
  return pedir(`/api/administracion/categorias?desde=${desde}&hasta=${hasta}`)
}
