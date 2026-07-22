// Reglas de negocio (ver README.md):
// - Descuento del 10% por mayoreo cuando un mismo producto se compra en
//   gran cantidad (más de 10 unidades de esa línea).
// - IVA del 13% calculado sobre el subtotal ya con el descuento aplicado.
const UMBRAL_MAYOREO = 10;
const TASA_DESCUENTO_MAYOREO = 0.10;
const TASA_IVA = 0.13;

function calcularTotal(carrito) {
  let subtotal = 0;
  let descuento = 0;
  for (const item of carrito) {
    const importeLinea = item.precio * item.cantidad;
    subtotal += importeLinea;

    // El mayoreo aplica por producto: se evalúa la cantidad de cada línea.
    if (item.cantidad > UMBRAL_MAYOREO) {
      descuento += importeLinea * TASA_DESCUENTO_MAYOREO;
    }
  }

  const baseImponible = subtotal - descuento;
  const iva = baseImponible * TASA_IVA;
  const total = baseImponible + iva;
  return { subtotal, descuento, iva, total };
}

module.exports = { calcularTotal };
