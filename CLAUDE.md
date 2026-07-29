# FretPath: contexto de trabajo para Claude Code

## Propósito

FretPath es una PWA local de práctica de guitarra. Un DAG de habilidades decide
qué contenido está desbloqueado y un motor de repetición espaciada decide cuándo
repasarlo. El progreso se guarda en IndexedDB; no hay backend ni autenticación.

La prioridad de este caso es corregir el comportamiento temporal del motor con
una modificación mínima, especificaciones ejecutables y un historial Git fácil
de auditar. No confundir un estado almacenado con un estado derivado para un
instante dado.

## Tecnologías

- TypeScript 5.8 en modo `strict`, destino ES2022 y módulos ESNext.
- React 19 y React DOM 19.
- Vite 6, `@vitejs/plugin-react` y dos entradas: `index.html` y `app.html`.
- Vitest 3 con entorno `node`; descubre `src/**/*.test.ts`.
- Tailwind CSS 4 mediante el plugin de Vite.
- Dexie 4 para IndexedDB y `dexie-react-hooks`.
- `vite-plugin-pwa` para manifiesto, service worker y funcionamiento offline.
- npm con versiones bloqueadas en `package-lock.json`.

## Comandos

Ejecutar desde la raíz de este repositorio:

```bash
npm ci
npm run dev
npm test
npm run test:watch
npm run build
npm run preview
```

Pruebas dirigidas útiles:

```bash
npm test -- src/engine/graph.test.ts
npm test -- src/engine/srs.test.ts
npm test -- src/engine/session.test.ts
npm test -- src/engine/graph.test.ts -t "mastery cascade"
npm test -- src/engine/overdue-decay.regression.test.ts
npm test -- src/engine/nodesAtRisk.test.ts
npm test -- src/engine/time-invariants.test.ts
```

En Windows PowerShell, si la política bloquea `npm.ps1`, usar:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Línea base recibida (verificada el 28 de julio de 2026):

- 7 archivos de prueba.
- 105 pruebas aprobadas.
- `npm run build` completa `tsc --noEmit` y el build de Vite.

Estado tras el caso práctico 2 (28 de julio de 2026, commits `8d0b3bd`,
`cd891f1`, `f14655b`, `298a481`):

- 10 archivos de prueba, 131 pruebas aprobadas; build limpio.
- Las 105 pruebas originales están intactas; las 26 nuevas viven en
  `src/engine/overdue-decay.regression.test.ts` (regresión + contrato),
  `src/engine/nodesAtRisk.test.ts` (bordes) y
  `src/engine/time-invariants.test.ts` (invariantes temporales).

## Arquitectura

- `src/engine/types.ts`: contratos del dominio.
- `src/engine/srs.ts`: estado inicial, intentos, vencimiento y decaimiento.
- `src/engine/graph.ts`: validación del DAG, dominio, estados de nodos y
  `nodesAtRisk` (alerta temprana de nodos que caerán en un horizonte).
- `src/engine/session.ts`: selección determinista de una sesión por presupuesto.
- `src/engine/streak.ts`: cálculo de rachas.
- `src/data/loader.ts` y `src/data/*.json`: carga y validación de contenido.
- `src/db/`: frontera de persistencia Dexie. El motor no depende de ella.
- `src/sync/`: resolución determinista de conflictos.
- `src/audio/`: metrónomo y tonos.
- `src/components/` y `src/App.tsx`: interfaz React.

Flujo principal:

1. La UI entrega un resultado y un `now`.
2. `src/db/repo.ts` carga el estado y llama al motor SRS.
3. El nuevo estado del ítem se persiste.
4. Los estados de nodo se vuelven a derivar desde el grafo y los ítems.
5. La UI deriva otra vez los estados al renderizar, usando su `now`.

## Invariantes del motor

- El motor es puro, determinista y ajeno a React, Dexie y APIs del navegador.
- El tiempo siempre entra como parámetro epoch en milisegundos. No introducir
  `Date.now()`, `new Date()` ni temporizadores dentro de `src/engine/`.
