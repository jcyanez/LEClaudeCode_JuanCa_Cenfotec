# INFRA.md — Infraestructura del proyecto FretPath

## Qué es

PWA local de práctica de guitarra. Sin backend, sin autenticación, sin
servicios externos: todo corre en el navegador y el progreso persiste en
IndexedDB. La aplicación funciona offline mediante service worker.

## Stack tecnológico (versiones de `package.json`, bloqueadas en `package-lock.json`)

| Capa | Tecnología | Versión |
|---|---|---|
| Lenguaje | TypeScript (modo `strict`, ES2022, módulos ESNext) | ^5.8.3 |
| UI | React + React DOM | ^19.1.0 |
| Bundler/dev server | Vite + `@vitejs/plugin-react` | ^6.3.5 |
| Estilos | Tailwind CSS (plugin de Vite) | ^4.1.8 |
| Pruebas | Vitest (entorno `node`, descubre `src/**/*.test.ts`) | ^3.2.1 |
| Persistencia | Dexie (IndexedDB) + `dexie-react-hooks` | ^4.0.11 |
| PWA | `vite-plugin-pwa` (manifiesto, service worker, precache) | ^1.3.0 |
| Tipografía | `@fontsource/pirata-one` | ^5.2.8 |
| Gestor de paquetes | npm (usar `npm ci` para instalar) | — |

Dos entradas HTML: `index.html` (landing) y `app.html` (aplicación).

## Comandos

```bash
npm ci               # instalar dependencias exactas del lockfile
npm run dev          # servidor de desarrollo Vite
npm test             # suite completa (vitest run) — < 2 s
npm run test:watch   # vitest en modo watch
npm run build        # tsc --noEmit + build de Vite + PWA
npm run preview      # servir el build de producción
```

En Windows PowerShell, si la política de ejecución bloquea `npm.ps1`:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

## Arquitectura por capas

```
src/
├── engine/          Motor puro y determinista (la IP portable)
│   ├── types.ts     Contratos del dominio (timestamps = epoch ms)
│   ├── srs.ts       Repetición espaciada: intentos, vencimiento, decaimiento
│   ├── graph.ts     DAG: validación, dominio, estados, nodesAtRisk
│   ├── session.ts   Ensamblaje determinista de sesión por presupuesto
│   └── streak.ts    Rachas
├── data/            loader.ts + JSON de contenido (valida ids, ciclos, refs)
├── db/              Frontera Dexie/IndexedDB (el motor NO depende de esto)
├── sync/            Resolución determinista de conflictos
├── audio/           Metrónomo y tonos (Web Audio)
├── components/      UI React (SkillMap, PracticeSession, etc.)
└── App.tsx          Composición de la aplicación
```

Regla arquitectónica central: `src/engine/` es puro — sin React, sin Dexie,
sin APIs del navegador y sin reloj del sistema. El tiempo entra siempre como
parámetro `now` (epoch ms). La maestría efectiva se deriva al leer; el paso
del tiempo jamás muta IndexedDB.

Flujo de datos: UI entrega resultado + `now` → `db/repo.ts` llama al motor
SRS → persiste el ítem → rederiva estados de nodo desde grafo + ítems → la UI
rederiva de nuevo al renderizar con su propio `now`.

## Pruebas (131 en 10 archivos; las 105 originales intactas)

| Archivo | Pruebas | Cubre |
|---|---|---|
| `engine/srs.test.ts` | 20 | Decaimiento, intentos, programación SM-2 |
| `engine/graph.test.ts` | 19 | Validación DAG, dominio, cascada |
| `engine/session.test.ts` | 16 | Presupuesto, mezcla 70/20/10, elegibilidad |
| `engine/streak.test.ts` | 8 | Rachas |
| `data/loader.test.ts` | 25 | Validación de contenido |
| `sync/merge.test.ts` | 14 | Merge determinista (propiedades algebraicas) |
| `audio/metronome.test.ts` | 3 | Metrónomo |
| `engine/overdue-decay.regression.test.ts` | 7 | Regresión del caso + contrato de producto |
| `engine/nodesAtRisk.test.ts` | 13 | Tabla de decisiones de bordes |
| `engine/time-invariants.test.ts` | 6 | Invariantes temporales (clase de error) |

## Git y entrega

- Este directorio es un repo git **anidado** dentro del repo general del
  curso (`LEClaudeCode/` → `LEClaudeCode_JuanCa_Cenfotec` en GitHub); el repo
  general no rastrea estos archivos.
- `origin` apunta al repo del instructor
  (`andrescn20/fretPath-estudiantes`); los commits del caso son locales y no
  se ha hecho push.
- Identidad local del repo: `Juan Yanez <juanyanez.ine@gmail.com>`.
- Historial del caso sobre la línea base `f332319`:
  `8d0b3bd` (fix + regresión/contrato) → `cd891f1` (nodesAtRisk + bordes) →
  `f14655b` (bitácora) → `298a481` (invariantes temporales).
- La entrega del curso exige un enlace a repositorio con los commits:
  pendiente crear un repo propio en GitHub y hacer push del historial.

## CI/CD

No hay pipeline configurado. Verificación local: `npm test` + `npm run build`
(este último incluye el chequeo de tipos con `tsc --noEmit`). Ambos deben
quedar en verde antes de cada commit.
