---
name: escribir-diseno
description: Use when the user wants to design and document a new system or feature from scratch — runs a guided requirements-and-design session and produces two files, ESPECIFICACION.md (what the system must do) and DISENO.md (what shape the solution has). Triggers on "diseñar", "especificar", "escribir el spec", "documento de diseño", or when a raw idea needs to become implementation-ready documentation before any code exists.
---

# Escribir especificación y diseño

De una idea cruda a documentación lista para implementar: una especificación cuando los
requisitos están claros, y un diseño cuando el diseño está aprobado. Dos archivos, en ese
orden, sin escribir código.

**Anunciar al arrancar:** «Estoy usando la habilidad escribir-diseno para producir la
especificación y el diseño.»

---

## Proceso

1. Explorar el contexto del proyecto: archivos, documentos, commits recientes
2. Evaluar el tamaño del encargo (ver más abajo) y descomponerlo si hace falta
3. Hacer las preguntas de clarificación —una por mensaje— incluidas las obligatorias
4. **PUNTO DE CONTROL 1:** escribir `ESPECIFICACION.md`, revisarla y someterla a revisión
5. Resolver con el usuario todas las preguntas abiertas
6. Proponer dos o tres enfoques con sus compensaciones y una recomendación
7. Clasificar las decisiones de diseño en mayores y menores
8. Para cada decisión **mayor**: presentar la comparación lado a lado y obtener aprobación
9. Presentar las secciones restantes del diseño; revisar hasta que se aprueben
10. **PUNTO DE CONTROL 2:** escribir `DISENO.md`, revisarlo y someterlo a revisión

**Después de escribir la especificación:** recorrer con el usuario cada pregunta abierta antes
de proponer enfoques. Las que se resuelvan se incorporan al requisito que corresponda y se
eliminan de la tabla.

**Las que no se puedan resolver se quedan.** Que el usuario no sepa algo es información, no un
obstáculo: nadie tiene todas las respuestas al empezar. Una pregunta abierta nunca bloquea el
proceso. Si el diseño necesita una respuesta para poder avanzar, se toma una **decisión
provisional**, se marca como provisional, se liga al número de la pregunta y se anota qué se
hace mientras no se resuelva.

**Estado terminal:** el archivo de diseño escrito y revisado. NO invocar ninguna habilidad de
implementación, ni escribir código, ni crear andamiaje de proyecto. El plan de implementación
queda fuera de esta habilidad.

---

## Ningún encargo es demasiado simple para tener diseño

Todo pasa por este proceso: una lista de tareas, una utilidad de una sola función, un cambio de
configuración. Los encargos que parecen simples son donde los supuestos que nadie examinó
cuestan más trabajo perdido. El diseño puede ser corto —unas pocas frases si de verdad es
simple— pero hay que presentarlo y hacerlo aprobar.

## Evaluar el tamaño antes de preguntar en detalle

Si el encargo describe varios subsistemas independientes —«una plataforma con chat,
almacenamiento de archivos, facturación y reportes»— hay que señalarlo de inmediato, antes de
gastar preguntas refinando detalles de algo que primero hay que partir.

En ese caso: ayudar a descomponerlo en subproyectos —cuáles son las piezas independientes, cómo
se relacionan, en qué orden conviene construirlas— y después trabajar el primero por el flujo
normal. Cada subproyecto tiene su propio ciclo de especificación y diseño.

---

## Preguntas de clarificación obligatorias

Además de las preguntas propias del caso, hay que cubrir estos cinco temas. Las preguntas están
redactadas para que las pueda contestar quien conoce el negocio, sin saber nada de software: no
piden clasificar ni estimar nada, piden hechos.

**Lo que sigue es un inventario de lo que hay que cubrir, no un mensaje para enviar.** Cada
tema agrupa varias preguntas; se hacen de a una, intercaladas en la conversación, y nunca como
cuestionario.

**1. Lo que se va a querer saber después**

