// Capturas de pantalla de Cancha Total F5, para comparar antes y después de la
// refactorización.
//
// Vive FUERA del repositorio entregable: Playwright es herramienta de
// referencia, no una dependencia del sistema.
//
// Usa el mismo andamiaje que las pruebas (reloj congelado, base de datos
// propia), así que las capturas son reproducibles: mismos datos, mismas fechas,
// mismo estado, corra el día que corra.
//
// Uso:  node capturar.js antes
//       node capturar.js despues

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const RAIZ_PRUEBAS = path.join(__dirname, '..', '..', 'cancha-total', 'pruebas', 'soporte', 'servidor.js');
const { levantarSistema, borrarBase, HOY } = require(RAIZ_PRUEBAS);

const etiqueta = process.argv[2];
if (!etiqueta || !['antes', 'despues'].includes(etiqueta)) {
  console.error('Uso: node capturar.js antes|despues');
  process.exit(1);
}

const DESTINO = path.join(__dirname, '..', etiqueta);
const TELEFONO = '88112233';

// Reservas del día de hoy, para que las pantallas tengan algo que mostrar.
// El bloque de las 17:00 está a propósito: es donde se ve el hallazgo C-1.
const RESERVAS_DEL_DIA = [
  { cancha: 1, hora: 9, cliente: 'Marco Jiménez', telefono: TELEFONO },
  { cancha: 1, hora: 17, cliente: 'Sofía Araya', telefono: '87654321' },
  { cancha: 2, hora: 19, cliente: 'Los Tigres FC', telefono: '86001122' },
  { cancha: 2, hora: 11, cliente: 'Kevin Mora', telefono: '84223344' },
];

async function main() {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.mkdirSync(DESTINO, { recursive: true });

  const sistema = await levantarSistema();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 2,
  });

  let numero = 0;
  async function capturar(nombre, ruta, opciones = {}) {
    numero += 1;
    const archivo = path.join(DESTINO, `${String(numero).padStart(2, '0')}-${nombre}.png`);
    await pagina.goto(`${sistema.direccion}${ruta}`, { waitUntil: 'networkidle' });
    await pagina.screenshot({ fullPage: true, ...opciones, path: archivo });
    console.log(`  ${path.basename(archivo)}`);
  }

  // Recorte de una fila concreta de la grilla: es donde se lee el hallazgo C-1
  // de un vistazo.
  async function capturarFila(nombre, ruta, hora) {
    numero += 1;
    const archivo = path.join(DESTINO, `${String(numero).padStart(2, '0')}-${nombre}.png`);
    await pagina.goto(`${sistema.direccion}${ruta}`, { waitUntil: 'networkidle' });
    const fila = pagina.locator(`tr:has(td:text-is("${hora}:00"))`).first();
    await fila.screenshot({ path: archivo });
    console.log(`  ${path.basename(archivo)}`);
  }

  try {
    console.log(`Capturando "${etiqueta}" en ${DESTINO}`);

    // --- Estado inicial, sin datos ---------------------------------------
    await capturar('inicio-sin-reservas', `/?fecha=${HOY}`);

    // --- Con reservas del día --------------------------------------------
    for (const reserva of RESERVAS_DEL_DIA) {
      await sistema.reservar({ ...reserva, fecha: HOY });
    }
    const cancelada = sistema.reservas().find((fila) => fila.hora === 11);

    await capturar('inicio-con-reservas', `/?fecha=${HOY}`);
    await capturarFila('grilla-bloque-16h', `/?fecha=${HOY}`, 16);
    await capturarFila('grilla-bloque-17h', `/?fecha=${HOY}`, 17);
    await capturarFila('grilla-bloque-18h', `/?fecha=${HOY}`, 18);
    await capturar('disponibilidad-cancha1', `/disponibilidad/cancha1?fecha=${HOY}`);

    // --- Lista del día, con una cancelada --------------------------------
    // Se cancela por el camino del negocio: reserva a futuro, que hoy sí deja.
    await sistema.reservar({ cancha: 2, fecha: '2026-09-01', hora: 20, cliente: 'Grupo Escazú', telefono: '87001199' });
    await sistema.cancelar(sistema.ultimaReserva().id);
    await capturar('lista-del-dia', `/dia/${HOY}`);
    await capturar('lista-con-cancelada', '/dia/2026-09-01');
    await capturar('lista-dia-vacio', '/dia/2026-12-25');

    // --- Confirmación con descuento de cliente frecuente -----------------
    for (const dia of ['02', '03', '04']) {
      await sistema.reservar({
        cancha: 1, fecha: `2026-09-${dia}`, hora: 10, cliente: 'Marco Jiménez', telefono: TELEFONO,
      });
    }
    await pagina.goto(`${sistema.direccion}/?fecha=2026-09-05`);
    await pagina.selectOption('select[name="hora"]', '10');
    await pagina.fill('input[name="cliente"]', 'Marco Jiménez');
    await pagina.fill('input[name="telefono"]', TELEFONO);
    await pagina.click('form.reserva button[type="submit"]');
    numero += 1;
    await pagina.screenshot({
      fullPage: true,
      path: path.join(DESTINO, `${String(numero).padStart(2, '0')}-confirmacion-con-descuento.png`),
    });
    console.log(`  ${String(numero).padStart(2, '0')}-confirmacion-con-descuento.png`);

    // --- Error: bloque ya vendido ----------------------------------------
    await pagina.goto(`${sistema.direccion}/?fecha=${HOY}`);
    await pagina.selectOption('select[name="hora"]', '9');
    await pagina.fill('input[name="cliente"]', 'Otro cliente');
    await pagina.fill('input[name="telefono"]', '60112233');
    await pagina.click('form.reserva button[type="submit"]');
    numero += 1;
    await pagina.screenshot({
      fullPage: true,
      path: path.join(DESTINO, `${String(numero).padStart(2, '0')}-error-bloque-ocupado.png`),
    });
    console.log(`  ${String(numero).padStart(2, '0')}-error-bloque-ocupado.png`);

    // --- Teléfono vacío: hoy pasa (hallazgo C-2) -------------------------
    await pagina.goto(`${sistema.direccion}/?fecha=2026-09-20`);
    await pagina.selectOption('select[name="hora"]', '12');
    await pagina.fill('input[name="cliente"]', 'Cliente sin teléfono');
    await pagina.click('form.reserva button[type="submit"]');
    numero += 1;
    await pagina.screenshot({
      fullPage: true,
      path: path.join(DESTINO, `${String(numero).padStart(2, '0')}-telefono-vacio.png`),
    });
    console.log(`  ${String(numero).padStart(2, '0')}-telefono-vacio.png`);

    // --- Errores de validación -------------------------------------------
    await pagina.goto(`${sistema.direccion}/?fecha=2026-09-21`);
    await pagina.click('form.reserva button[type="submit"]');
    numero += 1;
    await pagina.screenshot({
      fullPage: true,
      path: path.join(DESTINO, `${String(numero).padStart(2, '0')}-errores-de-validacion.png`),
    });
    console.log(`  ${String(numero).padStart(2, '0')}-errores-de-validacion.png`);

    console.log(`\nListo: ${numero} capturas en capturas/${etiqueta}/`);
    if (cancelada) console.log('(reserva de referencia cancelada:', cancelada.id, ')');
  } finally {
    await navegador.close();
    await sistema.apagar();
    borrarBase(sistema.base);
  }
}

main().catch((error) => {
  console.error('Falló la captura:', error.message);
  process.exit(1);
});
