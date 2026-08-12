# STATUS — Cine Variedades

> Estado del proyecto en formato checklist. Se actualiza **al cerrar cada tarea** de `PLAN.md`
> (paso obligatorio de la fase de verificación, `CLAUDE.md` §4). El detalle de cada tarea —
> comportamientos, interfaces, referencias — vive en `PLAN.md`.

**Última actualización:** 12 de agosto de 2026 · Sesión 8 — cerrada con T6
**Tarea en curso:** ninguna — T6 cerrada (55 pruebas en verde y typecheck limpio: `npm test` y
`npm run typecheck` en `cine-variedades/`)
**Siguiente tarea:** T13 — Operadores (secuencia recomendada) o T7 — Precios vigentes

**Al retomar:**
- Abrir con `CLAUDE.md` + `PLAN.md` + este archivo; el detalle de T13 y T7 está en `PLAN.md`.
- Hasta T6 asentado en git (12/08/2026, en `main`, un commit por tarea). Pendiente: `push`
  cuando el usuario lo pida.
- Dos interpretaciones tomadas en T6, a revisar por el usuario: (1) `RF-4` habla de butacas
  «vendida o reservada», pero se sigue a `DISENO.md`/`PLAN.md` y se usa `tieneTomadas` (incluye
  bloqueos vigentes, más estricto); (2) una función cancelada no bloquea el margen de 20 minutos
  (`RN-6`) porque su proyección no va a ocurrir (`RN-41`).
- Pedido del usuario (12/08): propuesta de diseño UX/UI del mapa de butacas y cartelera —
  se presenta como mockup para decidir (skill `ui-ux-pro-max` obligatoria); las pantallas
  reales siguen siendo de la Fase 6 (T18–T19).

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
- [ ] T7 — Precios vigentes

### Fase 3 · Venta
- [ ] T8 — Compra en taquilla
- [ ] T9 — Compra por internet
- [ ] T10 — Reservas de estudiante
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