> «Dentro de un año, ¿qué va a querer saber sobre lo que pasó? Nombre tres cosas que le
> gustaría poder consultar.»
>
> «Y de lo que ocurre en cada operación, ¿qué se puede olvidar sin que a nadie le importe?»

**2. Quién más recibe información**

> «Hoy, ¿a quién le pasa información sobre esto? Piense en personas y oficinas, no en sistemas:
> contabilidad, un proveedor, una jefatura, una entidad que lo exige por ley.»
>
> «¿Qué le manda exactamente, en qué forma se lo manda y cada cuánto?»

**3. Lo que pasa cuando algo sale mal**

> «¿Qué pasa si alguien intenta hacer esto y ya es tarde, o ya no está disponible?»
>
> «¿Qué pasa si se interrumpe a mitad?»
>
> «¿Qué pasa si lo hacen dos veces por error?»
>
> «¿Y si hay que deshacerlo cuando ya estaba terminado? ¿Quién puede deshacerlo?»

**4. Lo que todos saben y nadie escribió**

> «Si mañana entra alguien nuevo a trabajar ahí, ¿qué le tendría que explicar en la primera
> semana para que no meta la pata?»

Todo lo que salga de esa respuesta es una regla del negocio y va enunciada en la especificación.

**5. Tamaño y disponibilidad**

> «¿Cuánta gente va a estar usando esto al mismo tiempo, en el peor momento?»
>
> «¿Cuántas operaciones por día, más o menos?»
>
> «¿Qué pasa si el sistema se cae una hora?»

Solo se registran como requisitos no funcionales los que el caso tenga de verdad. Si la
respuesta es «no importa», eso también es una respuesta y se anota.

---

## Cómo conducir la conversación

- Una sola pregunta por mensaje. Si un tema necesita más exploración, se parte en varias.
- Preferir opción múltiple cuando se pueda; abierta cuando haga falta.
- Al proponer enfoques: dos o tres, con sus compensaciones, encabezando con el recomendado y la
  razón.
- **Recortar sin piedad.** Quitar de cada enfoque y de cada diseño todo lo que no haga falta
  todavía. Un agente tiende a agregar lo que parece razonable, y lo razonable suele ser más de
  lo necesario.
- Al presentar el diseño: por secciones, cada una del tamaño de su complejidad —unas frases si
  es directo, hasta unas trescientas palabras si tiene matices— preguntando después de cada una
  si va bien.

## Diseñar para que las partes se entiendan por separado

Partir el sistema en unidades con un propósito claro, que se comuniquen por interfaces
definidas y que se puedan entender y probar de forma independiente. Para cada unidad hay que
poder contestar tres cosas: qué hace, cómo se usa, y de qué depende.

Dos pruebas para saber si los límites están bien puestos:

- ¿Se entiende qué hace una unidad sin leer lo que tiene adentro?
- ¿Se puede cambiar lo de adentro sin romper a quien la usa?

Si alguna de las dos falla, los límites necesitan trabajo. Y una regla al dividir: **agrupar por
responsabilidad, no por capa técnica.** Lo que cambia junto conviene que viva junto.

## Cuando el proyecto ya existe

Explorar la estructura actual antes de proponer cambios, y seguir los patrones que ya están.
Donde el código existente tenga problemas que afecten al trabajo —un archivo que creció
demasiado, límites difusos, responsabilidades mezcladas— incluir mejoras puntuales como parte
del diseño. No proponer reorganizaciones ajenas al objetivo.

---

## Decisiones mayores y menores

### Qué hace que una decisión sea mayor

Una decisión es **mayor** si elegir distinto cambiaría de forma significativa la solución en
alguna de estas dimensiones:

- **Experiencia de uso** — la gente interactúa con el sistema de otra manera.
- **Rendimiento** — diferencia medible en tiempo de respuesta o en consumo de recursos a escala.
- **Infraestructura** — exige servicios, almacenamiento o dependencias adicionales.
- **Forma arquitectónica** — cambia cómo están estructuradas o acopladas las partes, o cómo se
  podrá extender el sistema después.
