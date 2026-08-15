# Cine Variedades — sistema de venta de entradas

Prototipo funcional del sistema de venta de entradas de un cine de dos salas: cartelera y compra por
internet con selección de butaca desde el teléfono, taquilla sobre el mismo mapa de butacas, y
validación en la puerta.

**Caso práctico 4 · SINT-732 · Juan Carlos Yáñez.** Continúa el Caso práctico 3, en el mismo
repositorio.

---

## Arranque en cuatro comandos

Hace falta **Node.js 22 o superior** y nada más. La base de datos es un archivo; el planificador
corre dentro del mismo proceso. No hay Docker, ni servidor de base de datos, ni variables de entorno
obligatorias.

```bash
git clone https://github.com/jcyanez/LEClaudeCode_JuanCa_Cenfotec.git
cd LEClaudeCode_JuanCa_Cenfotec/Week3/cine-variedades

npm install                            # servidor y dominio
npm install --prefix entrada-cliente   # cliente PWA

npm run semilla                        # crea cine-variedades.db con datos de prueba
npm run dev                            # levanta servidor y cliente juntos
```

Abrí **<http://localhost:5173>**. `Ctrl+C` baja los dos.

> `npm run dev` arranca los dos paquetes y mezcla su salida con un prefijo de color. Si preferís
> terminales separadas: `npm run servidor` acá y `npm run dev` dentro de `entrada-cliente`.

### Las cinco pantallas

| Ruta | Quién la usa | Cómo se entra |
|---|---|---|
| `/` | Quien compra por internet | Sin identificarse (`RN-55`) |
| `/funciones/:id` | Quien compra por internet | Mapa de butacas, compra y reserva |
| `/taquilla` | Quien atiende la ventanilla | PIN **1234** |
| `/puerta` | Quien recibe en la puerta | PIN **5678** |
| `/administracion` | La dueña | PIN **9999** |

### Un recorrido de cinco minutos

1. En `/`, tocá el cartel de una película → aparecen sus horarios → elegí uno.
2. Elegí dos butacas, completá el contacto y pagá. **Anotá el número de compra.**
3. Entrá a `/puerta` con el PIN `5678`, dictá ese número y validá las entradas. Probá validarlo dos
   veces: la segunda dice a qué hora se usaron y qué operador las validó.
4. Entrá a `/taquilla` con `1234` y probá vender una butaca que ya compraste: no se puede.
5. En `/administracion` con `9999`, cancelá esa función. Todas sus compras quedan devueltas de una
   sola vez.

---

## Guía de evaluación

Dónde está cada cosa que pide la consigna, y qué la demuestra.

| Lo que pide la consigna | Dónde está | Cómo se comprueba |
|---|---|---|
| `PLAN.md` con las piezas y su comprobación **definida antes** de construir | [`PLAN.md`](PLAN.md) | 23 tareas (T0–T22), cada una con su comprobación y su evidencia fechada |
| **Al menos tres piezas cerradas** con evidencia anotada | [`PLAN.md`](PLAN.md) | **Las 23 están cerradas**, cada una con el comando que la cerró y su resultado |
| El commit de `PLAN.md` **precede** a los de construcción | Historial | `git log --oneline --diff-filter=A -- Week3/PLAN.md` → `62ca13b`, anterior a todos los de `T1` a `T22` |
| Base de datos con **motor real**, no un JSON | SQLite en modo WAL | `cine-variedades/src/base/` — migraciones versionadas y unicidad en el motor |
| Piezas como **recorridos completos**, de la vista al dato guardado | Fases 1 a 6 de `PLAN.md` | Cada tarea nombra una comprobación observable, no «la capa de datos» |
| Documentos **al día** con lo que reveló la construcción | [`ESPECIFICACION.md`](ESPECIFICACION.md) · [`DISENO.md`](DISENO.md) | `RN-56`/`RN-57`, `CA-7` a `CA-10`, y las decisiones de póster, agrupado y despliegue de horarios |
| `README.md` con arranque, datos de prueba y dependencias con su repositorio | Este archivo | Secciones de abajo |
| Tecnologías **las que el diseño eligió** | [`DISENO.md`](DISENO.md), «Otras decisiones» | Cada cambio de tecnología queda registrado con su razón y su fecha |

### Comprobar sin leer una línea de código

