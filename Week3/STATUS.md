# STATUS — Cine Variedades

> Estado del proyecto en formato checklist. Se actualiza **al cerrar cada tarea** de `PLAN.md`
> (paso obligatorio de la fase de verificación, `CLAUDE.md` §4). El detalle de cada tarea —
> comportamientos, interfaces, referencias — vive en `PLAN.md`.

**Última actualización:** 12 de agosto de 2026 · Sesión 12 — cerrada con T10
**Tarea en curso:** ninguna — T10 cerrada (90 pruebas en verde y typecheck limpio: `npm test` y
`npm run typecheck` en `cine-variedades/`)
**Siguiente tarea:** T11 — Validación en puerta, o T13/T14 en carriles paralelos

**Al retomar:**
- Abrir con `CLAUDE.md` + `PLAN.md` + este archivo; el detalle de T11 está en `PLAN.md`.
- Hasta T10 asentado en git (12/08/2026, en `main`, un commit por tarea). Pendiente: `push`
  cuando el usuario lo pida.
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
- [ ] T11 — Validación en puerta
- [ ] T12 — Anulación, cancelación y devoluciones

### Fase 4 · Salidas, Avisos y Operadores
- [ ] T13 — Operadores
- [ ] T14 — Avisos
- [ ] T15 — Cierre de caja
- [ ] T16 — Reporte mensual y consultas

### Fase 5 · Reloj
- [ ] T17 — Tareas programadas

### Fase 6 · Entrada (PWA · Carbon)
- [ ] T18 — Base de la capa de entrada
- [ ] T19 — Web pública del comprador
- [ ] T20 — Pantalla de taquilla
- [ ] T21 — Puerta y pantallas de la dueña

### Cierre
- [ ] T22 — Verificación final contra los `CA-` y carga de 200 usuarios