- **Complejidad operativa** — carga distinta para desplegar, monitorear o atender incidentes.

**Regla práctica:** si alguien preguntaría «¿por qué se fue con X y no con Y?», es mayor.

### Cómo se trata cada tipo

| Tipo | Cómo se presenta |
|---|---|
| **Mayor** | Sección de comparación detallada en la conversación (plantilla abajo); la opción elegida entra en `Decisiones mayores` del documento de diseño |
| **Menor** | Una fila en la tabla resumen `Otras decisiones` |

### Presentar una decisión mayor

Una decisión por mensaje. No agrupar varias decisiones mayores en un mismo mensaje.

```
### Decisión: [nombre corto]

**Por qué es una decisión mayor:**
[una o dos frases sobre qué cambia según la elección]

**Opción A — [nombre]**
- Qué es: [una frase]
- Experiencia de uso: [cómo interactúa la gente]
- Rendimiento: [impacto a escala]
- Recursos: [infraestructura o dependencias adicionales]
- Complejidad: [carga de implementación y de operación]
- Riesgo: [qué puede salir mal]

**Opción B — [nombre]**
[misma estructura]

**Opción C — [nombre]** (si aplica)
[misma estructura]

**Recomendación:** opción [X] — [una frase que la ate a un requisito concreto]
```

Obtener aprobación explícita del usuario antes de pasar a la decisión o sección siguiente.

---

## Revisión de cada documento escrito

Después de escribir cada uno de los dos archivos, revisarlo con ojos nuevos y corregir sobre la
marcha. Cuatro pasadas:

1. **Marcadores sin llenar.** Ningún «por definir», «pendiente», sección vacía ni requisito
   vago. Si quedó alguno, resolverlo o convertirlo en pregunta abierta con responsable.
2. **Consistencia interna.** Que ninguna sección contradiga a otra. Que el mismo concepto no
   aparezca con dos nombres. Que la arquitectura corresponda a los requisitos enunciados.
3. **Ambigüedad.** Que ningún requisito se pueda interpretar de dos maneras distintas. Si se
   puede, elegir una y dejarla explícita.
4. **Alcance.** Que lo escrito siga correspondiendo a lo que se pidió, y que alcance para un
   solo plan de implementación sin necesitar descomposición.

Corregir en el propio archivo. No hace falta volver a revisar después de corregir.

### Compuerta de revisión del usuario

Con el archivo ya corregido, pedirle al usuario que lo lea antes de continuar:

> «Escribí `<archivo>`. Revisalo y decime si querés cambiar algo antes de seguir.»

Esperar la respuesta. Si pide cambios, hacerlos y volver a correr la revisión. Continuar solo
con la aprobación.

El documento escrito casi nunca coincide del todo con lo que se aprobó de palabra, y esta
compuerta es la única oportunidad de detectar la diferencia.

---

## Ubicación de los archivos

Los dos archivos van en la raíz del repositorio:

```
ESPECIFICACION.md
DISENO.md
```

Si el repositorio ya tiene archivos con esos nombres, preguntar antes de sobrescribirlos.

No hacer commit por cuenta propia: guardar los archivos y dejar que el usuario decida cuándo y
cómo los registra en el historial.

---

## Las plantillas no son formularios

Las dos plantillas que siguen son un inventario de lo que **puede** hacer falta. Una sección que
no tiene nada que decir se borra: no se rellena con «no aplica» ni con una frase de compromiso.
Las secciones marcadas *(si aplica)* existen solo cuando el caso las tiene.

Un documento largo porque el problema es grande está bien. Un documento largo porque la
plantilla tenía muchas secciones, no. El tope sigue siendo que se lea en quince minutos.

---

## Punto de control 1 — Especificación

**Se dispara:** cuando están contestadas todas las preguntas de clarificación, antes de
recorrer las preguntas abiertas.

