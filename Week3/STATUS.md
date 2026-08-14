# STATUS — Cine Variedades

> Estado del proyecto en formato checklist. Se actualiza **al cerrar cada tarea** de `PLAN.md`
> (paso obligatorio de la fase de verificación, `CLAUDE.md` §4). El detalle de cada tarea —
> comportamientos, interfaces, referencias — vive en `PLAN.md`.

**Última actualización:** 13 de agosto de 2026 · Sesión 14 — deuda del Reloj, T20 y T21 cerradas
**Tarea en curso:** ninguna. **Queda solo T22.**
**Siguiente tarea:** T22 — Verificación final contra los `CA-` y prueba de carga de 200 usuarios
(`RNF-1`). Es la última del plan: recorrer los diez `CA-`, verificar las tres promesas
transversales de `DISENO.md` y revisar el diff acumulado contra el alcance.

**Pruebas al cerrar la sesión 14:** 226 en `cine-variedades/` (`npm test`) y 13 de componentes en
`cine-variedades/entrada-cliente/` (`npm test`), typecheck limpio en los dos paquetes y `build` del
cliente en verde.

**Sin commitear todavía (13/08):** el trabajo de esta sesión está en el árbol de trabajo pero sin
commit, porque `CLAUDE.md` §6 lo condiciona a un pedido explícito del usuario. Al pedirlo, van
tres commits: la deuda del Reloj, T20 y T21 (y el `push`, según el acuerdo del 12/08).

**Cerrado en esta sesión (13/08), antes de T20 — la deuda del Reloj:** `iniciarReloj` ya está atado
en `principal.ts` a sus dependencias reales, vía `entrada/servidor/composicion-reloj.ts`
(`crearDependenciasReloj` + `crearEnviarDesdeEntorno`). Antes de esto el servidor corría sin barrer
vencidos y sin sacar un solo correo de la cola. Tres decisiones de composición, ninguna es regla de
negocio: (1) cada trabajo del Reloj atrapa su propio fallo y avisa por el log, porque
`iniciarReloj` los dispara sin esperarlos y una promesa rechazada suelta tumbaría el proceso —justo
al revés de la decisión 4 de `DISENO.md`; (2) sin `SMTP_HOST` el envío responde «no salió» en vez
de fingir, así que el aviso espera en la cola, se reintenta y termina fallido y visible (`RN-48`);
(3) sin correo del distribuidor configurado (`RF-29`) el tick mensual avisa y **no** inserta una
fila en `envio_reporte`, porque `REG-7` registra envíos reales, no ausencias. El servidor cierra el
Reloj en `SIGINT`/`SIGTERM` · 7 pruebas

**Decisiones del usuario (12/08, en esta sesión, para T19):** moneda y formato de precio → colón
costarricense sin decimales, separador de miles con espacio (`₡8 000`); etiqueta de la categoría
miércoles → «MIÉRCOLES ½ PRECIO» en mayúsculas, tal como en el mockup del 11/08.

**Decisión del usuario (12/08, en esta sesión):** el Reloj (T17) agrega un tercer trabajo no
listado en `DISENO.md` — llamar cada 10 minutos a `procesarPendientes` de Avisos con el envío real
— porque sin eso ningún correo se enviaría nunca. Pendiente: registrar esto en `DISENO.md` §Reloj
cuando el usuario apruebe esa edición sección por sección (mismo trámite pendiente que las otras
decisiones de esta sesión).

**Nuevo en T20 — pruebas de componentes del cliente:** `entrada-cliente/` ya tiene su propia suite
(`npm test` allí: Vitest + jsdom + testing-library). T19 había quedado sin ellas; se agregaron
ahora porque taquilla mueve efectivo. Se prueban por texto y por rol accesible —nunca por detalles
de implementación—: los cuatro estados del mapa, que una butaca ocupada sea alcanzable con el
teclado, y que la categoría de precio elegida por butaca sea la que se cobra.

**Decisión de accesibilidad de T20 (prioridad 1 de `ui-ux-pro-max`, `color-not-only`):** los
estados del mapa se distinguen por **trazo y relleno**, no solo por color —lleno para vendida,
discontinuo para reservada, punteado y rayado para bloqueada, rayado para no disponible— y cada
butaca nombra su estado en el `aria-label`. Una butaca ocupada de taquilla queda alcanzable con el
teclado (`aria-disabled` en vez de `disabled`) para poder consultar su número, que es justamente
para lo que `RN-57` pide el detalle.