```bash
cd cine-variedades
npm test           # 251 pruebas: dominio, rutas HTTP, criterios de aceptación y promesas
npm run typecheck  # TypeScript estricto, sin errores
npm run carga      # RNF-1: 200 compradores simultáneos sobre las mismas butacas

npm test --prefix entrada-cliente        # 29 pruebas de componentes, por rol accesible
npm run typecheck --prefix entrada-cliente
npm run build --prefix entrada-cliente
```

`npm run carga` levanta el servidor real contra una base temporal y lanza **200 compradores
concurrentes sobre las 120 butacas de la Sala 1** —80 chocan por diseño— para comprobar que ninguna
butaca se vende dos veces (`RNF-4`). Sale con código distinto de cero si alguna comprobación falla.

La verificación final contra los diez criterios de aceptación está en
[`VERIFICACION.md`](VERIFICACION.md), y el estado al día en [`STATUS.md`](STATUS.md).

### Los documentos, en orden de lectura

1. [`PROMPT.md`](PROMPT.md) — el encargo original. Primer commit del repositorio, nunca modificado.
2. [`ESPECIFICACION.md`](ESPECIFICACION.md) — qué debe hacer el sistema: reglas de negocio,
   requisitos funcionales y no funcionales, y diez criterios de aceptación. **Sin preguntas
   abiertas.**
3. [`DISENO.md`](DISENO.md) — qué forma tiene la solución: ocho componentes con sus límites y lo que
   prometen, el modelo de datos, y cuatro decisiones mayores comparadas lado a lado.
4. [`PLAN.md`](PLAN.md) — el orden de construcción y la evidencia de cada pieza.

---

## Recrear los datos de prueba

```bash
cd cine-variedades
npm run semilla
```

Es **idempotente**: correrla dos veces no duplica nada. Crea, si no están:

- Los **tres operadores** con su PIN: dueña `9999`, taquilla `1234`, puerta `5678`.
- Tres **películas** de repertorio: «Ventanada indiscreta» (112 min), «El resplandor» (146 min) y
  «Tiempos modernos» (87 min). El **género no se guarda** —`Película` es título y duración
  (`RN-4`)—, así que el tono de cada una vive en el título y nada más: el sistema no filtra ni
  agrupa por género.
- La **semana de cartelera en curso y la siguiente**, ambas abiertas a la venta.
- **Tres funciones diarias en cada sala**, a partir de mañana:

  | | Sala 1 (120 butacas) | Sala 2 (60 butacas) |
  |---|---|---|
  | | 15:00 Tiempos modernos | 15:30 Tiempos modernos |
  | | 17:00 Ventanada indiscreta | 17:30 El resplandor |
  | | 19:30 Ventanada indiscreta | 20:30 El resplandor |

  Los horarios dejan al menos 20 minutos libres entre el fin de una función y el inicio de la
  siguiente en la misma sala (`RN-6`). No hace falta creerlo: el servidor rechaza la que se pise
  (`RF-3`), así que si la semilla termina sin error, la grilla cumple.
- **Precios**: ₡8 000 general y ₡5 000 estudiante. Los miércoles salen a mitad de precio y sin
  reservas de estudiante (`RN-13`, `RN-14`), así que ese día toda la cartelera se ve a ₡4 000.
- El **correo del distribuidor** para el reporte mensual.

Las fechas se calculan a partir de hoy, nunca fijas: la semana va de jueves a miércoles (`RN-3`) y
solo pueden estar cargadas la en curso y la siguiente (`RN-8`), así que una semilla con fechas
escritas a mano dejaría de servir a los pocos días.

Para **empezar de cero**:

```bash
rm cine-variedades.db*      # incluye los archivos -wal y -shm del modo WAL
npm run semilla
```

Las salas y sus 180 butacas no las crea la semilla sino el propio servidor al arrancar: son un dato
fijo del negocio (`RN-1`, `RN-2`), no datos de prueba.

---

## Variables de entorno

Todas son opcionales; sin ninguna, el sistema funciona.

| Variable | Para qué | Por defecto |
|---|---|---|
| `RUTA_BD` | Archivo de la base de datos | `cine-variedades.db` |
| `SECRETO_COOKIES` | Firma de la cookie de sesión del operador | Uno de desarrollo |
| `PUERTO` | Puerto del servidor | `3001` |
| `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_REMITENTE`, `SMTP_SEGURO` | Envío real de correo | Sin definir: los avisos se encolan y quedan pendientes, y la venta sigue funcionando igual (`RNF-5`) |

Las credenciales **nunca** se commitean.

---

## Dependencias adoptadas

Todas se eligieron en T0 y están registradas con su razón en [`DISENO.md`](DISENO.md).