```markdown
# Especificación: <nombre del sistema>

## Resumen
Una o dos frases: qué es y por qué se necesita.

## Glosario
Un término por concepto, con su definición. Gana el término que usa el negocio. Si el mismo
concepto aparece con dos nombres en la conversación, elegir uno y dejar constancia del
descartado.

| Término | Definición |
|---|---|

## Objetivos
- Lista de lo que el sistema debe lograr.

## Fuera de alcance
- Lista explícita de lo que el sistema no va a hacer.

## Reglas del negocio
Enunciados que se puedan comprobar como ciertos o falsos. Incluye las que nadie enunció y
salieron de las preguntas de clarificación.

1. RN-1: ...

## Qué queda registrado
Qué información se guarda de cada operación, y qué preguntas se van a poder contestar más
adelante gracias a eso.

1. REG-1: ...

## Salidas que consume alguien más *(si aplica)*
| Quién | Qué recibe | Formato | Frecuencia |
|---|---|---|---|

## Recorridos
El recorrido que termina bien, y los que no. Cada uno como una secuencia de pasos.

## Requisitos funcionales
1. RF-1: ...

## Requisitos no funcionales *(si aplica)*
Solo los que el caso tenga de verdad: volumen de datos, usuarios simultáneos, disponibilidad.
Si la respuesta fue «no importa», no se inventa un número.

1. RNF-1: ...

## Criterios de aceptación *(si aplica)*
Solo para los requisitos cuya forma de comprobarlos no se deduce del enunciado. Un requisito
bien escrito ya dice cómo se comprueba, y repetirlo en una tabla no agrega nada.

| ID | Criterio | Requisito asociado |
|---|---|---|
| CA-1 | ... | RF-1 |

## Dependencias *(si aplica)*
- Sistemas externos, bibliotecas u otras especificaciones necesarias.

## Preguntas abiertas
Lo que no se sabe del negocio. No bloquean nada: cada fila declara qué se hace mientras no
haya respuesta.

| # | Pregunta | Qué se hace mientras no se resuelva |
|---|---|---|
| PA-1 | ... | ... |

*Las preguntas resueltas se convierten en requisitos o reglas y se eliminan de esta tabla.
Si la resolución exige elegir una tecnología, acá va únicamente el requisito; la elección de
tecnología va en el diseño.*

## Referencias *(si aplica)*
- Documentación y referencias de API consultadas, con su dirección web.
- Ubicaciones de código que informaron alguna decisión.
- Especificaciones o decisiones relacionadas.
```

---

## Punto de control 2 — Diseño

**Se dispara:** después de que el usuario aprueba el diseño completo.

