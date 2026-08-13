# STATUS — Cine Variedades

> Estado del proyecto en formato checklist. Se actualiza **al cerrar cada tarea** de `PLAN.md`
> (paso obligatorio de la fase de verificación, `CLAUDE.md` §4). El detalle de cada tarea —
> comportamientos, interfaces, referencias — vive en `PLAN.md`.

**Última actualización:** 12 de agosto de 2026 · Sesión 13 — cerrada con T17 (Fase 5 completa)
**Tarea en curso:** ninguna — T17 cerrada (140 pruebas en verde y typecheck limpio: `npm test` y
`npm run typecheck` en `cine-variedades/`)
**Siguiente tarea:** Fase 6 — T18 (Base de la capa de entrada); invoca la skill `ui-ux-pro-max`
antes de diseñar (`CLAUDE.md` §8)

**Decisión del usuario (12/08, en esta sesión):** el Reloj (T17) agrega un tercer trabajo no
listado en `DISENO.md` — llamar cada 10 minutos a `procesarPendientes` de Avisos con el envío real
— porque sin eso ningún correo se enviaría nunca. Pendiente: registrar esto en `DISENO.md` §Reloj
cuando el usuario apruebe esa edición sección por sección (mismo trámite pendiente que las otras
decisiones de esta sesión).

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
- **Pendiente para T18:** `iniciarReloj` (T17) recibe `DependenciasReloj` ya armadas, pero nadie las
  arma todavía con la base de datos real: quien componga el servidor debe atar `barrerVencidos`,
  `procesarPendientes` (con `crearEnviarPorSmtp` + `crearTransportadorSmtp` y las variables de
  entorno) y `enviarReporte` (con el correo de `correoDelDistribuidor`) a un `bd` concreto antes de
  llamar a `iniciarReloj`.
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
- [ ] T18 — Base de la capa de entrada
- [ ] T19 — Web pública del comprador
- [ ] T20 — Pantalla de taquilla
- [ ] T21 — Puerta y pantallas de la dueña

### Cierre
- [ ] T22 — Verificación final contra los `CA-` y carga de 200 usuarios
