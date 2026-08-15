# Cine Variedades — sistema de venta de entradas

Prototipo funcional del sistema de venta de entradas de un cine de dos salas: cartelera y compra por
internet con selección de butaca desde el teléfono, taquilla sobre el mismo mapa, y validación en la
puerta.

El encargo original está en [`PROMPT.md`](PROMPT.md); qué debe hacer el sistema, en
[`ESPECIFICACION.md`](ESPECIFICACION.md); qué forma tiene la solución, en [`DISENO.md`](DISENO.md);
el plan por piezas con la evidencia de cada una, en [`PLAN.md`](PLAN.md); el estado al día, en
[`STATUS.md`](STATUS.md), y la verificación final contra los criterios de aceptación, en
[`VERIFICACION.md`](VERIFICACION.md).

## Requisitos

- **Node.js 22 o superior** (se desarrolló con 22.22). No hace falta nada más: la base de datos es
  un archivo y el planificador corre dentro del mismo proceso.

## Poner a correr la aplicación

Son dos paquetes npm: el servidor con el dominio, y el cliente (PWA). Cada uno se instala por
separado.

```bash
# 1. Servidor y dominio
cd cine-variedades
npm install

# 2. Datos de prueba (crea el archivo cine-variedades.db)
npm run semilla

# 3. Servidor: queda escuchando en http://127.0.0.1:3001
npm run servidor
```

En **otra terminal**, el cliente:

```bash
cd cine-variedades/entrada-cliente
npm install
npm run dev          # http://localhost:5173
```

Abrí `http://localhost:5173` y vas a ver la cartelera. Las rutas:

| Ruta | Quién la usa | Cómo se entra |
|---|---|---|
| `/` | Quien compra por internet | Sin identificarse (`RN-55`) |
| `/funciones/:id` | Quien compra por internet | Mapa de butacas, compra y reserva |
| `/taquilla` | Quien atiende la ventanilla | PIN **1234** |
| `/puerta` | Quien recibe en la puerta | PIN **5678** |
| `/administracion` | La dueña | PIN **9999** |

## Recrear los datos de prueba

```bash
cd cine-variedades
npm run semilla
```

Es **idempotente**: correrla dos veces no duplica nada. Crea, si no están:

- Los **tres operadores** con su PIN: dueña `9999`, taquilla `1234`, puerta `5678`.
- Tres **películas** de repertorio: «Ventana indiscreta» (112 min), «El resplandor» (146 min) y
  «Tiempos modernos» (87 min). El **género no se guarda** —`Película` es título y duración
  (`RN-4`)—, así que el tono de cada una vive en el título y nada más: el sistema no filtra ni
  agrupa por género.
- La **semana de cartelera en curso y la siguiente**, ambas abiertas a la venta.
- **Tres funciones diarias en cada sala**, a partir de mañana:

  | | Sala 1 (120 butacas) | Sala 2 (60 butacas) |
  |---|---|---|
  | | 15:00 Tiempos modernos | 15:30 Tiempos modernos |
  | | 17:00 Ventana indiscreta | 17:30 El resplandor |
  | | 19:30 Ventana indiscreta | 20:30 El resplandor |

  Los horarios dejan al menos 20 minutos libres entre el fin de una función y el inicio de la
  siguiente en la misma sala (`RN-6`). No hace falta creerlo: el servidor rechaza la que se pise
  (`RF-3`), así que si la semilla termina sin error, la grilla cumple.
- **Precios**: ₡8 000 general y ₡5 000 estudiante. Los miércoles salen a mitad de precio y sin
  reservas de estudiante (`RN-13`, `RN-14`), así que ese día toda la cartelera se ve a ₡4 000.
- El **correo del distribuidor** para el reporte mensual.

Las fechas se calculan a partir de hoy, nunca fijas: la semana va de jueves a miércoles (`RN-3`) y
solo pueden estar cargadas la en curso y la siguiente (`RN-8`), así que una semilla con fechas
escritas a mano dejaría de servir a los pocos días.

Para **empezar de cero**, borrá el archivo de la base y volvé a sembrar:

```bash
rm cine-variedades.db*      # incluye los archivos -wal y -shm del modo WAL
npm run semilla
```

Las salas y sus 180 butacas no las crea la semilla sino el propio servidor al arrancar: son un dato
fijo del negocio (`RN-1`, `RN-2`), no datos de prueba.

## Variables de entorno

Todas son opcionales; sin ninguna, el sistema funciona.

| Variable | Para qué | Por defecto |
|---|---|---|
| `RUTA_BD` | Archivo de la base de datos | `cine-variedades.db` |
| `SECRETO_COOKIES` | Firma de la cookie de sesión del operador | Uno de desarrollo |
| `PUERTO` | Puerto del servidor | `3001` |
| `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_REMITENTE`, `SMTP_SEGURO` | Envío real de correo | Sin definir: los avisos se encolan y quedan pendientes, y la venta sigue funcionando igual (`RNF-5`) |

Las credenciales **nunca** se commitean.

## Pruebas

```bash
cd cine-variedades
npm test                # 251 pruebas: dominio, rutas HTTP, criterios de aceptación y promesas
npm run typecheck       # TypeScript estricto
npm run carga           # prueba de carga de RNF-1: 200 compradores simultáneos

cd entrada-cliente
npm test                # 28 pruebas de componentes
npm run typecheck
npm run build
```

`npm run carga` levanta el servidor real contra una base temporal y lanza 200 compradores
concurrentes sobre las 120 butacas de la Sala 1 —80 chocan por diseño— para comprobar que ninguna
butaca se vende dos veces (`RNF-4`). Termina con un resumen y sale con código distinto de cero si
alguna comprobación falla.

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
si ese pedido falla se cae a `system-ui`. Servirla desde el propio proyecto (`@fontsource/inter`)
la volvería una dependencia npm más y quitaría el pedido externo; **no está hecho**, y queda
anotado como pendiente.