```markdown
# <nombre del sistema> — Diseño

## Panorama de la arquitectura
[Dos o tres párrafos sobre la arquitectura general y cómo encajan las partes]

## Componentes

Para las decisiones no triviales dentro de un componente, presentar las opciones consideradas
con sus ventajas y desventajas antes de enunciar la recomendación.

### Componente 1: [nombre]
**Propósito**: [qué hace, en una o dos frases]

**Responsabilidades**:
- [Responsabilidad 1]
- [Incluir acá el contexto de despliegue, la superficie de API y las entradas y salidas
  principales. Agregar una sección aparte de interfaces solo si el componente expone una API
  pública formal.]

**Límite con el resto**: qué sabe de otros componentes, en qué dirección, y qué promete a quien
lo consume. Un límite que no está escrito no restringe a nadie.

**Limitaciones** *(opcional)*:
- [Compensaciones aceptadas o huecos conocidos del enfoque elegido. Omitir si no hay.]

### Componente 2: [nombre]
[misma estructura]

## Modelo de datos
Qué entidades existen, cómo se relacionan, y qué se guarda de cada una. Debe poder contestarse,
leyendo esta sección, cada una de las preguntas listadas en `Qué queda registrado` de la
especificación.

## Flujo de datos *(si aplica)*
[Cómo se mueve la información por el sistema. Diagramas de texto o tablas. Omitir si el
panorama de la arquitectura ya lo deja claro.]

## Manejo de errores
Qué ocurre cuando algo falla: qué se le informa a quien está usando el sistema, qué queda
registrado, y qué se reintenta o se revierte. Debe cubrir cada recorrido que termina mal de la
especificación.

## Decisiones mayores

<!-- Solo decisiones que cambiarían de forma significativa la experiencia de uso, el
     rendimiento, los recursos o la arquitectura. Las menores van en la tabla de abajo. -->

### [nombre de la decisión]

**Por qué es una decisión mayor:** [impacto]

| | Opción A: [nombre] | Opción B: [nombre] |
|---|---|---|
| **Experiencia de uso** | ... | ... |
| **Rendimiento** | ... | ... |
| **Recursos** | ... | ... |
| **Complejidad** | ... | ... |
| **Riesgo** | ... | ... |

**Elección:** opción [X] — [razón atada a un requisito]

---

## Otras decisiones
<!-- Solo decisiones menores. Las mayores van en la sección anterior. -->
Cada fila debería poder rastrearse a un requisito que satisface.

| Decisión | Opciones consideradas | Elección | Razón |
|---|---|---|---|

## Decisiones dejadas abiertas
Decisiones **de la solución** que se dejaron sin cerrar a propósito, para que quien implemente
sepa que le corresponden. No repetir acá las preguntas abiertas de la especificación: esas son
cosas que no se saben del negocio y viven allá. Si una decisión provisional se tomó por causa de
una de ellas, referenciarla por su número en vez de reescribirla.

| Qué no se decidió | Quién lo decide y cuándo |
|---|---|

## Registro de cambios *(si aplica)*
Omitir en la primera versión del documento.

| Fecha | Resumen |
|---|---|
```

---

## Reglas duras

- **La especificación describe requisitos; el diseño describe soluciones.** Los requisitos
  funcionales enuncian qué debe hacer el sistema y qué restricciones debe cumplir, no con qué
  tecnología, protocolo o herramienta se cumplen. La elección de tecnología va en el diseño,
  donde se pueden evaluar alternativas.
- **Escribir la especificación antes de proponer enfoques**, y recorrer las preguntas abiertas
  antes de proponer. **Una pregunta abierta sin respuesta no bloquea nada:** se queda anotada
  con lo que se hace mientras tanto, y si el diseño la necesita se toma una decisión provisional
  marcada como tal.
- **Una pregunta por mensaje**, y una decisión mayor por mensaje. Los temas obligatorios son un
  inventario de lo que hay que cubrir, no bloques de preguntas para enviar juntos.
- **Las plantillas no son formularios.** Una sección sin nada que decir se borra. Un documento
  largo por la complejidad del problema está bien; largo por rellenar plantilla, no.
- **Clasificar cada decisión de diseño** antes de escribir el archivo de diseño. Las mayores
  llevan comparación detallada; las menores van directo a la tabla resumen.
- **Escribir el archivo de diseño solo después de que el diseño esté aprobado**, y someter cada
  archivo escrito a la revisión de cuatro pasadas y a la compuerta del usuario.
- **Documentos concisos, legibles en quince minutos.** Cortar relleno; omitir secciones vacías.
- **Diagramas de texto o tablas.** Nada cuyo significado dependa de una herramienta de render
  para poder leerse, y ningún diagrama tan grande que deje de entenderse de un vistazo.
- **Código fuente en los documentos solo como último recurso**, cuando la prosa, un diagrama o
  el pseudocódigo no alcancen. Las firmas de API públicas siempre están permitidas.
- **Las referencias citan lo que efectivamente se consultó** —direcciones web, rutas del
  repositorio, nombres de funciones—, no «documentación relacionada».
- **Las preguntas abiertas resueltas se convierten en requisitos.** Nunca dejar una pregunta
  marcada como resuelta en la tabla.
- **No hacer commit por cuenta propia.**
- **No se escribe código, no se crea andamiaje, no se invoca ninguna habilidad de
  implementación.** El estado terminal es el archivo de diseño escrito y revisado.