**Interpretación a revisar (T20):** el motivo de una anulación se exige en la capa de entrada
(rechazo 400 si viene vacío), no en `anular` de Venta. `RN-40` pide registrar por qué, y sin motivo
no hay nada que registrar; se siguió el patrón ya usado en T18/T19 para «Hace falta un PIN» y
«Elegí al menos una butaca» en vez de tocar el código de T12. Si se prefiere que la regla viva en
el dominio, es un cambio de una línea en `venta.ts` con su prueba.

**Nota sobre `ui-ux-pro-max` en T18:** el script `search.py` de la skill no pudo correr en este
entorno (no hay Python instalado, solo el stub de Microsoft Store). Los tokens de T18 se basaron en
el sistema real de Carbon (`@carbon/react`, ya decidido en T0, no solo inspiración) y en el
checklist estático de accesibilidad/objetivos táctiles de la skill (`references/quick-reference.md`),
no en una búsqueda de paletas. A revisar en T19 si se consigue un intérprete de Python.

**Decisión del usuario (12/08, en esta sesión):** proveedor de correo saliente para Avisos (T14) →
**SMTP genérico vía Nodemailer**, credenciales por variables de entorno (nunca commiteadas).
Pendiente: registrar esta decisión en `DISENO.md` §Decisiones dejadas abiertas cuando el usuario
apruebe esa edición sección por sección (mismo trámite pendiente que las decisiones de UI del
11/08, `CLAUDE.md` §8).

**Al retomar:**
- Abrir con `CLAUDE.md` + `PLAN.md` + este archivo; el detalle de T13–T16 está en `PLAN.md`.
- Hasta T12 asentado en git (commit conjunto T11+T12, ver nota de commits más abajo). Acuerdo del
  usuario (12/08): cuando pida commits, el `push` va incluido; para este lote (T11–T16) el usuario
  autorizó explícitamente saltar la propuesta previa por tarea (Fase 2 de `CLAUDE.md`) y pidió
  mantener un commit por tarea con push al cerrar T16.
- T11 (`validar`, `buscarCompraPorContacto`) y T12 (`anular`, `cancelarFuncion`, `marcarDevolucionEntregada`)
  agregados a `venta/venta.ts`. `cancelarFuncion` de Venta llama internamente a `cancelarFuncion` de
  Cartelera (aliasado como `marcarFuncionCancelada`) para no tocar la tabla `funcion` directamente.
- **Gap de esquema encontrado y resuelto en T12** (mismo patrón que la migración `002` en T8):
  `reversa_operador_id/instante/jornada/motivo` de `compra` alcanzan para REG-4 (anulación o
  cancelación), pero REG-5 pide registrar aparte quién entregó la devolución en efectivo, cuándo y
  en qué jornada — un evento que puede ocurrir un día distinto (RF-25, RN-44). Se agregó la
  migración `003-devolucion-entregada` con columnas propias (`entrega_operador_id`,
  `entrega_instante`, `entrega_jornada`) sin tocar `reversa_*`.
- **Resuelto en T19:** `entrada/servidor/principal.ts` es el primer punto de entrada real
  (`app.listen`), con `bd` de archivo (`RUTA_BD`) y secreto de cookies por variable de entorno
  (`SECRETO_COOKIES`). Corre con `npm run servidor` (`tsx watch`, agregado a `cine-variedades/`).
- **Resuelto en la sesión 14 (13/08):** `iniciarReloj` ya corre con el servidor (ver arriba). Queda
  como dato de operación: las credenciales SMTP se pasan por entorno (`SMTP_HOST`, `SMTP_PUERTO`,
  `SMTP_USUARIO`, `SMTP_CLAVE`, `SMTP_REMITENTE`, `SMTP_SEGURO`) y nunca se commitean
  (`CLAUDE.md` §6). Sin ellas el sistema funciona igual; solo no sale ningún correo.