**Qué se rompe si alguna desaparece.** `better-sqlite3` es la única difícil de sustituir sin tocar
código: la garantía de no doble venta (`RNF-4`) se apoya en una transacción sincrónica y en la
restricción de unicidad `(función, butaca)`, así que cambiar de cliente obliga a revisar cada
operación que toca butacas. `nodemailer` está aislado detrás de una interfaz de un solo método
(`EnviarCorreo`), así que se reemplaza sin que nadie más se entere. La interfaz **no depende de
ninguna librería de componentes**: el sistema visual es propio (`src/componentes/base/` y
`src/estilos/tokens.scss`), derivado de la skill `ui-ux-pro-max`, así que no hay nada que se rompa
si un sistema de diseño de terceros cambia de versión o de rumbo.

## Marca

El original es [`LogoCV.png`](LogoCV.png) — 1536 × 1024, 1,6 MB, arte dorado sobre transparencia.
**Ese archivo no se sirve nunca**: es la fuente de la que salen los derivados que viven en
`cine-variedades/entrada-cliente/public/`.

| Archivo | Dónde se usa | De dónde sale |
|---|---|---|
| `marca-320.webp` · `marca-320.avif` | Encabezado de la cartelera, 1× | Escalado del original |
| `marca-640.webp` · `marca-640.avif` | Lo mismo, en pantallas 2× | Ídem |
| `icono-192.png` · `icono-512.png` | Iconos de la PWA (`purpose: any`) | Escudo recortado y aplanado sobre `#0f0f23` |
| `icono-mascara-512.png` | Icono de la PWA (`purpose: maskable`) | Ídem, con más margen para el recorte circular |
| `icono-32.png` | Pestaña del navegador | Reducción del de 512 |
| `apple-touch-icon.png` | Pantalla de inicio en iOS | Ídem, a 180 px |

Se regeneran con `sharp-cli` por `npx`, **sin agregar ninguna dependencia** al proyecto. Desde
`Week3/`:

```bash
# Lockup: 320 y 640 px, en WebP y AVIF
npx --yes sharp-cli@5 -i LogoCV.png -o <destino> -f webp --quality 62 resize 320

# Escudo para los iconos: recorte, fondo de marca, y margen hasta 512 px
npx --yes sharp-cli@5 -i LogoCV.png -o <destino> -f png \
  extract 0 448 618 618 -- flatten --background "#0f0f23" -- \
  resize 360 360 -- extend 76 76 76 76 --background "#0f0f23"
```

**El logo solo aparece en la web pública**, que usa el tema oscuro. En el tema claro de taquilla y
puerta el dorado sobre blanco no alcanza el 3:1 que la prioridad 1 de `ui-ux-pro-max` exige para un
elemento gráfico, así que ahí la marca sigue siendo texto. Para usarlo también en esas pantallas
haría falta una versión pensada para fondo claro, que hoy no existe.

## Pósteres de la cartelera

Mismo criterio que la marca: los originales viven en [`carteles-originales/`](carteles-originales/)
—tres PNG de 1024 × 1536, **7,15 MB entre los tres**— y **no se sirven nunca**. En
`cine-variedades/entrada-cliente/public/cartelera/` van solo derivados WebP, **53 KB entre los tres
a 1×**.

> Se probó también AVIF y salía **más pesado que WebP** en las tres imágenes. Como el navegador
> elige la primera fuente que entiende, ofrecer AVIF primero habría servido el archivo más grande.
> Se descartó: WebP solo.

### Agregar o reemplazar un póster

El póster y el género **no están en la base de datos**: viven en un mapa por título en el cliente,
[`src/componentes/publico/posters.ts`](cine-variedades/entrada-cliente/src/componentes/publico/posters.ts).
Es una deuda asumida a propósito, y el archivo la explica. Son tres pasos:

1. Poné el original en `carteles-originales/<nombre-en-kebab>.png`, en proporción **2:3**.
2. Generá los dos derivados, desde `Week3/`:

   ```bash
   npx --yes sharp-cli@5 -i carteles-originales/<nombre>.png \
     -o cine-variedades/entrada-cliente/public/cartelera -f webp --quality 62 resize 320
   npx --yes sharp-cli@5 -i carteles-originales/<nombre>.png \
     -o cine-variedades/entrada-cliente/public/cartelera -f webp --quality 62 resize 640
   ```

   Renombrá las salidas a `<nombre>-320.webp` y `<nombre>-640.webp`.
3. Agregá la entrada en `posters.ts`, con el **título exacto** con que la película está cargada en
   la base:

   ```ts
   'Ventana indiscreta': { poster: '/cartelera/ventana-indiscreta', genero: 'Terror · Suspenso' },
   ```

Si el título no coincide, o si el archivo falla al cargar, la tarjeta muestra un respaldo con la
leyenda «Sin póster» y la película se sigue pudiendo comprar. **Nunca aparece el icono roto del
navegador**, y hay una prueba que lo comprueba.

## Estructura

```
Week3/
├── PROMPT.md ESPECIFICACION.md DISENO.md PLAN.md STATUS.md VERIFICACION.md
├── LogoCV.png            Original de la marca; no se sirve, solo se derivan activos
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
    └── entrada-cliente/   PWA en React
        └── public/        Activos de marca: lockup e iconos (ver «Marca»)
```

Las dependencias entre componentes van en una sola dirección: Ocupación no conoce a nadie, y nadie
conoce ni a Entrada ni al Reloj.
