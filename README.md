# FretPath

Aplicación de práctica de guitarra guiada por un árbol de habilidades.

El usuario elige una meta y la app decide **qué** estudiar a continuación (un
grafo dirigido acíclico de habilidades) y **cuándo** repasarlo (un motor de
repetición espaciada). El camino incluido es *Metal*, con 42 nodos.

No hay backend ni cuenta de usuario: el progreso vive en IndexedDB (Dexie) y
funciona sin conexión.

## Correrlo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas unitarias del motor (Vitest)
npm run build      # verificación de tipos + build de producción
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/engine/` | El motor: grafo de habilidades, repetición espaciada, armado de sesión, rachas |
| `src/data/` | Cargador de contenido y los JSON del camino de Metal |
| `src/db/` | Persistencia sobre Dexie (IndexedDB) |
| `src/sync/` | Núcleo de resolución de conflictos para sincronización entre dispositivos |
| `src/audio/` | Metrónomo y generación de tonos |
| `src/components/` | Interfaz en React |

El motor es puro y determinista: no hace E/S y no llama a `Date.now()` por su
cuenta — el tiempo siempre entra como parámetro. Por eso se puede probar.