- **Interpretación a revisar (T19, mapa en pantalla angosta):** `DISENO.md` delega esta decisión a
  quien implemente, y el mockup del 11/08 recomendaba la opción B (sala reducida a escala). Al
  construirlo apareció una tensión real: la Sala 1 tiene 12 butacas por fila, y encogerlas para que
  las 12 entren en un teléfono angosto bajaría el objetivo táctil por debajo de 44×44px — de
  cumplimiento **obligatorio** (`CLAUDE.md` §8). Se prioriza esa regla no negociable: el mapa se
  dibuja a tamaño real (44px mínimo) y el contenedor de cada fila se desplaza de lado si no entra
  en la pantalla (más cerca de la opción A, aunque sin scroll cuando sí entra). Se documenta acá en
  vez de decidir en silencio, tal como pide `CLAUDE.md` §4.
- **Decisiones de implementación de T18, sin necesitar al usuario** (bundler no es de los que
  `CLAUDE.md` §6 reserva — ya estaba fijo React + Fastify + `@carbon/react` desde T0): **Vite**
  como bundler del cliente, tema Carbon **`g10`**. Dos ajustes técnicos: la minificación de CSS de
  Vite 8 (`lightningcss`) todavía no entiende una regla nueva (`@position-try`) que emite el SCSS
  de Carbon, así que se apagó (`build.cssMinify: false`) hasta que el ecosistema se ponga al día;
  y las fuentes IBM Plex de Carbon usan rutas al estilo webpack que Vite no resuelve, así que se
  desactivó el `@font-face` de Carbon (`$css--font-face: false`) y se cargan por Google Fonts en
  `index.html` en su lugar.
- **Interpretación a revisar (T16):** `enviarReporte` no pasa por la cola de Avisos —hace su propio
  intento con el `EnviarCorreo` inyectado y siempre inserta una fila nueva en `envio_reporte`— en
  vez de encolar y dejar el reintento al mecanismo genérico de T14. Se decidió así porque `REG-7`
  pide «si salió o falló» por cada envío real (uno por llamada, sin pisar el anterior), y el
  reintento de `RF-28` queda modelado como «alguien vuelve a llamar a `enviarReporte`» —el día 1 el
  Reloj (T17), o la dueña a mano— en vez de un reintento automático con espaciado interno como el de
  Avisos. «Avisar a la dueña» del fallo (tabla de errores) se resuelve dejando el intento fallido
  visible en `envio_reporte` para que su pantalla (T21) lo muestre, no como un correo aparte: no hay
  ninguna entidad que guarde un correo de la dueña.
- **Interpretación a revisar (T13):** el esquema no tiene tabla de sesión (las 13 entidades de
  `DISENO.md` no incluyen ninguna), y Operadores «no depende de nada» según ese mismo documento.
  Se implementaron `identificar` y `puede` como funciones puras sin estado; «abrir sesión» es el
  propio llamado a `identificar` desde Entrada, y «cerrarla al terminar la jornada» queda como
  responsabilidad de Entrada (T18), que es quien sostiene la sesión, no un dato que Operadores
  guarde o borre.
- **Interpretación a revisar (T12):** `cancelarFuncion` no impide volver a cancelar una función ya
  cancelada dentro de la misma jornada (sobrescribiría el motivo/operador de la cancelación
  original); no hay ninguna `RN-`/`RF-` que lo exija y arreglarlo exigía tocar `cartelera.ts`, fuera
  del alcance de archivos de T12 (`PLAN.md`). No toca reservas vigentes de la función cancelada:
  siguen vivas hasta que el barrido de T17 las venza por su propio `inicioDe`, tal como antes.
- T9 y T10 agregaron a Cartelera dos consultas con sus pruebas, señaladas como crecimiento del
  contrato: `categoriaBase(función)` (miércoles o general, `RN-13`, `RN-14`) e
  `inicioDe(función)` (instante de inicio, vencimiento de reservas, `RN-30`).
- Existe `src/demo.ts` (fuera de los commits de tareas): demostración por consola del flujo
  completo con `npx tsx src/demo.ts`, pedida por el usuario para ver el avance; las pantallas
  reales siguen en Fase 6.
- T9 y T10 agregaron a Cartelera dos consultas con sus pruebas, señaladas como crecimiento del
  contrato: `categoriaBase(función)` (miércoles o general, `RN-13`, `RN-14`) e
  `inicioDe(función)` (instante de inicio, vencimiento de reservas, `RN-30`).
