const assert = require('node:assert');
const { calcularTotal } = require('../src/carrito');

// Caso 1: compra pequeña, sin descuento por mayoreo
{
  const carrito = [
    { nombre: 'Martillo', precio: 5000, cantidad: 2 },
    { nombre: 'Clavos (caja)', precio: 1500, cantidad: 3 },
  ];
  const resultado = calcularTotal(carrito);
  assert.strictEqual(resultado.subtotal, 14500, 'Subtotal caso 1 incorrecto');
  assert.strictEqual(resultado.descuento, 0, 'No debería aplicar descuento en caso 1');
  console.log('Caso 1 OK: compra pequeña sin descuento');
}

// Caso 2: compra al por mayor de UN solo producto (>10 unidades) debe llevar 10% de descuento
{
  const carrito = [
    { nombre: 'Tornillo 1/2"', precio: 100, cantidad: 15 },
  ];
  const resultado = calcularTotal(carrito);
  assert.strictEqual(resultado.subtotal, 1500, 'Subtotal caso 2 incorrecto');
  assert.strictEqual(resultado.descuento, 150, 'Debería aplicar 10% de descuento por compra al por mayor de un producto');
  console.log('Caso 2 OK: descuento por mayoreo en un solo producto');
}

// Caso 3 (NUEVO REQUERIMIENTO, aún no implementado): el total debe incluir IVA (13%)
// calculado sobre el subtotal ya con descuento aplicado.
{
  const carrito = [
    { nombre: 'Martillo', precio: 5000, cantidad: 2 },
  ];
  const resultado = calcularTotal(carrito);
  assert.strictEqual(resultado.iva, 1300, 'Debe calcular IVA (13%) sobre el subtotal con descuento');
  assert.strictEqual(resultado.total, 11300, 'El total debe incluir el IVA');
  console.log('Caso 3 OK: cálculo de IVA (nuevo requerimiento)');
}

console.log('\nTodas las pruebas pasaron.');
