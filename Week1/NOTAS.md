# NOTAS.md

## 1. Información general

* Proyecto: `ferreteria-pos`
* Estudiante: Juan Carlos Yanez
* Fecha de inicio: 21/07/2026
* Repositorio propio:https://github.com/jcyanez/LEClaudeCode_JuanCa_Cenfotec.git
* Versión de Node.js: v22.22.2
* Versión de npm: 10.9.7
* Versión de Claude Code: Claude Code (VSCode) — modelo Opus 4.8 (1M context)
* Sistema operativo: Windows 11 Home 10.0.26200

---

## 2. Preparación del entorno

### Acciones realizadas

1. Copié la carpeta del repositorio entregada por el profesor.
2. Abrí una terminal en la raíz del proyecto.
3. Verifiqué la instalación de Node.js y npm.
4. Verifiqué el funcionamiento de Claude Code.
5. Revisé los archivos principales del proyecto.
6. **No fue necesario instalar dependencias:** el proyecto no declara dependencias externas (solo usa Node y el módulo nativo `node:assert`); no existe `node_modules`.

### Comandos utilizados

```bash
node --version   # v22.22.2
npm --version    # 10.9.7
npm test
```

Otros comandos utilizados:

```bash
git status
git log --oneline -5
git diff
```

### Observaciones

* `npm install` no aporta nada en este proyecto porque no hay dependencias declaradas; se omitió intencionalmente.
* No se requieren variables de entorno ni archivos `.env`.
* Al escribir el archivo en Windows, Git advierte `LF will be replaced by CRLF`; es un aviso normal de fin de línea, sin impacto funcional.

---

## 3. Estado inicial de las pruebas

### Comando ejecutado

```bash
npm test
```

### Resultado inicial

* Total de pruebas: 3 (definidas en `test/test-carrito.js`)
* Pruebas exitosas: 1 (Caso 1)
* Pruebas fallidas: 1 visible (Caso 2). El Caso 3 (IVA) **no llegó a ejecutarse** porque el runner sin framework se detiene en el primer `assert` que falla.

### Prueba relacionada con el descuento por mayoreo

* Nombre de la prueba: "Caso 2 — descuento por mayoreo en un solo producto"
* Resultado esperado: `descuento === 150` (10% de 1500 = 15 uds × 100)
* Resultado obtenido: `descuento === 0`
* Mensaje de error: `AssertionError: Debería aplicar 10% de descuento por compra al por mayor de un producto` → `0 !== 150` (test-carrito.js:23)
* Causa identificada: la condición del descuento era `carrito.length > 10`, que mide el número de **líneas** del carrito, no las **unidades** de un producto. Con una sola línea de 15 unidades, `carrito.length` = 1, y el descuento nunca se activaba.

### Prueba relacionada con el IVA

* Nombre de la prueba: "Caso 3 — cálculo de IVA (nuevo requerimiento)"
* Resultado esperado: `iva === 1300` y `total === 11300` (subtotal 10000, sin descuento)
* Resultado obtenido: (no ejecutado en el estado inicial; el fallo del Caso 2 detenía la suite). `calcularTotal` no devolvía `iva`, por lo que habría fallado al leer `resultado.iva`.
* Mensaje de error: no visible inicialmente por la detención temprana de la suite.
* Causa identificada: el IVA del 13% no estaba implementado; el objeto de retorno no incluía `iva` ni lo sumaba al `total`.

### Otras pruebas

* Caso 1 (compra pequeña sin descuento): pasó correctamente desde el inicio.

---

## 4. Contexto entregado a Claude Code

Creé un archivo `CLAUDE.md` en la raíz del proyecto.

El archivo explicó:

* El propósito del sistema.
* Las reglas generales del proyecto.
* La metodología de diagnóstico antes de modificar (Fases 1 a 4).
* Las convenciones de código.
* Las reglas para cálculos financieros.
* La prohibición de modificar las pruebas.
* Los criterios de aceptación.
* El alcance de la auditoría de código, infraestructura y experiencia de usuario.

La restricción más importante entregada al asistente fue:

> Claude Code no debe modificar los archivos de pruebas ni reducir sus validaciones para hacer que las pruebas pasen.

---

## 5. Prompt inicial utilizado

```text
Actúa como un ingeniero de software sénior especializado en auditoría de código,
DevOps, pruebas automatizadas, reglas de negocio y experiencia de usuario.
Realiza una auditoría inicial (Fase 1: diagnóstico) del repositorio ferreteria-pos:
inspeccionar estructura, leer README/package.json/config, identificar stack, punto de
entrada, módulos, scripts, pruebas y dónde se implementan subtotal/descuento/IVA/total;
ejecutar npm test sin modificar archivos, analizar fallos y su causa raíz; revisar la
condición del descuento por mayoreo, la fórmula, el orden de cálculo, el IVA del 13% y
posibles problemas de tipos/decimales; evaluar calidad, pruebas, seguridad, dependencias
y UX; revisar git status. Entregar informe con resumen ejecutivo, arquitectura, resultado
de npm test, diagnóstico del descuento, diagnóstico del IVA, auditoría técnica y plan de
implementación. No modificar ningún archivo en esta fase.
```