- No mutar argumentos ni mapas de entrada.
- El umbral de dominio es `ITEM_MASTERY_TARGET = 80`.
- El decaimiento vencido es exponencial:
  `mastery * OVERDUE_RETENTION_PER_DAY ** overdueDays`, con retención `0.97`.
- Antes o exactamente en `dueDate` no hay decaimiento.
- Un nodo se domina solo si tiene al menos un ítem y todos sus ítems alcanzan
  el umbral con la maestría efectiva del instante consultado.
- Los prerrequisitos deben estar dominados para desbloquear dependientes.
- `maintenance` cuenta como dominado para el desbloqueo, pero no debe volver
  inmune al decaimiento.
- Un ítem nunca practicado tiene `lastReviewed` y `dueDate` nulos.
- La maestría efectiva se calcula al leer; el paso del tiempo no muta IndexedDB.
- El cargador rechaza ids duplicados, referencias inválidas, ciclos y contenido
  que no se pueda calificar.
- `nodesAtRisk(graph, itemStates, now, horizonDays)`: en riesgo = dominado en
  `now` y no dominado en `now + horizonDays` bajo decaimiento proyectado
  (`currentMastery` con el instante desplazado; nada se muta). «Ya cayó»
  (weakened) y «caerá» (at risk) son conjuntos disjuntos. Horizonte inclusivo
  con umbral estricto `< 80`; fraccionario válido; negativo o no finito lanza
  `RangeError`; resultado único en orden topológico.
- Lección del caso: `isNodeMastered` evaluaba la maestría en el `dueDate`
  almacenado del ítem y no en el `now` consultado, anulando el decaimiento.
  Cualquier derivación nueva debe recibir y usar el `now` del llamador; la
  suite `time-invariants.test.ts` rompe si esta clase de error reaparece.

## Reglas del caso práctico

- No modificar ninguna prueba existente.
- Primero agregar una prueba de regresión de comportamiento que falle en el
  repositorio recibido por la razón correcta.
- Mantener las 105 pruebas originales en verde.
- Hacer la corrección mínima y justificar cualquier cambio adicional.
- Verificar por separado: pérdida de dominio, estado oxidado, rebloqueo de
  dependientes y guía de prerrequisitos debilitados.
- Implementar en el motor:
  `nodesAtRisk(graph, itemStates, now, horizonDays)`.
- Definir y documentar antes de codificar cada caso de borde de `nodesAtRisk`;
  fijar cada decisión con una prueba.
- No consultar ni intervenir el sitio de producción.
- No ejecutar `npm audit fix`, actualizar dependencias ni reformatear archivos
  ajenos al cambio sin autorización explícita.
- No debilitar TypeScript ni omitir comprobaciones para lograr verde.

## Disciplina de trabajo

1. Leer la consigna y este archivo.
2. Inspeccionar código, pruebas e historial antes de proponer cambios.
3. Presentar diagnóstico, alcance, decisiones abiertas y plan; esperar
   aprobación antes de editar código.
4. Escribir una prueba observable del reporte; demostrar rojo.
5. Aplicar el cambio mínimo; demostrar verde.
6. Recorrer todos los comportamientos esperados y añadir pruebas nuevas donde
   falte evidencia, sin editar pruebas existentes.
7. Diseñar `nodesAtRisk` mediante una tabla de decisiones y pruebas de borde.
8. Ejecutar pruebas dirigidas, `npm test` completo y `npm run build`.
9. Revisar `git diff` y crear commits pequeños por cada estado verde.
10. Generar `BITACORA.md` al final desde Git, diffs y pruebas, no desde memoria.

## Criterio de finalización

El trabajo no está terminado solo porque la suite esté verde. Deben existir:

- prueba de regresión que se demostró roja antes del arreglo;
- corrección mínima y explicable;
- evidencia ejecutable para todos los comportamientos de la consigna;
- `nodesAtRisk` tipada, pura y cubierta en todos sus bordes documentados;
- 105 pruebas originales más todas las nuevas en verde;
- build limpio;
- commits comprensibles;
- `BITACORA.md` final, fiel y de máximo 900 palabras.
