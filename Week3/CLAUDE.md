# CLAUDE.md

## 1. Propósito del proyecto

Este repositorio contiene el diseño y, a partir de la Sesión 4, la construcción del sistema
de venta de entradas del **Cine Variedades**, identificado como `cine-variedades`.

El cine tiene dos salas (120 y 60 butacas), vende hoy solo en taquilla con cuaderno y mapa de
papel, y quiere vender por internet con selección de butaca desde el teléfono, sin perder la
venta en taquilla sobre el mismo mapa. El encargo original, sin resolver, está en `PROMPT.md`.

Este es un proyecto **de cero**: no hay código existente que diagnosticar ni pruebas previas que
corregir. El trabajo parte de una especificación y un diseño ya completos y se mueve hacia la
construcción.

---

## 2. Fuente de verdad del proyecto

Antes de proponer o realizar cualquier cambio, se deben revisar obligatoriamente, en este orden:

1. `PROMPT.md` — el encargo original de la dueña. Es el primer commit del repositorio y **no se
   modifica nunca**, ni siquiera para corregir su redacción.
2. `ESPECIFICACION.md` — qué debe hacer el sistema: glosario, objetivos, fuera de alcance, reglas
   del negocio (`RN-`), requisitos funcionales (`RF-`) y no funcionales (`RNF-`), qué queda
   registrado (`REG-`), criterios de aceptación (`CA-`). Es la referencia para *qué construir*.
3. `DISENO.md` — la forma de la solución: arquitectura de componentes, modelo de datos, flujo de
   datos, manejo de errores y las decisiones mayores ya tomadas con su justificación. Es la
   referencia para *cómo construirlo*.
4. `PLAN.md` — el plan de implementación por tareas (T0 a T22), con sus dependencias, qué puede
   ir en paralelo y el ciclo de cada sesión. Es la referencia para *en qué orden construirlo*.
   Cada tarea se desarrolla en su propia sesión y su casilla se marca al cerrarla.
5. Este archivo `CLAUDE.md` — cómo se trabaja en este repositorio.

Si en algún momento el código que se vaya a escribir contradice `ESPECIFICACION.md` o
`DISENO.md`, se informa la contradicción antes de resolverla. No se decide en silencio.

Cualquier cosa que `ESPECIFICACION.md` deje explícitamente fuera de alcance (sección **Fuera de
alcance**) sigue fuera de alcance salvo que el usuario tome y registre una decisión explícita en
ese mismo documento. No se reintroduce alcance por comodidad de implementación.

---

## 3. Estado del proyecto y qué se entrega en cada etapa

| Etapa | Qué produce | Estado |
|---|---|---|
| Entrevista y diseño (Caso Práctico 3) | `PROMPT.md`, `ESPECIFICACION.md`, `DISENO.md` | Completo |
| Plan de construcción (Sesión 4) | `PLAN.md` (tareas T0–T22); faltan la elección de stack (T0) y el esquema de base de datos (T2) | En curso |
| Construcción (sesiones siguientes) | Código del sistema, pruebas automatizadas, una tarea de `PLAN.md` por sesión | No iniciado |

El repositorio de la entrega de Caso Práctico 3 **no debe contener código**: la rúbrica del
curso exige exactamente los tres archivos de diseño. Ningún archivo de código se agrega a este
proyecto hasta que el usuario autorice explícitamente empezar la construcción, y esa autorización
se da sesión por sesión, no de una vez para todo el sistema.

---

## 4. Metodología obligatoria de trabajo

Se trabaja en fases estrictas. No se avanza a la fase siguiente sin que el usuario lo autorice.

### Fase 1: diagnóstico

Antes de proponer o escribir nada:

1. Releer `PROMPT.md`, `ESPECIFICACION.md` y `DISENO.md` completos.
2. Verificar que lo que se va a proponer no contradice ninguna regla del negocio (`RN-`) ni
   ninguna decisión ya tomada en `DISENO.md`.
3. Si el pedido del usuario roza una pregunta que `ESPECIFICACION.md` ya cerró, señalarlo en vez
   de reabrirla en silencio.

### Fase 2: propuesta

Antes de implementar cualquier cambio, presentar:

* Qué se propone (archivo, componente o decisión).
* Con qué `RN-`, `RF-`, `RNF-` o decisión de `DISENO.md` se relaciona.
* Alternativas consideradas, si las hay, con ventajas y desventajas.
* Qué queda pendiente de decidir por el usuario.

### Fase 3: implementación

Solo después de autorización explícita, y limitada a lo autorizado:

1. Ningún archivo de código se crea antes de que el usuario dé la orden de empezar a construir.
2. Cuando se autorice construir, seguir el orden de dependencias de `DISENO.md` (Ocupación →
   Cartelera → Venta → Salidas/Avisos/Operadores → Reloj → Entrada), sin adelantarse a componentes
   que dependen de otros aún no construidos.
3. No introducir reglas de negocio nuevas ni relajar las existentes para simplificar el código.
4. Cambio mínimo: no aprovechar una tarea para reescribir o reordenar partes no relacionadas.

### Fase 4: verificación

Al cerrar cualquier tarea:

1. Confirmar que el resultado es consistente con `ESPECIFICACION.md` y `DISENO.md`.
2. Si se escribió código, ejecutar sus pruebas y mostrar el resultado.
3. Revisar el diff y confirmar que no se tocó nada fuera del alcance de la tarea.
4. Actualizar `STATUS.md` (checklist de avance: qué se terminó, qué está en curso, qué sigue) y
   marcar la casilla de la tarea en `PLAN.md`.
5. Resumir qué se hizo y qué queda pendiente o abierto.

---

## 5. Convenciones

* Idioma español en toda la documentación, en los nombres de dominio (`Función`, `Butaca`,
  `Ocupación`) y en los mensajes de cara al operador o al comprador.
* Se respeta la terminología fijada en el glosario de `ESPECIFICACION.md`. No se introducen
  sinónimos nuevos para conceptos ya nombrados (por ejemplo, nunca «boleto» en vez de «entrada»).
* Toda decisión técnica nueva que no esté ya resuelta en `DISENO.md` (sección **Decisiones
  dejadas abiertas**) se documenta con sus alternativas y su razón, siguiendo el mismo formato que
  las «Decisiones mayores» y «Otras decisiones» de ese archivo.
* Los identificadores de reglas y requisitos (`RN-`, `RF-`, `RNF-`, `REG-`, `CA-`) se citan
  explícitamente al justificar cualquier pieza de diseño o de código.

---

## 6. Restricciones explícitas

Claude Code NO debe:

* Escribir código de la aplicación sin autorización explícita del usuario para esa tarea puntual.
* Modificar `PROMPT.md` bajo ninguna circunstancia.
* Modificar `ESPECIFICACION.md` o `DISENO.md` sin que el usuario apruebe el cambio sección por
  sección, como se hizo al producirlos originalmente con la skill `escribir-diseno`.
* Reabrir como pregunta algo que `ESPECIFICACION.md` ya registra como decidido, salvo que el
  usuario señale explícitamente que quiere reconsiderarlo.
* Ampliar el alcance más allá de lo que dice la sección **Fuera de alcance** de
  `ESPECIFICACION.md`.
* Elegir por su cuenta el motor de base de datos, el lenguaje, el framework o el proveedor de
  correo: son decisiones que `DISENO.md` deja abiertas para quien implemente, y se toman con el
  usuario, no en su nombre.
* Hacer commit o `push` sin que el usuario lo pida explícitamente.
* Incluir secretos, credenciales o archivos sensibles en el repositorio.
* Ejecutar comandos destructivos o `--force`.

---

## 7. Criterios de aceptación de esta etapa

El trabajo de la etapa actual (plan de construcción) se considera terminado cuando:

* Existe un plan de desarrollo concreto, por fases, coherente con la arquitectura de `DISENO.md`.
* El plan propone un stack tecnológico con alternativas y su justificación, pendiente de
  aprobación del usuario.
* El esquema de base de datos deriva sin contradicciones del modelo de datos de `DISENO.md`.
* No se creó ningún archivo de código.
* Quedó claro qué decisiones siguen abiertas y quién las toma.

---

## 8. Diseño de interfaz (UI/UX) — decisiones del usuario

**Decisión vigente, tomada por el usuario el 15 de agosto de 2026:**

* **El sistema visual es propio, guiado por la skill `ui-ux-pro-max`.** Sale de su entrada
  `Theater/Cinema`: estilo «Dark Mode (OLED) + Motion-Driven», paleta «dramatic dark + spotlight
  gold» y tipografía Inter. Se aplica en **dos temas sobre los mismos tokens** —oscuro para la web
  del comprador, claro y funcional para taquilla y puerta—, porque la skill trata a esos dos
  públicos como productos distintos. Los tokens y los ajustes de contraste están en
  `entrada-cliente/src/estilos/tokens.scss`; la decisión, registrada en `DISENO.md`.
* **Esto reemplaza la decisión del 11/08**, que era usar Carbon Design System de IBM. La migración
  va **por etapas**: la web pública ya no usa `@carbon/react`; taquilla, puerta y administración
  siguen con él hasta completarse la etapa 2. Mientras tanto, ambos sistemas conviven a propósito.
* **La aplicación se desarrolla como PWA** (Progressive Web App): instalable desde el teléfono,
  con `manifest` y `service worker`. Esto no reintroduce alcance fuera de `ESPECIFICACION.md`
  (sin funcionamiento offline para la venta: una caída se asume como pérdida, `RNF-3`).

> **Skill obligatoria para trabajo de UI/UX:** este repositorio tiene instalada la skill
> **`ui-ux-pro-max`** (en `.claude/skills/ui-ux-pro-max/`, de `nextlevelbuilder/ui-ux-pro-max-skill`).
> Debe invocarse **antes** de diseñar, construir o revisar cualquier pantalla, componente,
> elección de color/tipografía/layout, accesibilidad o animación — en particular durante la fase
> de construcción de **Entrada**. Sus prioridades 1 y 2 (accesibilidad y objetivos táctiles) son
> de cumplimiento obligatorio en el mapa de butacas del teléfono.

Ambas decisiones están registradas en `DISENO.md` («Otras decisiones»), con sus alternativas y su
razón, aprobadas por el usuario el 15 de agosto de 2026.
