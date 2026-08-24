# Caso Práctico 5 — Cancha Total F5

**El código de la entrega no está en esta carpeta: vive en su propio repositorio.**

👉 **https://github.com/jcyanez/cancha-total-f5**

El encargo era ponerle una red de pruebas a un sistema de reservas heredado, sin documentación y
sin el proveedor que lo escribió. La consigna exige entregar *el repositorio recibido con los
commits propios encima*, conservando el commit del proveedor (`65ce4b4`) — por eso ese historial
se publica aparte y no se aplana dentro de este repositorio del curso.

Ahí están la especificación reconstruida, la suite, los hallazgos, la puerta de calidad y la
refactorización, en **21 commits** que se leen como el relato del trabajo:

| | |
|---|---|
| **Punto de partida** | `65ce4b4`, el sistema tal como lo entregó el proveedor. No se toca. |
| **La red** | `ESPECIFICACION.md` con 61 condiciones y su fuente declarada, 71 pruebas, `HALLAZGOS.md`, `verificar.sh` y el hook `Stop`. Todo **antes** de tocar una línea del sistema. |
| **La refactorización** | 8 commits de estructura y 6 de comportamiento, nunca mezclados. |
| **Al terminar** | **87 pruebas en verde, ninguna marcada.** Los 6 hallazgos de comportamiento cerrados y las 10 deudas de estructura pagadas. |

Ningún hallazgo se cerró tocando su prueba: en cada cierre, lo único que cambió en el archivo de
pruebas fue quitarle la marca de fallo esperado. El detalle de cada uno, con la evidencia, está en
el `HALLAZGOS.md` de ese repositorio.

## Qué hay en esta carpeta

- [CLAUDE.md](CLAUDE.md) — cómo se trabaja el caso: fuente de verdad, orden de trabajo y restricciones.
- `Consigna Caso Practico 5 - SINT-732.docx` — el enunciado y la rúbrica.
- [capturas/](capturas/) — el sistema **antes** y **después** de la refactorización, con la
  herramienta que las genera. Son reproducibles: reloj congelado y base de datos propia, así que
  salen iguales corran el día que corran.

## Ver el hallazgo de un vistazo

El bloque de las 17:00 en la grilla de disponibilidad:

| Antes | Después |
|---|---|
| ![17:00 a ₡15.000](capturas/antes/04-grilla-bloque-17h.png) | ![17:00 a ₡20.000](capturas/despues/04-grilla-bloque-17h.png) |

Los bloques de las 16:00 y las 18:00 quedaron **idénticos byte a byte** entre las dos tandas de
capturas: el arreglo movió el borde de la tarifa, y nada más.

De las 13 capturas, **5 cambiaron y 8 quedaron idénticas byte a byte**. Las que cambiaron son las
que muestran el bloque de las 17:00 y las dos del formulario: registrar sin teléfono ahora se
rechaza, que es el hallazgo C-2. Las otras ocho no se movieron, y esa es justamente la prueba de
que la refactorización no rompió lo que ya funcionaba.

## Regenerar las capturas

```
cd capturas/herramienta
npm install
node capturar.js antes     # o: despues
```

Necesita el sistema clonado en `../../cancha-total/` con sus dependencias instaladas.
