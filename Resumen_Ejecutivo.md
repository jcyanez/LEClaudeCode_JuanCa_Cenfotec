# Resumen Ejecutivo — Caso Práctico 2 (SINT-732) · FretPath

## El proyecto

- FretPath es una PWA de práctica de guitarra: un grafo de habilidades (DAG)
  decide qué estudiar y un motor de repetición espaciada decide cuándo
  repasar. Sin backend; el progreso vive en el navegador (IndexedDB).
- Premisa de producto: el dominio se pierde solo — 3 % de decaimiento por día
  de atraso tras la fecha de repaso; bajo 80/100 el nodo se "oxida" y sus
  dependientes se rebloquean.

## Lo reportado

- «Dejé la app un mes… el mapa me muestra todo dominado, igual que como lo
  dejé.» Las 105 pruebas estaban en verde y el build compilaba: el verde no
  refutaba el reporte.

## Lo que encontramos (puntual)

- **Un defecto de una línea** en `src/engine/graph.ts:172`: `isNodeMastered`
  evaluaba la maestría en el `dueDate` almacenado del ítem — instante donde
  por definición no hay decaimiento — en vez del instante consultado (`now`).
- Efecto en cascada: nodos dominados para siempre, dependientes nunca
  rebloqueados, señal de "oxidado" siempre apagada, guía de prerrequisitos
  muerta y los ítems vencidos excluidos de la sesión de práctica.
- Por qué la suite no lo vio: ningún fixture combinaba "ítem vencido" con
  "nodo dominado"; el decaimiento solo se probaba aislado en `srs.test.ts`.

## Lo que corregimos (puntual)

- **Fix mínimo de 1 línea**: evaluar `currentMastery(state, now)`. Todo lo
  demás se corrige en cascada porque delega en esa función.
- Regresión demostrada **en rojo antes** del arreglo (a 30 días de atraso el
  motor devolvía `mastered`; 100·0.97³⁰ ≈ 40.1 < 80) y en verde después.
- **Función nueva `nodesAtRisk(graph, itemStates, now, horizonDays)`**: la
  advertencia temprana que nunca se construyó — qué nodos caerán dentro del
  horizonte si no se practica. 11 decisiones de borde documentadas y cada una
  fijada con una prueba.

## Los commits (sobre la línea base `f332319` del instructor)

- `8d0b3bd` — fix de 1 línea + 7 pruebas (regresión y contrato de producto:
  decaimiento, pérdida de dominio, oxidado, rebloqueo, guía, maintenance no
  inmune, reingreso a sesión).
- `cd891f1` — `nodesAtRisk` + 13 pruebas de bordes (tabla de decisiones).
- `f14655b` — `BITACORA.md` final reconstruida desde Git (≤ 900 palabras).
- `298a481` — suite funcional de invariantes temporales (6 pruebas), el reto
  adicional de la consigna.

## Tranquilidad para el cliente: por qué no vuelve a suceder

- La regresión exacta del reporte quedó fijada en una prueba que fallará si
  alguien reintroduce el defecto.
- Además, una **suite de invariantes temporales** vigila la *clase* de error
  (confundir estado almacenado con estado derivado del instante): ciclo de
  vida completo con el contenido real de la app, barrido de 60 días en pasos
  de medio día y verificación de que derivar estados nunca muta datos.
- **Eficacia demostrada, no supuesta**: reintrodujimos el bug temporalmente y
  la suite lo cazó por 3 vías independientes; luego se restauró el arreglo.
- Con `nodesAtRisk` el producto ahora puede avisar **antes** de que algo se
  caiga, no solo mostrarlo caído después.
- Estado final verificable: **131/131 pruebas verdes** (las 105 originales
  intactas, sin editar ninguna) y build limpio (`tsc --noEmit` + Vite).

## Cumplimiento de la consigna (SINT-732, Caso práctico 2)

| Requisito de la consigna | Estado | Evidencia |
|---|---|---|
| Prueba nueva que reproduce el reporte, roja en el repo recibido y por la razón correcta | ✅ | `overdue-decay.regression.test.ts`; rojo documentado (`expected 'mastered' to be 'in_progress'`) con fixture válido, a nivel de comportamiento |
| Esa prueba pasa y las 105 originales siguen pasando, sin modificar ninguna | ✅ | 131/131; diff sobre los 7 archivos de prueba originales = vacío |
| Corrección mínima y defendible | ✅ | 1 línea (`graph.ts:172`); todo lo demás delega en `isNodeMastered` |
| Comportamiento esperado recorrido punto por punto con evidencia | ✅ | 7 pruebas de contrato: decaimiento, pérdida de dominio, oxidado, rebloqueo, guía de prerrequisitos, maintenance, sesión |
| Hallazgos no reportados corregidos y documentados | ✅ | La guía "oxidado"/`weakenedPrereqs` estaba muerta y los ítems vencidos no reingresaban a sesión; ambos revividos por el mismo fix y fijados con pruebas |
| `nodesAtRisk` implementada en el motor, tipada, tiempo como parámetro | ✅ | `graph.ts`, pura, `RangeError` para horizontes inválidos |
| Decisiones de borde tomadas, escritas y fijadas en pruebas (primer ítem vs promedio, nunca practicados, ya caídos, maintenance, sin ítems, cruce exacto) | ✅ | Tabla de 11 decisiones en `BITACORA.md` §4; 13 pruebas en `nodesAtRisk.test.ts` |
| `CLAUDE.md` en la raíz con lo aprendido del proyecto | ✅ | Actualizado con estado real, convenciones e invariantes (incluida la lección del caso) |
| `BITACORA.md` generada con el encargo, 6 secciones, ≤ 900 palabras, fiel | ✅ | Committeada; datos tomados de Git, desvío real registrado |
| Reto adicional: conjunto mínimo de pruebas que habría atrapado el bug + explicación del hueco | ✅ | `time-invariants.test.ts` (eficacia demostrada reintroduciendo el bug); hueco explicado en `BITACORA.md` §3 |
| Restricciones: pruebas existentes intactas, sin tocar producción, motor puro sin reloj del sistema | ✅ | Verificado por diff, y ninguna función nueva llama `Date.now()` |
| Entrega: enlace al repositorio Git con sus commits (4 ago 2026) | ✅ | Rama `week2-fretpath-caso2` en el repo de evidencias `jcyanez/LEClaudeCode_JuanCa_Cenfotec`, con el historial completo (línea base del instructor + commits del caso) |

## Enlace de entrega

- https://github.com/jcyanez/LEClaudeCode_JuanCa_Cenfotec/tree/week2-fretpath-caso2

## Acción pendiente

- Subir el enlace de entrega a Moodle antes del martes 4 de agosto de 2026.