### Resumen de la respuesta obtenida

Proyecto mínimo en JavaScript/Node (CommonJS), sin dependencias, con una sola función de
dominio y una suite de pruebas sin framework. Estado inicial en rojo a propósito: dos
defectos: (1) condición de descuento sobre la dimensión equivocada y (2) IVA no
implementado. El Caso 3 quedaba oculto por la detención temprana de la suite.

### Archivos identificados por Claude

* `src/carrito.js`: única función de dominio `calcularTotal(carrito)`; contiene subtotal, descuento y total.
* `test/test-carrito.js`: suite de pruebas (3 casos con `node:assert`); criterios de aceptación.
* `package.json`: metadatos y script `test`; sin dependencias.
* `README.md`: reglas de negocio (descuento por mayoreo e IVA del 13%).

### Causa raíz propuesta

* Descuento: `carrito.length > 10` (cuenta líneas) en lugar de evaluar `item.cantidad > 10` (unidades del producto).
* IVA: no existe; debe calcularse sobre el subtotal ya con descuento (13%) y sumarse al total.

---

## 6. Prompt utilizado para implementar

```text
Implementa ahora el plan propuesto respetando estrictamente CLAUDE.md.
Condiciones: no modificar pruebas; no actualizar/agregar dependencias; corregir la causa
raíz del descuento por mayoreo; implementar el IVA del 13% según el README; respetar el
orden de cálculo; cambio mínimo; evitar refactorizaciones no relacionadas; ejecutar npm
test tras cada cambio relevante; si una prueba falla, reanalizar la causa (no adaptar la
prueba); al terminar ejecutar npm test, git status y git diff; confirmar que las tres
pruebas pasan y que las pruebas no se modificaron. No hacer commit ni push.
```

### Cambios propuestos por Claude

1. Corregir la condición del descuento para evaluar `item.cantidad` por línea.
2. Implementar el IVA del 13% sobre la base (subtotal − descuento) y sumarlo al total.
3. Extraer constantes descriptivas (umbral, tasa de descuento, tasa de IVA).

### Cambios aceptados

1. Corrección del descuento por mayoreo (por producto/línea).
2. Implementación del IVA del 13% con el orden correcto de operaciones.

### Cambios rechazados o ajustados

* No se añadió redondeo (`Math.round`/`toFixed`) para no romper los `strictEqual` con enteros; se deja como recomendación pendiente.
* No se añadió validación de entradas para respetar el "cambio mínimo"; se documenta como riesgo/mejora futura.

---

## 7. Corrección del descuento por mayoreo

### Problema encontrado

El descuento del 10% no se aplicaba al comprar muchas unidades de un mismo producto.

### Causa raíz

La condición `if (carrito.length > 10)` evalúa la cantidad de líneas del carrito, no las unidades de un producto. Un carrito con una sola línea de 15 unidades tiene `length` = 1 y nunca activaba el descuento.

### Archivo modificado

`src/carrito.js`

### Solución implementada

Se evalúa el descuento **por línea** dentro del bucle: si `item.cantidad > UMBRAL_MAYOREO` (10), se acumula `importeLinea * TASA_DESCUENTO_MAYOREO` (0.10). Se introdujeron las constantes `UMBRAL_MAYOREO` y `TASA_DESCUENTO_MAYOREO`.

### Razón por la que la solución es correcta

Coincide con el README ("compran grandes cantidades de un mismo producto") y con el Caso 2 (15 uds × 100 = 1500 → descuento 150). El Caso 1 (líneas de 2 y 3 unidades) sigue sin descuento porque ninguna supera el umbral. El umbral es exclusivo (`> 10`).

---

## 8. Implementación del IVA del 13%

### Requerimiento del README

"El sistema debe calcular el IVA (13%) sobre el monto de la venta." El Caso 3 lo precisa: el IVA se calcula **sobre el subtotal ya con el descuento aplicado**.

### Fórmula implementada

```text
baseImponible = subtotal - descuento
iva           = baseImponible * 0.13
total         = baseImponible + iva
```

### Orden de las operaciones

1. Calcular subtotal (Σ precio × cantidad).
2. Aplicar descuento por mayoreo cuando corresponda (por línea).
3. Determinar la base imponible (subtotal − descuento).
4. Calcular el IVA (13% de la base imponible).
5. Calcular el total (base imponible + IVA).

### Archivo modificado

`src/carrito.js`

### Casos considerados

* Venta sin descuento (Caso 1 y Caso 3): IVA sobre el subtotal completo.
* Venta con descuento (Caso 2): IVA sobre subtotal − descuento.
* Cálculo del IVA: verificado con Caso 3 (10000 → iva 1300, total 11300).
* Valores límite: umbral exclusivo `> 10`.
* Manejo de decimales: sin redondeo (los casos dan enteros exactos).
* Entradas inválidas: fuera de alcance en esta iteración (ver riesgos).

---

## 9. Problemas y reintentos

### Intento 1

