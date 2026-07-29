# BITÁCORA — FretPath: decaimiento vencido en el dominio de nodos

## 1. Encargo inicial

Extracto textual del prompt entregado a Claude Code al inicio de la sesión
(recortado por espacio; el texto completo estructuraba el trabajo en cuatro
fases con aprobación entre cada una):

«Actúa como arquitecto senior y desarrollador TypeScript especializado en
diagnóstico basado en evidencia, TDD y sistemas deterministas. Trabajarás sobre
FretPath, una PWA React/TypeScript cuya lógica de dominio vive en
`src/engine/`. […] Un usuario dejó la aplicación durante aproximadamente un
mes. Al volver, el mapa seguía mostrando como dominadas habilidades que debían
haber perdido maestría por atraso. El producto espera decaimiento exponencial
de 3 % diario después de `dueDate`, pérdida de dominio bajo 80, estado oxidado
y rebloqueo de los nodos dependientes. […] Reproducir el reporte con una prueba
nueva, observable y determinista; diagnosticar la causa; aplicar la corrección
mínima; verificar todo el contrato de producto; diseñar e implementar
`nodesAtRisk(graph, itemStates, now, horizonDays)`; conservar las 105 pruebas
originales y el build en verde.»

## 2. Causa

`src/engine/graph.ts`, línea 172 final: `isNodeMastered` evaluaba cada ítem con
`currentMastery(state, state.dueDate ?? now)` — la maestría en el `dueDate` del
propio ítem, instante en el que por especificación no hay decaimiento
(`srs.ts:60`, `now <= dueDate` devuelve la maestría almacenada). El decaimiento
quedaba estructuralmente anulado dentro del dominio de nodos: un nodo ganado
permanecía dominado para siempre, con cualquier atraso. Es la confusión que
`CLAUDE.md` advierte: usar un estado almacenado donde corresponde el estado
derivado del instante consultado. `currentMastery` en sí era correcta (cubierta
en `srs.test.ts`); la capa defectuosa era el grafo, no el SRS ni la UI.

## 3. Alcance

Todo lo que delega en `isNodeMastered`: estado del nodo (`computeNodeStatus`
nunca degradaba de `mastered`/`maintenance`), rebloqueo de dependientes
(`prereqsMet` siempre verdadero), oxidado (`isNodeWeakened` siempre `false`,
con `weakenedPrereqs` siempre vacío: guía de la UI muerta), `unlocksAfter`, y
la sesión (`assembleSession` excluía el nodo oxidado del pool practicable,
impidiendo repasarlo). Evidencia:
`src/engine/overdue-decay.regression.test.ts` (7 pruebas) cubre ítem que decae,
pérdida de dominio, oxidado, rebloqueo, `weakenedPrereqs`, `maintenance` no
inmune y reingreso a sesión. La regresión se demostró roja antes del arreglo:
`computeAllNodeStates` devolvía `'mastered'` esperándose `'in_progress'` a 30
días de atraso (100·0.97³⁰ ≈ 40.1 < 80). El arreglo fue una línea: evaluar
`currentMastery(state, now)`. Commit `c83bedf`.

## 4. Semántica de nodesAtRisk

En riesgo = dominado en `now` y no dominado en `now + horizonDays` bajo
decaimiento proyectado (se desplaza el instante pasado a `currentMastery`;
ningún estado se copia ni muta). Decisiones propuestas en tabla, aprobadas sin
cambios; una prueba por fila en `src/engine/nodesAtRisk.test.ts`:

- Cae el primer ítem, no el promedio — coherente con `every ≥ 80` — «row 1».
- Nunca practicado: excluido — nunca estuvo dominado — «row 2».
- Ya < 80 en `now`: excluido — «ya cayó» ≠ «caerá»; lo reporta `isNodeWeakened` — «row 3».
- `maintenance` elegible — dominado para desbloqueo, no inmune al decaimiento — «row 4».
- Sin ítems: excluido — no puede estar dominado — «row 5».
- Exactamente 80 en el horizonte: no en riesgo — espejo estricto de `≥ 80`, instante inclusivo — «row 6», dos pruebas (frontera sin decaimiento y cruce 7 vs 8 días).
- `horizonDays = 0`: vacío — proyección = `now` — «row 7».
- Negativo o no finito: `RangeError` — error del llamador; precedente en `srs.ts:107` — «row 8».
- Fraccionario: válido — decaimiento continuo — «row 9».
- Estado faltante: maestría 0, excluido — mismo trato que `isNodeMastered` — «row 10».
- Resultado en `graph.topoOrder`, único por construcción — determinista, prerrequisitos primero — «row 11», más prueba de pureza (no muta entradas).

Commit `2cc4eb3`.

## 5. Desvío

Al agregar la prueba de contrato de sesión, la aserción esperaba sesión vacía
en `dueDate`; falló la suite (111/112) porque el nodo dependiente,
desbloqueado, aporta su ítem fresco — comportamiento correcto del motor. Señal:
el fallo de la propia prueba nueva con fixture válido. Reencauce: se corrigió
la aserción de la prueba, no el motor, y se documentó la expectativa correcta
en el propio test.

## 6. Señal de cierre

`npm test`: 125 pruebas aprobadas en 9 archivos (105 originales intactas + 7 de
regresión/contrato + 13 de `nodesAtRisk`). `npm run build`: `tsc --noEmit` y
Vite/PWA sin errores. `git diff --check`: limpio. `git diff f332319..HEAD`:
solo `M src/engine/graph.ts` más los dos archivos de prueba nuevos; el diff
sobre los 7 archivos de prueba preexistentes es vacío. Historial: `c83bedf`
(fix + regresión/contrato) y `2cc4eb3` (`nodesAtRisk` + bordes), locales, sin
push.
