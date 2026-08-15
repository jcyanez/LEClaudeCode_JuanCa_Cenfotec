/**
 * El sistema de componentes propio del Cine Variedades: lo que reemplazó a
 * `@carbon/react`. Todo se pinta con los tokens de `tokens.scss`, así que la
 * misma pieza sirve en el tema del comprador y en el de operación.
 *
 * Sigue siendo deliberadamente pequeño: son los controles que estas pantallas
 * usan de verdad, no una librería de propósito general.
 */
export { AreaDeTexto, Boton, CampoDeFecha, CampoDeTexto, CampoNumerico, Selector } from './controles.js'
export { Aviso, Cargando, Etiqueta, Modal, Tarjeta, TarjetaEnlace } from './superficie.js'
export { Pestanas, type Pestana } from './pestanas.js'
