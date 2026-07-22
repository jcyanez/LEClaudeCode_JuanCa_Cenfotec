# CLAUDE.md

## 1. Propósito del proyecto

Este repositorio contiene una aplicación de punto de venta para una ferretería, identificada como `ferreteria-pos`.

El sistema administra operaciones de venta y contiene reglas de negocio relacionadas, entre otros aspectos, con:

* Registro o procesamiento de ventas.
* Cálculo de subtotales.
* Aplicación de descuentos por mayoreo.
* Cálculo del impuesto al valor agregado, IVA, correspondiente al 13%.
* Cálculo del total final de una venta.
* Validación de estas reglas mediante pruebas automatizadas.

El objetivo del trabajo es diagnosticar el estado actual del proyecto, corregir el error existente en el descuento por mayoreo e implementar el cálculo de IVA descrito en el archivo `README.md`.

---

## 2. Fuente de verdad del proyecto

Antes de proponer o realizar cambios, se deben revisar obligatoriamente:

1. Este archivo `CLAUDE.md`.
2. El archivo `README.md`.
3. El archivo `package.json`.
4. Los archivos de pruebas.
5. Los módulos donde se encuentran las reglas de cálculo.
6. La estructura general del repositorio.

Las reglas funcionales descritas en el `README.md` y los resultados esperados por las pruebas deben utilizarse para comprender el comportamiento requerido.

Si existe una contradicción entre el código, el `README.md` y las pruebas, debe informarse claramente antes de realizar cambios.

---

## 3. Metodología obligatoria de trabajo

Claude Code debe trabajar en el siguiente orden:

### Fase 1: diagnóstico

Antes de modificar cualquier archivo:

1. Inspeccionar la estructura completa del repositorio.
2. Identificar el lenguaje, framework, librerías y herramientas utilizadas.
3. Leer el `README.md`.
4. Leer el `package.json` y sus scripts.
5. Localizar los archivos de pruebas.
6. Localizar la implementación del descuento por mayoreo.
7. Localizar el punto donde debe incorporarse el IVA del 13%.
8. Ejecutar `npm test`.
9. Analizar cada prueba fallida.
10. Identificar la causa raíz de cada fallo.

Durante esta fase no se debe modificar ningún archivo.

### Fase 2: propuesta

Antes de implementar cambios, presentar:

* Archivos que se propone modificar.
* Causa raíz del problema.
* Regla de negocio involucrada.
* Cambio mínimo necesario.
* Posibles efectos secundarios.
* Forma de comprobar la corrección.

### Fase 3: implementación

Después del diagnóstico:

1. Realizar únicamente los cambios necesarios.
2. Evitar refactorizaciones no relacionadas.
3. Mantener la interfaz pública de las funciones siempre que sea posible.
4. Respetar el comportamiento existente que no esté relacionado con el problema.
5. Ejecutar nuevamente las pruebas después de cada cambio relevante.

### Fase 4: verificación

Al finalizar:

1. Ejecutar `npm test`.
2. Confirmar que las tres pruebas finalizan exitosamente.
3. Revisar el diff de los cambios.
4. Confirmar que no se modificaron los archivos de pruebas.
5. Resumir los cambios realizados.
6. Indicar cualquier riesgo, limitación o supuesto pendiente.

---

## 4. Convenciones de código

Claude Code debe respetar las convenciones existentes en el repositorio.

Antes de introducir un estilo nuevo, debe observar cómo están escritos los archivos actuales.

Como reglas generales:

* Mantener nombres de variables y funciones claros y descriptivos.
* Respetar el idioma predominante utilizado en el código.
* Mantener funciones pequeñas y con una responsabilidad clara.
* Evitar duplicación innecesaria de lógica.
* No introducir abstracciones que no sean necesarias.
* No agregar dependencias para resolver operaciones simples.
* Mantener la estructura de carpetas existente.
* Respetar el formato, indentación, punto y coma y estilo actual.
* Evitar valores numéricos sin contexto cuando representen reglas de negocio.
* Utilizar constantes descriptivas cuando corresponda, por ejemplo para la tasa de IVA.
* No utilizar redondeos arbitrarios sin verificar primero las reglas del proyecto.
* Manejar correctamente valores numéricos, cantidades, precios, descuentos e impuestos.
* Conservar la compatibilidad con la versión de Node.js y las dependencias actuales.
* Añadir comentarios solamente cuando expliquen una decisión de negocio o una lógica que no sea evidente.

---

## 5. Reglas para cálculos financieros

Para cualquier cálculo relacionado con precios, descuentos e impuestos:

1. Verificar la regla exacta en el `README.md`.
2. Determinar el orden correcto de las operaciones.
3. Confirmar si el descuento se aplica antes o después del IVA.
4. Confirmar la condición exacta que activa el descuento por mayoreo.
5. Confirmar si los límites son inclusivos o exclusivos.
6. Verificar el tratamiento de decimales.
7. Evitar conversiones implícitas de texto a número.
8. Evitar errores producidos por valores `undefined`, `null` o `NaN`.
9. No asumir reglas que no estén respaldadas por el código, las pruebas o la documentación.

La tasa de IVA solicitada es del 13%, pero su implementación debe respetar la fórmula y el orden de cálculo indicados en el `README.md`.

---

## 6. Restricciones explícitas

### Claude Code NO debe modificar los archivos de pruebas.

Esto incluye:

* Cambiar resultados esperados.
* Eliminar pruebas.
* Omitir pruebas.
* Marcar pruebas como ignoradas.
* Reducir su nivel de validación.
* Cambiar datos de prueba para ocultar un error.
* Modificar la configuración para que una prueba deje de ejecutarse.

Las pruebas representan los criterios de aceptación del ejercicio y deben permanecer intactas.

Claude Code tampoco debe:

* Ejecutar `npm update` o actualizar dependencias sin autorización.
* Instalar nuevas dependencias sin justificarlo y solicitar autorización.
* Cambiar versiones de Node.js o del administrador de paquetes.
* Eliminar archivos del proyecto.
* modificar archivos ajenos al alcance del ejercicio.
* Realizar refactorizaciones masivas.
* Cambiar nombres públicos de funciones sin necesidad.
* Ejecutar comandos destructivos.
* Crear commits automáticamente.
* Hacer `push` al repositorio.
* utilizar `--force`.
* sobrescribir cambios existentes del estudiante.
* incluir secretos, credenciales o archivos sensibles en el repositorio.

---

## 7. Alcance del diagnóstico técnico

Además de corregir las reglas funcionales, se debe evaluar:

### Código

* Organización y legibilidad.
* Separación de responsabilidades.
* Duplicación.
* Complejidad innecesaria.
* Manejo de errores.
* Validación de entradas.
* Uso correcto de tipos y valores numéricos.
* Consistencia de nombres.
* Existencia de código muerto.

### Pruebas

* Cobertura de las reglas principales.
* Claridad de los casos probados.
* Casos límite no contemplados.
* Correspondencia entre pruebas, código y `README.md`.

Las pruebas no deben ser modificadas durante este ejercicio.

### Dependencias

* Dependencias declaradas.
* Dependencias aparentemente innecesarias.
* Scripts disponibles en `package.json`.
* Compatibilidad de versiones.
* Posibles riesgos evidentes.

No se deben actualizar dependencias durante esta actividad sin autorización.

### Infraestructura y ejecución

* Requisitos para ejecutar el proyecto.
* Versión esperada de Node.js.
* Administrador de paquetes utilizado.
* Variables de entorno requeridas.
* Archivos de configuración.
* Proceso de instalación.
* Proceso de pruebas.
* Posibilidad de reproducir la ejecución en otra computadora.
* Presencia o ausencia de configuraciones de integración continua.

### Seguridad

* Manejo de entradas del usuario.
* Exposición de información sensible.
* Secretos incluidos por error.
* Dependencias o configuraciones riesgosas.
* Uso inseguro de operaciones dinámicas.

### Experiencia de usuario

Si el proyecto contiene interfaz de usuario, revisar:

* Claridad de mensajes.
* Visualización de subtotal, descuento, IVA y total.
* Manejo de errores.
* Retroalimentación al usuario.
* Consistencia de formatos monetarios.
* Accesibilidad básica.
* Comportamiento ante datos inválidos.
* Facilidad para comprender el resultado de una venta.

---

## 8. Principio de cambio mínimo

La solución debe corregir la causa raíz mediante el cambio más pequeño, seguro y comprensible posible.

No se debe aprovechar el ejercicio para reescribir el proyecto completo.

Cada modificación debe poder relacionarse directamente con uno de estos objetivos:

1. Corregir el descuento por mayoreo.
2. Implementar el IVA del 13%.
3. Mantener o recuperar el funcionamiento de las tres pruebas.
4. Mejorar únicamente aquello que sea indispensable para cumplir los puntos anteriores.

---

## 9. Criterios de aceptación

El trabajo se considera terminado cuando:

* Se ejecutó el proyecto siguiendo sus instrucciones.
* Se ejecutó `npm test` antes de realizar cambios.
* Se diagnosticó la causa de las pruebas fallidas.
* Se corrigió el descuento por mayoreo.
* Se implementó el IVA del 13% según el `README.md`.
* Las tres pruebas finalizan exitosamente.
* Los archivos de pruebas permanecen sin modificaciones.
* El diff contiene únicamente cambios relacionados con el ejercicio.
* Se documentó el proceso en `NOTAS.md`.
* Los cambios quedaron preparados para que el estudiante realice el commit.