### Servidor (`cine-variedades/`)

| Dependencia | Para qué | Repositorio oficial |
|---|---|---|
| `fastify` | Servidor HTTP | https://github.com/fastify/fastify |
| `@fastify/cookie` | Cookies firmadas de sesión | https://github.com/fastify/fastify-cookie |
| `better-sqlite3` | Cliente de SQLite, síncrono y transaccional | https://github.com/WiseLibs/better-sqlite3 |
| `node-cron` | Planificador embebido del Reloj | https://github.com/node-cron/node-cron |
| `nodemailer` | Envío de correo por SMTP | https://github.com/nodemailer/nodemailer |
| `typescript` | Lenguaje | https://github.com/microsoft/TypeScript |
| `vitest` | Pruebas | https://github.com/vitest-dev/vitest |
| `tsx` | Ejecutar TypeScript sin compilar | https://github.com/privatenumber/tsx |
| `@types/node`, `@types/better-sqlite3`, `@types/nodemailer` | Tipos | https://github.com/DefinitelyTyped/DefinitelyTyped |

### Cliente (`cine-variedades/entrada-cliente/`)

| Dependencia | Para qué | Repositorio oficial |
|---|---|---|
| `react`, `react-dom` | Interfaz | https://github.com/facebook/react |
| `react-router-dom` | Rutas de las pantallas | https://github.com/remix-run/react-router |
| `vite` | Servidor de desarrollo y empaquetado | https://github.com/vitejs/vite |
| `@vitejs/plugin-react` | Soporte de React en Vite | https://github.com/vitejs/vite-plugin-react |
| `vite-plugin-pwa` | `manifest` y service worker de la PWA | https://github.com/vite-pwa/vite-plugin-pwa |
| `sass` | Hojas de estilo | https://github.com/sass/dart-sass |
| `vitest`, `jsdom` | Pruebas de componentes | https://github.com/vitest-dev/vitest · https://github.com/jsdom/jsdom |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | Pruebas por rol accesible | https://github.com/testing-library/react-testing-library |
| `typescript`, `@types/react`, `@types/react-dom` | Lenguaje y tipos | https://github.com/microsoft/TypeScript |

### Recursos de terceros en tiempo de ejecución

| Recurso | Para qué | De dónde |
|---|---|---|
| Tipografía **Inter** | La única familia del sistema; la jerarquía la hacen el peso y el interletrado | CDN de Google Fonts, enlazado desde `index.html` |

Es la **única** dependencia de terceros que viaja por red con la aplicación corriendo, y conviene
saberlo por dos razones: en una PWA instalada la tipografía sigue pidiéndose a un dominio ajeno, y
si ese pedido falla se cae a `system-ui`. Servirla desde el propio proyecto (`@fontsource/inter`) la
volvería una dependencia npm más y quitaría el pedido externo; **no está hecho**, y queda anotado
como pendiente.

**Qué se rompe si alguna desaparece.** `better-sqlite3` es la única difícil de sustituir sin tocar
código: la garantía de no doble venta (`RNF-4`) se apoya en una transacción sincrónica y en la
restricción de unicidad `(función, butaca)`, así que cambiar de cliente obliga a revisar cada
operación que toca butacas. `nodemailer` está aislado detrás de una interfaz de un solo método
(`EnviarCorreo`), así que se reemplaza sin que nadie más se entere. La interfaz **no depende de
ninguna librería de componentes**: el sistema visual es propio (`src/componentes/base/` y
`src/estilos/tokens.scss`), derivado de la skill `ui-ux-pro-max`, así que no hay nada que se rompa
si un sistema de diseño de terceros cambia de versión o de rumbo.

### Por qué hay un `.npmrc`

[`cine-variedades/.npmrc`](cine-variedades/.npmrc) trae `ignore-scripts=true`, y hace falta para que
`npm install` funcione en una máquina limpia. `better-sqlite3` incluye los binarios ya compilados de
las ocho plataformas dentro del paquete —`win32-x64` entre ellos— y no declara script de
instalación, pero npm dispara `node-gyp rebuild` por su cuenta al encontrar el `binding.gyp` del
paquete; esa compilación exige Python y las herramientas de Visual Studio, y sin ellas **el
`npm install` completo falla** y no llega a instalar ni `tsx` ni `vitest`. Comprobado sobre un clon
limpio: con esa línea la instalación termina en verde, la semilla corre y pasan las 251 pruebas, sin
Python ni compilador en la máquina. De paso es la recomendación de seguridad habitual de npm frente
a los ataques a la cadena de suministro.