- La conversión de una reserva registra la compra con canal `taquilla` y su operador (el cobro
  es en ventanilla, `RN-31`, y así suma al cierre de caja `RN-46`), conservando además el
  contacto de la reserva para la búsqueda por nombre o correo de la puerta (`RF-18`).
- La contradicción del CHECK de `entrada.categoria` (T2 vs. glosario) quedó **resuelta en T8**
  con la migración `002-categoria-miercoles`: el CHECK ahora admite las tres categorías del
  glosario (general, estudiante, miércoles), con reversa al esquema original.
- Dos interpretaciones tomadas en T6, a revisar por el usuario: (1) `RF-4` habla de butacas
  «vendida o reservada», pero se sigue a `DISENO.md`/`PLAN.md` y se usa `tieneTomadas` (incluye
  bloqueos vigentes, más estricto); (2) una función cancelada no bloquea el margen de 20 minutos
  (`RN-6`) porque su proyección no va a ocurrir (`RN-41`).
- Mockup UX/UI (12/08): la propuesta está completa en el artifact «Cine Variedades — Propuesta
  UX/UI» (tokens Carbon, mapa opciones A/B con B recomendada, estados por canal, cartelera y
  flujo bloqueo → pago → número). **Esperan decisión del usuario:** (1) opción A o B del mapa
  angosto — al decidirse se registra en `DISENO.md`; (2) moneda y formato de precio en pantalla;
  (3) texto de la etiqueta «MIÉRCOLES ½ PRECIO». Las pantallas reales siguen en Fase 6 (T18–T19).

**Stack decidido en T0:** TypeScript (Node.js + Fastify · React + `@carbon/react`) · SQLite en
modo WAL · planificador embebido (node-cron). Abierto: proveedor de correo (T14).
**Código:** vive en `Week3/cine-variedades/` (correr pruebas: `npm test`).

## Diseño (Caso Práctico 3) — completo

- [x] `PROMPT.md` — encargo original de la dueña
- [x] `ESPECIFICACION.md` — reglas, requisitos y criterios de aceptación
- [x] `DISENO.md` — arquitectura, modelo de datos, decisiones

## Plan de construcción (Sesión 4)

- [x] `PLAN.md` — plan por tareas T0–T22 con dependencias y paralelismo
- [x] Decisiones de UI registradas en `CLAUDE.md` §8 (Carbon como inspiración, PWA, skill `ui-ux-pro-max`)
- [x] **T0 — Decidir el stack**: TypeScript full-stack · SQLite (WAL) · planificador embebido
- [x] Decisiones de T0 registradas en `DISENO.md` con aprobación del usuario

## Construcción — en curso (autorización sesión por sesión)

**Nuevo desde T18:** el proyecto tiene dos paquetes npm. `cine-variedades/` (dominio + servidor,
Node/Vitest, sin cambios de comando) y `cine-variedades/entrada-cliente/` (React + Vite + PWA,
`npm install` propio; `npm run dev` para verla, `npm run build`/`typecheck` propios).

### Preparación
- [x] T1 — Andamiaje del proyecto: `cine-variedades/` con TypeScript estricto, Vitest, SQLite (WAL) y migraciones aplicar/revertir · 7 pruebas
- [x] T2 — Esquema de base de datos: migración `001-esquema-inicial` con las 13 entidades, unicidad (funcion, butaca), claves foráneas y valores cerrados con CHECK · 9 pruebas

### Fase 1 · Ocupación
- [x] T3 — Tomar y consultar butacas: `tomar` todo-o-nada en una sola transacción con borrado de
  vencidas, `tomadas` y `tieneTomadas` ignorando vencidas al instante exacto, choque arbitrado por
  la unicidad del motor (`RNF-4`, `CA-1`) · 8 pruebas
- [x] T4 — Liberar, vencer y barrer: `liberar` borra todas las filas de una referencia,
  `cambiarMotivo` convierte bloqueo/reserva → venta en un solo UPDATE sin ventana (limpia el
  vencimiento), `barrer` borra solo vencidas y devuelve cuántas (`REG-8`); si el barrido no corre,
  la venta sigue (decisión 4 de `DISENO.md`) · 6 pruebas

