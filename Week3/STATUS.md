# STATUS — Cine Variedades

> Estado del proyecto en formato checklist. Se actualiza **al cerrar cada tarea** de `PLAN.md`
> (paso obligatorio de la fase de verificación, `CLAUDE.md` §4). El detalle de cada tarea —
> comportamientos, interfaces, referencias — vive en `PLAN.md`.

**Última actualización:** 12 de agosto de 2026 · Sesión 5 — cerrada con T3
**Tarea en curso:** ninguna — T3 cerrada (24 pruebas en verde y typecheck limpio: `npm test` y
`npm run typecheck` en `cine-variedades/`)
**Siguiente tarea:** T4 — Liberar, vencer y barrer (o T5, T13 o T14, que son carriles paralelos)

**Al retomar:**
- Abrir con `CLAUDE.md` + `PLAN.md` + este archivo; el detalle de T4 está en `PLAN.md`.
- Todo lo hecho hasta T3 está asentado en git (12/08/2026, seis commits: PROMPT · especificación
  y diseño · T0 · T1 · T2 · T3, en `main`). Pendiente: `push` cuando el usuario lo pida.

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
- [ ] T4 — Liberar, vencer y barrer

### Fase 2 · Cartelera
- [ ] T5 — Salas, butacas fijas y películas
- [ ] T6 — Semanas de cartelera y funciones
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