---

## Marca y pósteres

Los originales pesados **no se sirven nunca**: viven fuera de `public/` y de ellos salen derivados
livianos. El logo original es [`LogoCV.png`](LogoCV.png) (1,6 MB) y los carteles están en
[`carteles-originales/`](carteles-originales/) (7,15 MB entre los tres).

| Derivado | Dónde se usa | Peso |
|---|---|---|
| `marca-320/640.webp` · `.avif` | Barra de marca | 28 KB a 1× |
| `icono-192/512.png`, `icono-mascara-512.png` | Iconos de la PWA | — |
| `icono-32.png`, `apple-touch-icon.png` | Pestaña del navegador e iOS | — |
| `cartelera/<pelicula>-320/640.webp` | Carteles de la cartelera | **53 KB entre los tres** a 1× |

Se regeneran con `sharp-cli` por `npx`, **sin agregar ninguna dependencia**. Desde `Week3/`:

```bash
npx --yes sharp-cli@5 -i carteles-originales/<nombre>.png \
  -o cine-variedades/entrada-cliente/public/cartelera -f webp --quality 62 resize 320
```

> Se probó AVIF para los carteles y salía **más pesado que WebP** en los tres. Como el navegador
> toma la primera fuente que entiende, ofrecerlo primero habría servido el archivo grande. Se
> descartó: WebP solo.

**Agregar un póster nuevo.** El póster y el género no están en la base: viven en un mapa por título
en el cliente, [`posters.ts`](cine-variedades/entrada-cliente/src/componentes/publico/posters.ts).
Es deuda asumida a propósito, registrada en `DISENO.md`, y el archivo la explica. Se agrega el
original, se generan los dos derivados y se suma una línea con el **título exacto** con que la
película está cargada en la base. Si el título no coincide, la tarjeta muestra «Sin póster» y la
película se sigue pudiendo comprar: **nunca aparece el icono roto del navegador**, y hay una prueba
que lo comprueba.

---

## Estructura

```
Week3/
├── PROMPT.md ESPECIFICACION.md DISENO.md PLAN.md STATUS.md VERIFICACION.md
├── LogoCV.png              Original de la marca; no se sirve, solo se derivan activos
├── carteles-originales/    Originales de los tres carteles; tampoco se sirven
└── cine-variedades/
    ├── src/
    │   ├── base/          Conexión a SQLite y migraciones
    │   ├── ocupacion/     Qué butacas están tomadas (no conoce a nadie)
    │   ├── cartelera/     Salas, películas, semanas, funciones y precios
    │   ├── venta/         Compras, reservas, validación, anulaciones
    │   ├── salidas/       Cierre de caja, reporte mensual y consultas
    │   ├── avisos/        Cola de correos con reintentos
    │   ├── operadores/    Identificación por PIN y permisos por puesto
    │   ├── reloj/         Tareas programadas
    │   ├── entrada/       Servidor HTTP: rutas de los tres públicos
    │   ├── aceptacion/    Los criterios CA- y las promesas de DISENO.md
    │   ├── semilla/       Datos de prueba
    │   └── carga/         Prueba de carga de RNF-1
    ├── scripts/dev.mjs    Levanta servidor y cliente juntos, sin dependencias
    └── entrada-cliente/   PWA en React
        ├── public/        Activos de marca y carteles derivados
        └── src/componentes/publico/   Cartelera, hero, filtros y tarjetas
```

Las dependencias entre componentes van en una sola dirección: **Ocupación no conoce a nadie, y nadie
conoce ni a Entrada ni al Reloj.** No hay ciclos, así que cada pieza se prueba con la de abajo
simulada.

---

## Si algo falla

| Síntoma | Causa y arreglo |
|---|---|
| `git clone` corta con «Filename too long» en Windows | Límite de 260 caracteres del sistema. Cloná en una ruta corta (`C:\cv`) o activá rutas largas: `git config --global core.longpaths true` |
| `npm install` falla con `gyp ERR!` | Se perdió el [`.npmrc`](cine-variedades/.npmrc), o se instaló forzando `--ignore-scripts=false`. Ver «Por qué hay un `.npmrc`» |
| La cartelera dice «No hay funciones en venta» | Falta correr `npm run semilla` |
| «No pudimos cargar la cartelera» | El servidor no está arriba. `npm run dev` levanta los dos |
| El puerto 3001 o 5173 está ocupado | `PUERTO=3002 npm run servidor`, o cerrá el proceso que lo tiene tomado |
