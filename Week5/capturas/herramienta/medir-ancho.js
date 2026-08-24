// ¿Alguna pantalla desborda a lo ancho en un teléfono? Y si desborda, ¿quién
// tiene la culpa?
//
// Vive acá por la misma razón que capturar.js: es herramienta de referencia,
// no una dependencia del sistema.
//
// Un desborde horizontal no lo caza la suite —no es markup, es distribución— y
// tampoco se ve en una captura de escritorio. La primera vez que se corrió,
// delató un rótulo para lector de pantalla que, por estar posicionado en
// absoluto sin ancestro posicionado, se escapaba del marco con scroll y
// estiraba la lista del día a 636 px dentro de un teléfono de 375.
//
// Uso:  node medir-ancho.js [ancho]

const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ_PRUEBAS = path.join(__dirname, '..', '..', 'cancha-total', 'pruebas', 'soporte', 'servidor.js');
const { levantarSistema, borrarBase, HOY } = require(RAIZ_PRUEBAS);

const ANCHO = Number(process.argv[2]) || 375;

async function main() {
  const sistema = await levantarSistema();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: 812 } });
  let problemas = 0;

  try {
    await sistema.reservar({ cancha: 1, fecha: HOY, hora: 9, cliente: 'Marco Jiménez', telefono: '88112233' });
    await sistema.reservar({ cancha: 2, fecha: HOY, hora: 19, cliente: 'Los Tigres FC', telefono: '86001122' });

    const PANTALLAS = [
      ['inicio', `/?fecha=${HOY}`],
      ['disponibilidad por cancha', `/disponibilidad/cancha1?fecha=${HOY}`],
      ['lista del día', `/dia/${HOY}`],
      ['lista de un día vacío', '/dia/2026-12-25'],
    ];

    console.log(`Midiendo a ${ANCHO} px de ancho\n`);

    for (const [nombre, ruta] of PANTALLAS) {
      await pagina.goto(`${sistema.direccion}${ruta}`, { waitUntil: 'networkidle' });

      const medida = await pagina.evaluate(() => {
        const raiz = document.documentElement;
        const fugados = [];
        // Solo interesa quien se escapa del recorte: lo que desborda dentro de
        // un contenedor con scroll propio está haciendo justamente su trabajo.
        for (const el of document.querySelectorAll('body *')) {
          const caja = el.getBoundingClientRect();
          if (caja.width === 0 || caja.right <= raiz.clientWidth + 1) continue;
          let recortado = false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const desborde = getComputedStyle(p).overflowX;
            if (desborde === 'auto' || desborde === 'scroll' || desborde === 'hidden') { recortado = true; break; }
          }
          if (!recortado) {
            fugados.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''));
          }
        }
        return { scrollWidth: raiz.scrollWidth, clientWidth: raiz.clientWidth, fugados: [...new Set(fugados)].slice(0, 6) };
      });

      const bien = medida.scrollWidth <= medida.clientWidth;
      if (!bien) problemas += 1;
      console.log(`${bien ? 'OK ' : 'MAL'}  ${nombre.padEnd(26)} scrollWidth ${medida.scrollWidth} / viewport ${medida.clientWidth}`);
      for (const f of medida.fugados) console.log(`       se escapa del recorte: ${f}`);
    }

    console.log(`\n${problemas === 0 ? 'Ninguna pantalla scrollea de lado.' : problemas + ' pantalla(s) desbordan.'}`);
  } finally {
    await navegador.close();
    await sistema.apagar();
    borrarBase(sistema.base);
  }

  process.exitCode = problemas === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('Falló la medición:', error.message);
  process.exit(1);
});