### Fase 2 · Cartelera
- [x] T5 — Salas, butacas fijas y películas: semilla idempotente de las 2 salas con 180 butacas
  inmutables (Sala 1 A–J×12, Sala 2 A–F×10), `butacasDe` con etiqueta fila+número (`A1`, `F7`),
  alta y consulta de películas con título y duración obligatorios (`RN-1`, `RN-2`, `RN-4`) · 7 pruebas
- [x] T6 — Semanas de cartelera y funciones: semanas de jueves a miércoles, solo la en curso y
  la siguiente (`RN-3`, `RN-8`), venta que abre cuando la dueña la da por cargada (`RN-9`);
  funciones con margen de 20 minutos por sala y mensaje con la primera hora posible (`RN-6`,
  `RF-3`, `CA-7`); modificar/eliminar solo sin butacas tomadas (`RF-4`, vía Ocupación);
  cancelación lógica con REG-4 (plazo `RN-42` queda para T12); `enVenta` = semana abierta ∧ no
  cancelada ∧ no empezada (`RN-21`, `RN-43`, borde `CA-2`) · 13 pruebas
- [x] T7 — Precios vigentes: `fijarPrecios` con historial con fecha desde (decisión de
  `DISENO.md`); `precio(función, categoría)` calculado por la fecha de la función (`RN-15`);
  miércoles a mitad del general con categoría propia y sin estudiante (`RN-13`, `RN-14`, `CA-3`);
  el congelado del monto queda para Venta (`RN-16`) · 7 pruebas

### Fase 3 · Venta
- [x] T8 — Compra en taquilla: `venderEnTaquilla` de libre a vendida sin paso intermedio
  (`RN-20`), una sola transacción con Ocupación y sin rastro si algo se adelanta (`RNF-4`,
  `REG-1`); número de 6 caracteres sin `0/O/1/I/L` único entre compras y reservas (`RN-25`);
  monto congelado por entrada (`RN-16`, `CA-4`); `jornadaDe` con corte 06:00 congelada al
  escribir (`RN-10`, `RN-11`, `CA-8`); función no en venta → rechazo (`RF-13`); migración
  `002-categoria-miercoles` habilita la categoría miércoles en `entrada` (`CA-3`) · 10 pruebas
- [x] T9 — Compra por internet: `bloquear` de 5 minutos a favor de la sesión anónima (`RN-19`,
  `RF-10`); `pagar` como punto único del pago simulado — convierte bloqueo en venta sin ventana
  vía `cambiarMotivo` (`RN-26`), exige nombre/correo/teléfono (`RN-23`), canal internet
  (`RN-27`); pago fallido sin rastro con el bloqueo vivo; bloqueo vencido → «las butacas
  volvieron a estar libres» (`REG-8`); correo del número por la interfaz de Avisos, su falla no
  revierte (`RNF-5`); miércoles a mitad vía `categoriaBase` (`CA-3`) · 8 pruebas
- [x] T10 — Reservas de estudiante: `reservar` solo internet y sin pago, número propio y
  vencimiento al inicio de la función (`RN-28`–`RN-30`, `REG-3`); sin reservas en miércoles
  (`RN-14`); `convertir` en taquilla conserva el número — carné → estudiante, sin carné →
  general (`RN-31`, `RN-32`, `RN-25`); `liberarReserva` para quien no acepta (`RN-32`);
  `barrerVencidos` borra reservas vencidas sin dejar registro y llama al `barrer()` de
  Ocupación (`RN-34`, `REG-8`) · 8 pruebas (+1 de `inicioDe` en cartelera)
- [x] T11 — Validación en puerta: `validar(función, número, operador, ahora)` marca instante y
  operador en todas las entradas de una compra a la vez (`RF-18`, `RF-19`, `REG-2`); rechaza sin
  registrar nada si el número no existe (`CompraInexistente`), es de otra función
  (`NumeroDeOtraFuncion`), la función se canceló (`FuncionCancelada`), la compra está anulada
  (`CompraAnulada`) o ya se validó (`EntradaYaUsada`, `RN-37`, `RF-20`); `buscarCompraPorContacto`
  para la búsqueda alternativa por nombre o correo (`RF-18`) · 7 pruebas