* Acción realizada: diagnóstico completo (Fase 1) sin modificar archivos + ejecución de `npm test`.
* Resultado: se identificaron las dos causas raíz; el Caso 3 quedaba oculto por la detención temprana de la suite.
* Problema: ninguno bloqueante; se dejó constancia de que son dos fallos, no uno.
* Corrección realizada: no aplica (solo diagnóstico).

### Intento 2

* Acción realizada: implementación en `src/carrito.js` (descuento por línea + IVA) y `npm test`.
* Resultado: los tres casos pasaron a la primera (exit 0).
* Problema: ninguno; no fueron necesarios reintentos.
* Corrección realizada: no aplica.

---

## 10. Qué funcionó correctamente

* Claude identificó correctamente la función responsable (`calcularTotal`) y el archivo exacto.
* El diagnóstico se realizó completo antes de modificar cualquier archivo.
* El cambio fue pequeño y localizado en un único archivo (`src/carrito.js`).
* Las pruebas detectaron correctamente ambos errores y sirvieron como criterio de aceptación.
* Se respetó la restricción de no tocar las pruebas ni las dependencias.

---

## 11. Qué tuve que corregir o reintentar

* Fue necesario aclarar la interpretación del descuento (por línea que supera 10 unidades vs. 10% global); se optó por la lectura por producto/línea, más fiel al README.
* No hubo propuestas incorrectas ni demasiado amplias; el alcance se mantuvo mínimo.
* No hubo errores persistentes tras el primer cambio: la suite pasó en el primer intento de implementación.

---

## 12. Verificación final

### Comando ejecutado

```bash
npm test
```

### Resultado final

* Total de pruebas: 3
* Pruebas exitosas: 3
* Pruebas fallidas: 0

Resumen del resultado:

```text
Caso 1 OK: compra pequeña sin descuento
Caso 2 OK: descuento por mayoreo en un solo producto
Caso 3 OK: cálculo de IVA (nuevo requerimiento)

Todas las pruebas pasaron.
```

### Revisión de Git

```bash
git status   # modificado: src/carrito.js ; sin seguimiento: CLAUDE.md, NOTAS.md, Docs/
git diff     # cambios únicamente en src/carrito.js
```

Verificaciones:

* [x] Las tres pruebas pasan.
* [x] Los archivos de pruebas no fueron modificados.
* [x] No se actualizaron dependencias.
* [x] No se agregaron cambios fuera del alcance.
* [x] El descuento por mayoreo funciona correctamente.
* [x] El IVA del 13% funciona según el README.
* [x] `CLAUDE.md` está incluido.
* [x] `NOTAS.md` está incluido.

---

## 13. Auditoría resumida

### Código

* Fortalezas: función pequeña y con una sola responsabilidad; constantes de negocio descriptivas; retorno claro (`subtotal`, `descuento`, `iva`, `total`).
* Debilidades: sin validación de entradas (`precio`/`cantidad` podrían ser `NaN`/`undefined`); sin política de redondeo definida para importes con decimales.

### Infraestructura y ejecución

* Node v22.22.2, npm 10.9.7; sin dependencias externas ni `node_modules`; reproducible en cualquier equipo con Node. No hay configuración de CI. Recomendable declarar `"engines"` en `package.json`.

### Buenas prácticas

* Se respetaron las convenciones existentes (CommonJS, español, 2 espacios, punto y coma). Sin duplicación ni abstracciones innecesarias. Falta manejo de errores/validaciones (fuera de alcance del ejercicio).

### Experiencia de usuario

* No hay interfaz de usuario (es una librería de cálculo). No aplica formato monetario; los valores se devuelven como números crudos.

### Seguridad

* Superficie de ataque nula: sin dependencias externas, sin entrada de red, sin secretos. `.gitignore` excluye `node_modules/`.

---

## 14. Confirmación de cambios

Antes del commit ejecuté:

```bash
git status
git diff
npm test
```

### Archivos modificados

* `CLAUDE.md` (contexto del proyecto — nuevo, sin seguimiento)
* `NOTAS.md` (bitácora — nuevo, sin seguimiento)
* `src/carrito.js` (implementación: descuento por mayoreo + IVA)

### Archivos de pruebas

Los archivos de pruebas no fueron modificados.

---

## 15. Commit y entrega

> Pendiente: aún no se ha realizado commit ni push (a la espera de autorización).

### Comandos utilizados (propuestos)

```bash
git add CLAUDE.md NOTAS.md src/carrito.js
git commit -m "Corrige descuento por mayoreo e implementa IVA"
git push origin main
```

### Identificador del commit

`[Pendiente — completar tras el commit]`

### Enlace del repositorio

[Pendiente — completar tras el push]

---

## 16. Conclusión

El ejercicio mostró el valor de diagnosticar antes de modificar: las pruebas actuaron como criterios de aceptación y revelaron dos defectos independientes (una condición sobre la dimensión equivocada y un requerimiento no implementado). El archivo `CLAUDE.md` sirvió como fuente de verdad y restricción (no tocar pruebas ni dependencias), lo que mantuvo el cambio mínimo y localizado. La corrección de causa raíz —evaluar la cantidad por producto y calcular el IVA sobre la base con descuento— resolvió los tres casos sin efectos colaterales.
