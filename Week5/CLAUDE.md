# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Qué es esto

`Week5` es la carpeta del **Caso Práctico 5** del curso SINT-732 (Laboratorio Ejecutivo en Claude
Code, CENFOTEC). El trabajo real ocurre dentro de [cancha-total/](cancha-total/), el sistema de
reservas de **Cancha Total F5** — dos canchas techadas de fútbol 5, Node + Express +
better-sqlite3, vistas renderizadas en el servidor.

El sistema lo construyó un proveedor que ya no contesta y **no dejó un solo documento**. El
encargo del caso no es agregar funciones: es ponerle al código heredado una red de pruebas que
diga qué cumple y qué no, dejar los hallazgos por escrito, y recién entonces refactorizar con la
red puesta.

La consigna completa y la rúbrica están en `Consigna Caso Practico 5 - SINT-732.docx` (es un ZIP:
se lee con `unzip -p ... word/document.xml` y limpieza de etiquetas). Leerla antes de dar la
entrega por cerrada.

## 2. Comandos

Todos se corren **dentro de `cancha-total/`**. Node v22, npm 10.

| Comando | Qué hace |
|---|---|
| `npm install` | Instala `express` y `better-sqlite3`. `node_modules/` no está en el repo. |
| `npm run datos` | Borra `reservas.db` y la recrea con 10 reservas de ejemplo (fechas relativas a hoy). |
| `npm start` | Levanta el servidor en http://localhost:3000 |
| `./verificar.sh` | **Puerta de calidad.** Sale 0 si todo pasa, 2 si algo falla. *(pendiente de crear)* |

Todavía no hay marco de pruebas, ni `verificar.sh`, ni `.claude/settings.json`: los tres son
entregables de este caso. Al elegir el marco, `verificar.sh` debe quedar como **un solo comando**
que también permita correr una prueba suelta desde el marco subyacente.

`reservas.db` está en `.gitignore` y no existe hasta correr `npm run datos`. Ambos scripts crean
la tabla si falta, así que `npm start` sobre una base ausente arranca con cero reservas.

## 3. Arquitectura de `cancha-total`

Tres archivos, sin capas: **el dominio vive dentro de los handlers de Express**.

- [server.js](cancha-total/server.js) — todo: esquema SQLite, helpers de datos, reglas de
  negocio, plantillas HTML y rutas.
- [datos.js](cancha-total/datos.js) — script independiente de siembra; redefine el mismo esquema
  `CREATE TABLE reservas` que `server.js`.
- Una sola tabla `reservas` (`cancha`, `fecha` TEXT ISO, `hora` INTEGER, `cliente`, `telefono`,
  `precio`, `estado` `'activa'|'cancelada'`).

Lo que conviene saber antes de tocar nada:

- **El precio se calcula en tres lugares distintos**, con los literales repetidos: la grilla de
  disponibilidad de `GET /`, el `POST /reservas`, y el endpoint `GET /api/cotizar` que alimenta
  el precio estimado del formulario por `fetch`. No hay función de tarifa compartida.
- **`GET /disponibilidad/cancha1` y `/cancha2` son dos handlers copiados**, idénticos salvo el
  número de cancha.
- **Hay código muerto declarado como tal** al inicio de `server.js`: `esFeriado()`, que nadie
  llama, y un bloque comentado de precios de temporada alta.
- El HTML se arma por interpolación de plantillas dentro de `layout()`; los valores del usuario
  entran sin escapar.
- No hay capa de acceso a datos: `db.prepare(...)` se llama directo desde los handlers, y
  `hoyISO()` lee el reloj del sistema dentro de la lógica de cancelación.

Las tres duplicaciones y el código muerto son **deuda de estructura**: se documentan como
hallazgos y se pagan solo si están en el camino del arreglo de comportamiento que se elija.

## 4. Fuente de verdad y orden de trabajo

**El repositorio no trae especificación.** La palabra de la administradora (en la consigna) es la
especificación; donde ella no dice nada, el comportamiento actual del sistema se considera
correcto. La secuencia es obligatoria y no se saltea:

1. **Instalar la habilidad `escribir-pruebas`** (viene en `escribir-pruebas.zip`; se descomprime
   en `.claude/skills/escribir-pruebas/`). Todavía no está instalada.
2. **Invocar la habilidad** e ir por su **Camino B**: extraer del código el comportamiento
   observable en lenguaje del negocio, preguntar punto por punto qué *debería* pasar, y escribir
   `ESPECIFICACION.md` con **cada afirmación y su fuente declarada** (administradora / sistema
   actual), indicando cuál quedó cuando ambas hablan del mismo punto.
3. Desde ahí, `ESPECIFICACION.md` **es** la fuente de verdad. Este `CLAUDE.md` describe cómo se
   trabaja; la especificación describe qué debe hacer el sistema.
4. Recién entonces: suite → `HALLAZGOS.md` → `verificar.sh` → hook `Stop` → refactorización.

### La regla de hierro

> **La prueba responde a la especificación, nunca al código.**

Nunca derivar un valor esperado de correr la función y ver qué da. Una prueba en rojo sobre este
código es **un hallazgo, no un defecto de la prueba**: no se ablanda la aserción, no se ajusta el
esperado, no se borra. Va a `HALLAZGOS.md` con su clase (comportamiento / estructura) y su prueba
marcada como fallo esperado con el número del hallazgo.

El nivel de cada prueba se **deriva y se declara**: integración por defecto para los recorridos
del negocio, unidad donde hay lógica propia con casos borde (tarifas, descuento de frecuente,
plazo de cancelación, validaciones). Cada prueba declara en una línea qué cambio en el código la
haría fallar. Ninguna depende del reloj, de la red, del orden ni de otra prueba — ojo con
`hoyISO()` y con las fechas relativas de `datos.js`.

## 5. Commits

La consigna evalúa el historial, no solo el resultado:

- Los commits propios van **encima del commit del proveedor** (`65ce4b4`), que no se toca.
- El commit que agrega la suite y `verificar.sh` **precede a todos** los de refactorización.
- **Ningún commit mezcla estructura con comportamiento.** En un commit de estructura, la suite da
  exactamente lo mismo antes y después.
- Al entregar, `verificar.sh` sale 0: los hallazgos abiertos quedan marcados como fallo esperado
  con su número, no corregidos.

`cancha-total/` tiene **su propio `.git` sin remoto**, anidado dentro del repositorio raíz
`LEClaudeCode_JuanCa_Cenfotec`. La entrega exige conservar el commit del proveedor, así que ese
historial no se aplana como en semanas anteriores. **Cómo se publica (repo aparte en GitHub o
submódulo) es una decisión del usuario — preguntarla antes de hacer `push`, no resolverla por
cuenta propia.**

## 6. Restricciones

Claude Code **no debe**:

- Tocar código de producción durante el turno de pruebas — ni para arreglar un defecto, ni para
  hacerlo más fácil de probar. Si algo no se puede probar sin cambiarlo, eso es un hallazgo de
  clase estructura.
- Modificar una prueba para cerrar un hallazgo. El hallazgo se cierra haciendo pasar su prueba
  **sin tocarla**.
- Agregar funciones nuevas, cambiar el stack ni reemplazar SQLite: están fuera de alcance por
  consigna.
- Escribir `ESPECIFICACION.md` con lo que el código hace hoy sin haberlo confirmado punto por
  punto con el usuario.
- Hacer `commit` o `push` sin que el usuario lo pida. Cuando lo pida, «hacer commit» incluye el
  `push` y la confirmación de que quedó sincronizado.
- Borrar `reservas.db` de un entorno que no sea el propio, ni ejecutar comandos destructivos o
  `--force`.

## 7. Al cerrar cada tarea

Entregar siempre un checklist de **qué quedó terminado y qué queda pendiente**, con la evidencia
de lo que se ejecutó (salida de la suite o de `verificar.sh`), y no declarar algo como listo sin
haberlo corrido.