- [x] T12 — Anulación, cancelación y devoluciones: `anular` hasta el inicio de la función libera
  butacas y registra operador/instante/jornada/motivo (`RN-38`, `RN-40`, `RF-21`, `REG-4`), y
  rechaza con entradas ya usadas (`RN-39`, `RF-22`); `cancelarFuncion` hasta el final de la
  jornada de la función (`RN-42`, `CA-8`) devuelve de una sola vez todas sus compras pagadas
  —validadas o no— (`RN-41`, `RF-23`), libera sus butacas y avisa por correo solo a quien compró
  por internet (`RF-24`); llama a `cancelarFuncion` de Cartelera para el estado de la función, sin
  tocarla directamente; `marcarDevolucionEntregada` registra aparte quién entregó el efectivo,
  cuándo y en qué jornada (`RF-25`, `REG-5`, `RN-44`), sobre columnas nuevas de la migración
  `003-devolucion-entregada` (ver nota más arriba) · 9 pruebas

### Fase 4 · Salidas, Avisos y Operadores
- [x] T13 — Operadores: `identificar(PIN)` devuelve el operador con su puesto o nada; `puede
  (operador, operación)` responde por puesto sobre una matriz fija de permisos —dueña, taquilla,
  puerta— (`RN-50` a `RN-54`, `RF-32`, `RF-33`); no depende de nada ni conoce sesiones: identificar
  y exigir el operador en cada pantalla es trabajo de Entrada (T18), no de este componente ni de
  quien compra por internet (`RN-55`) · 5 pruebas
- [x] T14 — Avisos: `crearAvisos(bd, ahora)` fabrica el contrato fijo desde T9 — `encolar` es un
  INSERT simple que nunca falla ni bloquea (`RNF-5`) sobre la tabla propia `aviso` (migración `004`,
  fuera de las 13 entidades del modelo porque Avisos no sabe qué es una compra); `procesarPendientes`
  intenta los que ya vencieron, reintenta con espaciado creciente duplicando la espera en cada
  vuelta, y marca fallido y visible al superar las 24 horas desde que se encoló (`RN-48`); el envío
  real queda aislado tras `EnviarCorreo`, un método único (decisión de `DISENO.md`), con
  `crearEnviarPorSmtp` adaptando Nodemailer —proveedor elegido por el usuario— sin que quien encola
  se entere si cambia · 9 pruebas (6 de la cola y reintentos, 3 del adaptador)
- [x] T15 — Cierre de caja: `cierreDeCaja(jornada)` calcula al vuelo, sin foto, sobre `compra`
  (decisión de `DISENO.md`); ventanilla = cobrado de esa jornada (cuenta aunque luego se anule o
  devuelva, porque el monto queda congelado, `RN-16`) menos lo entregado en efectivo *en esa misma
  jornada* —la de la entrega, no la de la venta (`RN-44`, `CA-8`)—; internet solo informativo y
  nunca se mezcla con ventanilla (`RN-46`, `RF-26`, `CA-6`); no toca `reserva` en absoluto, así que
  nunca puede sumarlas; es de solo lectura, correrlo dos veces no cambia nada · 6 pruebas
- [x] T16 — Reporte mensual y consultas: `reporteMensual(mes)` arma el detalle función por función
  contando entradas de compras `pagada` o `devuelta` —nunca `anulada`— y marca las canceladas, con
  sus entradas vendidas y devueltas a la vista (`RF-27`, `RN-41`, `CA-5`); `enviarReporte` entrega
  resumen en el cuerpo y una hoja de cálculo adjunta (decisión de `DISENO.md`) y **siempre** deja un
  registro nuevo en `envio_reporte` —éxito o fallo, sin pisar intentos previos— para que un fallo
  quede visible y se pueda reenviar a mano (`REG-7`, `RF-28`, `RN-48`); `correoDelDistribuidor` /
  `fijarCorreoDelDistribuidor` sobre `configuracion`, sin admitir vacío (`RN-49`, `RF-29`);
  `ocupacionDeFunciones` (entradas vendidas sobre butacas de la sala, por función, en un período,
  `RF-30`) y `entradasPorCategoriaYCanal` (agrupado, en un período, `RF-31`) · 8 pruebas

### Fase 5 · Reloj
- [x] T17 — Tareas programadas: `tickPeriodico` (cada 10 min) llama a `barrerVencidos` (Venta) y a
  `procesarAvisos` (tercer trabajo aprobado por el usuario) con el mismo instante, sin tocar nunca
  la tabla de ocupación directamente (`RN-19`, `RN-30`, `RN-48`); `tickMensual` el día 1 pide a
  Salidas el reporte del mes recién terminado y su envío, y no hace nada los demás días (`RN-47`);
  ninguno de los dos contiene una regla de negocio, solo llaman con el instante que reciben —las
  pruebas lo verifican con dependencias falsas—; `iniciarReloj` es la única parte que mira el reloj
  de verdad, con `node-cron` (decisión de T0) cada 10 minutos y a las 06:00 del día 1; se confirmó
  vendiendo en taquilla sin que corriera ningún tick (decisión 4 de `DISENO.md`) · 6 pruebas

### Fase 6 · Entrada (PWA · Carbon)
- [x] T18 — Base de la capa de entrada:
  - **Servidor** (`entrada/servidor/`, Fastify + `@fastify/cookie`): sesión de operador —el
    operador completo viaja firmado en la cookie, sin tabla de sesiones— con `exigirOperador
    (operación)` que exige identificarse y delega el permiso en `puede` de Operadores (RF-32,
    RN-54); sesión anónima del comprador con id aleatorio en cookie, sin exigir nada (RN-55);
    traductor de errores de dominio a status HTTP + cuerpo estructurado por cada una de las 6
    clases de rechazo de Venta, con límite conocido documentado para los rechazos sin clase propia
    · 15 pruebas
  - **Cliente** (`entrada-cliente/`, paquete npm propio): React 19 + Vite 8 + `@carbon/react`
    (tema `g10`) + `react-router-dom`; PWA instalable vía `vite-plugin-pwa` — manifest con íconos
    SVG, service worker que precachea solo el cascarón y nunca rutas `/api` (`RNF-3`); cascarón de
    rutas para los tres públicos (web pública, taquilla, puerta), sin ninguna pantalla real
    todavía (T19–T21). `npm run build`/`typecheck` en verde.
- [x] T19 — Web pública del comprador:
  - **Crecimiento de contrato** en Cartelera y Ocupación (mismo patrón que T9/T10):
    `detalleFuncion`/`funcionesEnVenta` (con `filas`/`butacasPorFila` de la sala) en `cartelera.ts`;
    `venceDe` en `ocupacion.ts`; `bloqueoVigente` en `venta.ts` (reconstruye el bloqueo de una
    sesión anónima entre pedidos HTTP, sin que Entrada lea la tabla de ocupación directamente) · 7
    pruebas
  - **Servidor** (`entrada/servidor/rutas-publicas.ts`): `GET /api/cartelera` (RF-8), `GET
    /api/funciones/:id/mapa` compone `butacasDe` + `tomadas` y colapsa a libre/no-disponible
    (RF-9, RN-56, CA-9), `POST .../bloqueo` (RF-10), `POST .../pago` (RF-11, reconstruye el bloqueo
    por la cookie anónima) y `POST .../reserva` (RF-14) · 10 pruebas. `principal.ts`: primer punto
    de entrada real (`app.listen`), con `bd` de archivo y solo las salas sembradas — nunca datos de
    negocio de mentira, esos los carga la dueña en T21.
  - **Cliente**: `Cartelera` (lista con precios y la etiqueta de miércoles), `Funcion` (mapa +
    flujo bloqueo → pago → número + reserva, sondeo cada 3 s mientras se eligen butacas,
    mensajes de la tabla de errores), `MapaDeButacas` (butacas de 44×44px reales, nunca menos —
    ver interpretación más abajo). Sin pruebas automatizadas de componentes (no hay
    testing-library configurado); verificado corriendo el cliente y el servidor reales uno contra
    el otro (`npm run servidor` + `npm run dev` en `entrada-cliente/`).
- [x] T20 — Pantalla de taquilla:
  - **Crecimiento de contrato** (mismo patrón que T9/T10/T19): `buscarReserva(número, ahora)` en
    `venta.ts` —qué función, qué butacas y a nombre de quién, para ver la reserva antes de
    convertirla (`RF-16`)—, pidiéndole las butacas a Ocupación y nunca a su tabla; y
    `GET /api/operadores/sesion`, que dice quién está operando para no volver a pedir el PIN en
    cada recarga (`RF-32`).
  - **Servidor** (`entrada/servidor/rutas-taquilla.ts`, 16 pruebas): mapa con los cuatro estados de
    `RN-17` —el recorte contrario al público (`RN-57`, `CA-9`)— que expone el número de la reserva
    o de la compra pero **nunca** la sesión anónima de un bloqueo (`RN-55`); venta presencial con
    categoría por butaca (`RF-12`); ver, convertir con o sin carné y liberar una reserva (`RF-16`,
    `RF-17`, `RN-32`); anular con motivo (`RF-21`, `REG-4`); marcar la devolución entregada
    (`RF-25`); y el cierre de caja de la jornada (`RF-26`), que por defecto usa la jornada que
    calcula Venta con el corte de las 06:00 (`RN-10`). Cada ruta exige operador con permiso
    (`RF-32`, `RF-33`): el puesto de puerta recibe 403 al intentar vender (`RN-53`).
  - **Cliente**: `Taquilla` con cuatro pestañas —Vender, Reservas, Compras, Cierre de caja—,
    `SesionOperador` (PIN, compartida con la puerta de T21) y el mapa de butacas generalizado a
    los seis tratamientos visuales. 9 pruebas de componentes (ver nota de testing-library).
- [x] T21 — Puerta y pantallas de la dueña:
  - **Crecimiento de contrato**: en Cartelera, `semanas`, `funcionesDeSemana`, `funcionesEnRango` y
    `preciosVigentes`; en Venta, `rangoDeJornada(jornada)` —la inversa de `jornadaDe`, que vive ahí
    porque el corte de las 06:00 es una regla del negocio (`RN-10`) y Entrada no puede rehacerla
    por su cuenta. La puerta pide el rango a Venta y las funciones a Cartelera, y compone: es
    exactamente el trabajo que `DISENO.md` le asigna a Entrada · 5 pruebas
  - **Servidor puerta** (`rutas-puerta.ts`, 8 pruebas): funciones de la jornada —la de las 23:00
    del viernes sigue siendo del viernes (`CA-8`)—, validación por número (`RF-19`) con los cinco
    rechazos con clase propia ya traducidos desde T18 (`RF-20`), y búsqueda por nombre o correo
    (`RF-18`). Taquilla recibe 403 al intentar validar (`RN-53`).
  - **Servidor dueña** (`rutas-administracion.ts`, 15 pruebas): películas (`RF-1`), semanas y su
    apertura de venta (`RF-2`, `RF-5`), funciones con el mensaje del margen de 20 minutos tal como
    lo redacta Cartelera (`RF-3`, `CA-7`), modificar y eliminar (`RF-4`), cancelar con motivo
    —también permitida a taquilla (`RN-52`)— con el aviso a cada comprador de internet (`RF-23`,
    `RF-24`), precios (`RF-6`), correo del distribuidor (`RF-29`), reporte del mes con sus envíos y
    reenvío a mano (`RF-27`, `RF-28`, `REG-7`) y las dos consultas (`RF-30`, `RF-31`).
    `crearApp` acepta ahora un `enviarCorreo` inyectable; si no viene, lo arma del entorno.
  - **Cliente**: `Puerta` (función de la jornada, número, resultado y búsqueda alternativa) y
    `Administracion` con cuatro pestañas —Cartelera, Precios y distribuidor, Reporte mensual,
    Consultas—. 4 pruebas de componentes de la puerta, incluida la que comprueba que la búsqueda
    por nombre solo se ofrece cuando el número no existe.
  - **Verificado además contra el servidor real**, no solo con pruebas: sesión por PIN de los tres
    puestos, venta, conversión de reserva, anulación, devolución entregada, cierre de caja,
    validación en puerta (y su rechazo al repetirla), cancelación de función y reporte mensual.

### Cierre
- [ ] T22 — Verificación final contra los `CA-` y carga de 200 usuarios
