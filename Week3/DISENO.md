# Sistema de venta de entradas del Cine Variedades — Diseño

Este documento describe la forma de la solución para los requisitos de `ESPECIFICACION.md`.
Los códigos entre paréntesis remiten a ese documento: `RN-` reglas del negocio, `RF-` requisitos
funcionales, `RNF-` requisitos no funcionales, `REG-` qué queda registrado, `CA-` criterios de
aceptación.

## Panorama de la arquitectura

El sistema es **un solo servicio web con una base de datos relacional**. Ese único servicio
atiende tanto a quien compra desde el teléfono como a la dueña, la taquilla y la puerta; no hay
procesos separados por audiencia. El mapa de butacas que ve el comprador se refresca por sondeo
cada pocos segundos mientras lo tiene a la vista, sin conexiones permanentes.

La elección responde a dos requisitos que se leen juntos: `RNF-1` pide sostener 200 personas
simultáneas en el peor momento, y `RNF-3` declara que una caída de una hora se asume como
pérdida. Un cine de dos salas con ese par de exigencias no justifica ni empujar cambios en vivo
al navegador ni repartir el sistema en varios despliegues. Los límites entre partes se declaran
igual de fuerte, pero **como componentes dentro de un mismo programa**, no como servicios
separados.

Por dentro, el servicio se divide en **siete componentes de dominio y una capa de entrada**,
agrupados por responsabilidad y no por capa técnica. Las dependencias van en una sola dirección y
no forman ciclos:

```
Entrada     → Operadores, Cartelera, Ocupación, Venta, Salidas
Reloj       → Venta, Salidas
Salidas     → Venta, Cartelera, Avisos
Venta       → Cartelera, Ocupación, Avisos
Cartelera   → Ocupación
Ocupación   → (nada)
Avisos      → (nada)
Operadores  → (nada)
```

**Ocupación no conoce a nadie, y nadie conoce ni a Entrada ni al Reloj.** Esas puntas son las que
permiten probar cada componente con el de abajo simulado, y son las que hay que defender cuando el
sistema crezca: la tentación habitual es que Ocupación empiece a saber qué es una compra, que un
componente de dominio se ponga a mirar el reloj por su cuenta, o que una regla del negocio se
escriba en la capa de entrada porque ahí es más rápido.

El punto de mayor tensión del sistema está concentrado a propósito en un solo lugar: la tabla de
ocupación, con una **restricción de unicidad sobre (función, butaca)**. Ahí es donde se cumple
`RNF-4` —dos personas nunca se quedan con la misma butaca—, y se cumple por el motor de base de
datos, no por código que haya que acordarse de escribir bien.

## Componentes

### Ocupación

**Propósito**: llevar qué butacas de qué funciones están tomadas, y por qué.

**Responsabilidades**:
- Dueño único de la tabla de ocupación. Nadie más la escribe.
- Tomar butacas para un bloqueo, una reserva o una venta, con su instante de vencimiento cuando
  corresponda (`RN-17` a `RN-20`).
- Liberar butacas al anular, al cancelar una función o al no convertirse una reserva.
- Descartar las vencidas: ignorarlas al leer, borrarlas antes de insertar sobre la misma butaca,
  y borrar las que queden cuando Venta le pide el barrido.
- Responder qué butacas de una función están tomadas.

**Qué promete a quien lo usa**:
- **O toma todas las butacas pedidas, o ninguna.** Nunca deja un grupo a medias, sin importar
  cuántas butacas tenga (`RN-22`).
- Si rechaza, dice **cuáles** butacas se le adelantaron.
- Una butaca vencida se comporta como libre desde el instante exacto en que vence, sin esperar a
  ningún proceso de fondo.

**Límite con el resto**: no sabe qué es una compra, una reserva ni un precio. Guarda a qué
apunta cada fila, pero nunca lo interpreta. **Tampoco sabe qué butacas tiene una sala**: devuelve
solo las tomadas de una función, y el mapa completo lo arma quien lo va a mostrar cruzándolo con
la lista de butacas de Cartelera. Ese recorte es lo que evita el ciclo entre los dos componentes.
Ocupación **devuelve siempre el motivo real** de cada butaca tomada; colapsarlo en «no disponible»
para el mapa público (`RN-56`) es decisión de Entrada, no suya.

**Limitaciones**: la fila de un bloqueo vencido que nadie vuelve a pedir queda en la tabla hasta
que pase el barrido. Es basura, no un error: no bloquea ninguna venta, porque la operación que
pide esa butaca la borra en el camino.

### Cartelera

**Propósito**: qué se proyecta, dónde, cuándo y a qué precio.

**Responsabilidades**:
- Películas con su duración, y las dos salas con sus 180 butacas fijas: Sala 1 con las filas A a J
  de 12 butacas, Sala 2 con las filas A a F de 10 (`RN-1`, `RN-2`, `RN-4`).
- Semanas de cartelera de jueves a miércoles, con su apertura de venta (`RN-3`, `RN-8`, `RN-9`).
- Funciones, y la validación del margen de 20 minutos entre funciones de la misma sala (`RN-5`,
  `RN-6`).
- Precio general y precio de estudiante vigentes, y el cálculo del precio de una entrada según la
  fecha de la función (`RN-12` a `RN-15`).
- El estado de una función: programada o cancelada.

**Qué promete a quien lo usa**:
- Un precio calculado para una función y una categoría es **el precio de ese momento**; el que se
  cobra queda congelado por quien registre la compra, no por Cartelera.
- Una función que devuelve como «en venta» tiene su semana abierta, no está cancelada y su hora
  de inicio no pasó.

**Límite con el resto**: consulta a Ocupación una sola cosa —si una función tiene butacas
tomadas—, para poder impedir que se modifique o elimine una función ya vendida (`RF-4`). No sabe
nada de compras, reservas ni operadores.

**Limitaciones**: el margen de 20 minutos es un valor fijo del diseño, no configurable. Cambiarlo
exige tocar el código.

### Venta

**Propósito**: todo el ciclo de vida de una compra, desde que alguien elige butacas hasta que la
entrada se usa, se anula o se devuelve.

**Responsabilidades**:
- Bloquear butacas por internet y registrar la compra cuando el pago simulado resulta exitoso
  (`RF-10`, `RF-11`).
- Registrar compras de taquilla, con la categoría de precio de cada butaca (`RF-12`).
- Reservas de estudiante: crearlas, convertirlas con carné, y registrar la compra a precio general
  cuando no hay carné (`RF-14` a `RF-17`).
- Emitir el número de compra y conservarlo al convertir una reserva (`RN-25`).
- Buscar una compra y marcar sus entradas como usadas (`RF-18`, `RF-19`).
- Anular una compra y cancelar una función, con permiso, plazo y motivo (`RF-21` a `RF-23`).
- Al cancelar, encolar el aviso por correo a cada persona que compró por internet (`RF-24`).
- Marcar entregada la devolución en efectivo de una compra de taquilla (`RF-25`).
- Congelar en cada entrada el monto cobrado (`RN-16`) y la jornada en cada operación (`RN-11`).

**Qué promete a quien lo usa**:
- Una compra registrada tiene todas sus butacas tomadas en Ocupación. No existe una compra con
  butacas a medias.
- Una compra anulada o devuelta tiene todas sus butacas liberadas.
- El monto de una entrada nunca cambia después de registrada.

**Límite con el resto**: es el único componente que escribe compras, reservas y entradas. Pide
butacas a Ocupación y precios a Cartelera, y nunca toca sus tablas directamente. Le entrega a
Avisos un destinatario y un contenido ya armado; **no espera respuesta y no revierte nada si el
correo falla** (`RNF-5`).

**Limitaciones**: el pago es simulado (fuera de alcance). El punto donde se decide que un pago
fue exitoso está aislado en una sola operación, para que conectar un medio de pago real más
adelante no obligue a rehacer el resto.

### Salidas

**Propósito**: las dos salidas periódicas — el cierre de caja de la jornada y el reporte mensual
al distribuidor.

**Responsabilidades**:
- Armar el cierre de caja de una jornada en dos partes: ventanilla e internet (`RN-46`, `RF-26`).
- Armar el reporte mensual con detalle función por función y las canceladas marcadas (`RF-27`).
- Entregarle el reporte a Avisos y registrar el resultado del envío (`REG-7`, `RF-28`).
- Guardar y devolver la dirección de correo del distribuidor (`RN-49`, `RF-29`).
- Las consultas de ocupación y de entradas por categoría y canal (`RF-30`, `RF-31`).

**Qué promete a quien lo usa**: **no cambia ninguna venta.** Salvo la dirección del distribuidor y
el registro del envío, ninguna operación de este componente altera nada, así que sus consultas
pueden correr cuantas veces haga falta sin efectos.

**Límite con el resto**: lee compras de Venta y funciones de Cartelera, y le entrega el reporte a
Avisos. No conoce reservas —y no puede conocerlas, porque viven en otra tabla—, que es exactamente
lo que impide que una reserva sin pagar sume plata en el reporte del distribuidor.

**Limitaciones**: el cierre de caja se calcula al vuelo sobre la jornada, sin guardar una foto. Si
una devolución se marca como entregada después de que alguien miró el cierre, el número cambia.
Es correcto —la jornada todavía no terminó— y conviene tenerlo presente.

### Avisos

**Propósito**: sacar correos del sistema.

**Responsabilidades**:
- Poner en cola y enviar un correo a un destinatario.
- Reintentar los que fallan, con espaciado creciente, durante 24 horas.
- Dejar visible el que no salió después de ese plazo.

**Qué promete a quien lo usa**: acepta siempre. Encolar un correo **nunca falla ni bloquea** a
quien llama.

**Límite con el resto**: no sabe qué es una compra, una función ni un reporte. Recibe
destinatario, asunto, cuerpo y adjunto ya armados. Ese recorte es lo que permite cambiar de
proveedor de correo sin tocar nada más.

**Limitaciones**: no garantiza la entrega, solo el intento. Un correo que el proveedor acepta y
después descarta es invisible para el sistema.

### Operadores

**Propósito**: saber quién está operando y qué puede hacer.

**Responsabilidades**:
- Los tres puestos —dueña, taquilla, puerta— y sus permisos (`RN-50` a `RN-53`).
- Identificar a un operador y abrir su sesión.
- Cerrar la sesión al terminar la jornada.

**Qué promete a quien lo usa**: dado un PIN, devuelve un operador con su puesto, o nada. Y dado un
operador y una operación, dice si la tiene permitida (`RN-54`, `RF-32`).

**Límite con el resto**: no depende de nada, y **no se aplica a quien compra por internet**, que no
es operador y no tiene cuenta (`RN-55`). Quien exige el operador es Entrada, no los componentes de
dominio: estos lo reciben ya resuelto y ninguno consulta permisos por su cuenta ni conoce el PIN de
nadie.

### Reloj

**Propósito**: disparar lo que ocurre sin que nadie apriete nada.

**Responsabilidades**:
- Cada 10 minutos, pedirle a Venta que barra los vencidos. Venta borra las reservas vencidas de su
  propia tabla y le pide a Ocupación que borre las filas vencidas de la suya. **El Reloj nunca
  toca la tabla de ocupación**, ni directamente ni por atajo.
- El día 1 de cada mes, pedirle a Salidas el reporte del mes cerrado y su envío (`RN-47`).

**Qué promete a quien lo usa**: nada. **No decide nada y no contiene ninguna regla**: solo llama.
Toda la lógica de qué está vencido y qué lleva el reporte vive en Venta y en Salidas.

**Límite con el resto**: nadie lo conoce ni lo llama. Es la única punta del grafo de dependencias
sin entradas.

**Limitaciones**: si el Reloj no corre, **el cine sigue vendiendo**. Solo se acumulan filas
muertas y el reporte del distribuidor no sale automáticamente, y la dueña lo manda a mano. Nada
crítico depende de él, y eso es deliberado.

### Entrada

**Propósito**: las pantallas y lo que hay que hacer para armarlas. Es la única pieza que sabe que
existen tres públicos distintos —la web pública, la taquilla y la puerta— y qué ve cada uno.

**Responsabilidades**:
- Exigir e identificar al operador antes de toda operación interna, y no exigirlo en la web
  pública (`RF-32`, `RN-55`).
- **Armar el mapa de butacas**: pedirle a Cartelera la lista de butacas de la sala, a Ocupación las
  tomadas de esa función, y componer las dos (`RF-9`).
- **Recortar el detalle según el canal**: colapsar bloqueada, reservada y vendida en «no
  disponible» para el mapa público (`RN-56`), y mostrarlas tal cual en el de taquilla (`RN-57`).
- Sostener la sesión anónima de quien compra por internet, que es a quien pertenece un bloqueo.
- Traducir los rechazos de los componentes de dominio a los mensajes de la tabla de errores.

**Qué promete a quien lo usa**: **ninguna regla del negocio vive acá.** Entrada compone,
identifica, recorta y redacta; no decide precios, no valida plazos y no resuelve choques de
butacas. Si una regla se puede comprobar como cierta o falsa, su lugar es un componente de dominio.

**Límite con el resto**: llama hacia abajo y nadie la llama a ella. Es la única pieza autorizada a
combinar datos de dos componentes —Cartelera y Ocupación— y por eso es la que absorbe el recorte
que impide el ciclo entre esos dos.

**Limitaciones**: al componer el mapa en dos consultas separadas, puede mostrar una foto de
milisegundos de desfase. Es la misma ventana que ya acepta el sondeo cada 3 segundos, y el
rechazo al intentar tomar la butaca es lo que la vuelve inofensiva (`RNF-4`).

## Modelo de datos

### Cómo se guardan la compra y la reserva

Es la decisión no trivial del modelo. El glosario define compra como operación pagada y reserva
como apartado sin pago, pero `RN-25` dice que la reserva conserva su número al convertirse. Eso
admite dos formas:

- **Una sola tabla con estado** (reservada → pagada). El número se conserva solo. A cambio, toda
  consulta del cierre de caja y del reporte al distribuidor debe acordarse de excluir las
  reservadas, y `RN-34` obliga a borrar filas de la misma tabla donde vive el histórico de ventas.
- **Dos tablas, con el número traspasado** al convertir. Cuesta un paso más en la conversión, y a
  cambio Salidas nunca puede contar una reserva como venta: lee una tabla donde las reservas no
  existen. Borrar las vencidas no toca el histórico.

**Se eligieron dos tablas.** El error que evita —una reserva sin pagar sumando plata en el reporte
del distribuidor— es silencioso y difícil de detectar; el paso extra en la conversión es visible y
se prueba una vez.

### Entidades

```
Sala ──< Butaca                        2 salas, 180 butacas fijas
Película ──< Función >── Sala
SemanaCartelera ──< Función
Función ──< Ocupación >── Butaca       unicidad: (función, butaca)
Ocupación ──> Compra | Reserva | sesión anónima
Compra ──< Entrada >── Butaca
Reserva ──> Función
Operador ──< registra: Compra, Entrada validada, anulación, cancelación, devolución
```

| Entidad | Qué guarda | Requisitos |
|---|---|---|
| **Sala** | Nombre, cantidad de filas y butacas por fila | `RN-1` |
| **Butaca** | Sala, fila y número (`A1`, `F7`). Las 180 butacas se crean una sola vez y no cambian. La posición respecto del pasillo **no se guarda**: se deduce del número | `RN-1`, `RN-2` |
| **Película** | Título y duración en minutos | `RN-4` |
| **SemanaCartelera** | Jueves de inicio y si está abierta a la venta | `RN-3`, `RN-8`, `RN-9` |
| **Función** | Película, sala, fecha, hora de inicio, estado (programada / cancelada), y si está cancelada: operador, instante, jornada y motivo | `RN-5`, `RN-41`, `REG-4`, `REG-6` |
| **PrecioVigente** | Monto general, monto estudiante y desde cuándo rigen | `RN-12`, `RN-16` |
| **Ocupación** | Función, butaca, motivo (bloqueo / reserva / venta), a qué apunta y cuándo vence | `RN-17` a `RN-20`. **Unicidad sobre (función, butaca)**: acá vive `RNF-4` |
| **Reserva** | Número de compra, función, nombre, correo, teléfono e instante | `REG-3`. Se borra al vencer (`RN-34`) |
| **Compra** | Número, canal, instante, **jornada**, función, estado (pagada / anulada / devuelta), monto total, operador si fue taquilla, contacto si fue internet, y para anulación o devolución entregada: operador, instante, jornada y motivo | `REG-1`, `REG-4`, `REG-5` |
| **Entrada** | Compra, butaca, categoría de precio y **monto congelado**; si fue usada: instante y operador | `REG-2`. El monto acá es lo que hace cumplir `RN-16` |
| **Operador** | Nombre, puesto y credencial | `RN-50`, `RN-54` |
| **EnvíoReporte** | Mes, destinatario, instante y resultado | `REG-7` |
| **Configuración** | Correo del distribuidor | `RN-49` |

### Tres cosas que se guardan y no se recalculan

- **El monto de cada entrada**, porque un cambio de precio no puede mover una venta vieja
  (`RN-16`, `CA-4`).
- **La jornada de cada operación**, calculada con el corte de las 06:00 al escribir, para que el
  cierre de caja no dependa de rehacer esa cuenta en cada consulta (`RN-10`, `RN-11`, `CA-8`).
- **El motivo** de toda anulación y cancelación, que es lo único que va a explicar mañana una
  devolución de hace seis meses.

### Y una que no se guarda

Las reservas vencidas y los bloqueos vencidos se borran (`RN-34`, `REG-8`). Por eso la pregunta
«cuántos estudiantes reservaron y no se presentaron» figura en la especificación marcada como no
contestable: es una decisión, no un hueco del modelo.

### Cómo se contesta cada pregunta de `Qué queda registrado`

| Pregunta de la especificación | Cómo se resuelve sobre este modelo |
|---|---|
| ¿Qué película y qué horario llenan más? | Entradas por función contra la cantidad de butacas de su sala, agrupando por película, día de la semana y hora de `Función` |
| ¿Cuánto rinde el miércoles? | `Entrada` agrupada por categoría de precio y por fecha de `Función` |
| ¿Cuánto pesa internet contra taquilla? | `Compra.canal` por período |
| ¿Qué se le informó al distribuidor? | `Compra` y `Entrada` del mes por función, más `Función.estado` y `EnvíoReporte` |
| ¿Cuánto efectivo debe haber en la caja? | `Compra` de canal taquilla de la jornada, menos las devoluciones entregadas en esa jornada |
| ¿Quién canceló y por qué? | Campos de cancelación de `Función` |

## Flujo de datos

### Ciclo de vida de una butaca en una función

| Desde | Hacia | Qué lo dispara |
|---|---|---|
| libre | bloqueada | alguien elige la butaca por internet (`RN-19`) |
| libre | reservada | reserva de estudiante por internet (`RN-28`) |
| libre | vendida | venta en taquilla, sin paso intermedio (`RN-20`) |
| bloqueada | vendida | el pago simulado resulta exitoso (`RN-26`) |
| bloqueada | libre | vence el bloqueo, a los 5 minutos de haber elegido la butaca (`RN-19`) |
| reservada | vendida | carné y pago en taquilla (`RN-31`) |
| reservada | libre | vence al empezar la función, o no presenta carné y no paga general (`RN-30`, `RN-32`) |
| vendida | libre | anulación de la compra o cancelación de la función (`RN-40`, `RN-41`) |

En el modelo, **libre es la ausencia de registro** en la tabla de ocupación. Las tres transiciones
de esta tabla que terminan en libre son borrados del registro; las que terminan en vendida son
cambios de motivo sobre el mismo registro.

### Tomar butacas: la operación crítica

Todo el sistema se apoya en que esta secuencia es **una sola transacción**:

1. Borrar las filas de ocupación **vencidas** de las butacas pedidas.
2. Insertar una fila por cada butaca pedida, con su motivo y su vencimiento.
3. Si alguna inserción choca con la restricción de unicidad, deshacer la transacción entera.
4. Devolver el resultado: tomadas todas, o la lista de las que se adelantaron.

El paso 1 es lo que hace que la corrección no dependa del barrido: una butaca vencida se libera
en el instante en que alguien la vuelve a pedir, no cuando pasa el proceso de fondo. El paso 3 es
lo que garantiza `CA-1` sin escribir ninguna comprobación previa: de dos inserciones sobre la
misma butaca, el motor acepta una y rechaza la otra.

## Manejo de errores

Tres clases, con tratamiento distinto:

| Clase | Qué es | Cómo se trata |
|---|---|---|
| **Rechazo esperado** | Una regla del negocio dijo que no | Se informa qué pasó y qué hacer, con el estado actual a la vista. **No se registra nada**: no ocurrió nada |
| **Fallo transitorio** | Algo de afuera no respondió | La operación no deja rastro parcial. Se puede reintentar |
| **Reversa** | La operación salió bien y hay que deshacerla | No es un error técnico: es una operación con permiso, plazo, motivo y registro |

**Tres promesas transversales:**

1. **Toda operación que toca butacas es una sola transacción.** Si falla en el medio, no queda
   ninguna butaca tomada. Es lo que hace que una caída del sistema (`RNF-3`) no deje nada a medias.
2. **Ningún aviso revierte nada** (`RNF-5`). El correo que no sale entra en la cola de Avisos; la
   venta ya está registrada y el número se muestra en pantalla.
3. **Ningún mensaje dice «error inesperado».** Todos nombran el objeto concreto: la butaca, la
   hora, el operador.

### Cobertura de los recorridos que terminan mal

| Situación | Clase | Qué se le dice | Qué queda registrado |
|---|---|---|---|
| Butaca tomada por otro | Rechazo | «F7 y F8 ya no están libres» y el mapa al día. Ninguna se toma | Nada |
| Función ya empezó | Rechazo | «La venta cerró a las 19:00» | Nada |
| Función cancelada | Rechazo | «Esta función se canceló» | Nada |
| Bloqueo vencido | Rechazo | «Se venció el tiempo. Las butacas volvieron a estar libres» | Nada (`REG-8`) |
| Número de compra inexistente | Rechazo | «No encontramos ese número», y se ofrece buscar por nombre o correo | Nada |
| Número de otra función | Rechazo | «Ese número es de la función de las 21:00 del sábado» | Nada |
| Entradas ya usadas | Rechazo | «Se validaron a las 20:42, por Marta» | Nada nuevo; se muestra `REG-2` |
| En la puerta, función cancelada | Rechazo | «La función se canceló; la compra está devuelta» | Nada |
| Anular una compra ya validada | Rechazo | «Las entradas ya se usaron a las 20:42» | Nada |
| Cancelar fuera de plazo | Rechazo | «La jornada del viernes ya cerró» | Nada |
| Función que se pisa al cargar | Rechazo | «Choca con la función de Sala 1 que termina a las 21:00. La primera hora posible es 21:20» | Nada |
| El puesto no tiene permiso | Rechazo | «Este puesto no puede cancelar funciones» | Nada |
| El pago simulado falla | Transitorio | «El pago no se completó. Las butacas siguen tuyas por lo que queda del bloqueo» | Nada |
| No sale el correo del número de compra | Transitorio | Nada: la compra está hecha y el número está en pantalla | El correo pendiente en la cola |
| No sale el aviso de cancelación | Transitorio | Nada: la cancelación es firme | El correo pendiente en la cola |
| Falla el envío del reporte | Transitorio | Aviso a la dueña, con reenvío a mano | El intento fallido (`REG-7`) |
| El barrido no corre | Transitorio | Nada. **Nadie se entera y nada se rompe** | Nada |
| El sistema no responde | Transitorio | No se vende por ningún canal. Sin respaldo en papel (`RNF-3`) | Nada |
| Venta mal registrada en taquilla | Reversa | Se anula con motivo y las butacas se liberan | Operador, instante, jornada y motivo (`REG-4`) |
| Falla el proyector | Reversa | Se cancela la función con motivo y todas las compras quedan devueltas | Ídem, más el aviso por correo a cada comprador de internet |

## Decisiones mayores

### 1. Forma general de la solución

**Por qué es una decisión mayor:** define cuántas piezas hay que construir y operar, cómo se ve el
mapa de butacas en el teléfono, y qué pasa cuando 200 personas miran la misma función un viernes.

| | A: un servicio, mapa por sondeo | B: un servicio, mapa en vivo | C: servicios separados |
|---|---|---|---|
| **Experiencia de uso** | La butaca ajena aparece ocupada con segundos de retraso | Se pinta al instante, sin recargar | Idéntica a A |
| **Rendimiento** | 200 personas cada 3 s son unas 70 consultas por segundo sobre una tabla chica | Menos consultas, 200 conexiones abiertas que sostener | Permitiría escalar la parte pública; a esta escala no se usa |
| **Recursos** | Un servidor y una base de datos | Los mismos, más manejo de conexiones vivas | Tres despliegues y su coordinación |
| **Complejidad** | La más baja: un despliegue, un lugar donde mirar | Reconexión, navegador dormido, estado repartido | La más alta, sobre todo en operación |
| **Riesgo** | Una ventana de segundos, que se traduce en rechazos, nunca en doble venta | Mucha maquinaria para ganar segundos | Los límites se pueden trazar igual dentro de un solo programa |

**Elección: A.** `RNF-1` pide 200 usuarios simultáneos y `RNF-3` dice que una hora caída se asume
como pérdida: ese par no justifica conexiones vivas ni tres despliegues para un cine de dos salas.
Si algún día el mapa en vivo hace falta, B se agrega sobre A sin rehacer nada.

### 2. Cómo se representa el estado de una butaca

**Por qué es una decisión mayor:** determina cuántos datos se escriben, cómo se dibuja el mapa y
dónde se puede poner la garantía de `RNF-4`.

| | A: una fila por butaca y función | B: una fila solo por butaca ocupada | C: sin tabla, se calcula |
|---|---|---|---|
| **Experiencia de uso** | Idéntica en las tres | Idéntica | Idéntica |
| **Rendimiento** | El mapa se lee sin cálculos; se escriben 180 filas por función | Se escribe solo lo que se vende; una consulta más para el mapa | La lectura más cara, repetida cada pocos segundos |
| **Recursos** | Medio millón de filas al año, casi todas vacías | Crece con lo que efectivamente se vende | El menor almacenamiento |
| **Complejidad** | Baja; hay que generar y borrar filas junto con la función | Media: «no hay fila» significa libre | El mapa se arma en varios lugares y es fácil que difieran |
| **Riesgo** | El estado y la compra viven en lugares distintos y pueden quedar desalineados | Una fila de bloqueo vencida sin limpiar | **No hay dónde poner la restricción de unicidad** |

**Elección: B.** Es la única que convierte `RNF-4` en una garantía del motor en vez de una promesa
del código, y la que menos escribe: se guardan las butacas vendidas, no las vacías. El costo
—limpiar los vencidos— hay que pagarlo igual, y es el objeto de la decisión 4.

### 3. Cómo se resuelve el choque entre dos compradores

**Por qué es una decisión mayor:** es el punto donde se cumple o se rompe `RNF-4`, y el único
donde 200 personas simultáneas se pisan de verdad. Como `RN-22` no pone límite de butacas, el
choque es por un grupo, no por una butaca.

| | A: insertar y dejar que rechace | B: candado sobre la función | C: candado en memoria |
|---|---|---|---|
| **Experiencia de uso** | Se le dice cuáles butacas se le adelantaron y se le muestra el mapa. Nunca queda un grupo incompleto | Casi igual, con esperas cortas y un mensaje más limpio | Igual, mientras funcione |
| **Rendimiento** | Solo compiten quienes van por la misma butaca | Todas las operaciones de una función se ponen en fila | El más rápido: no toca la base de datos |
| **Recursos** | Ninguno adicional | Ninguno adicional | Ninguno adicional |
| **Complejidad** | Baja, con un detalle obligatorio: una sola transacción para todo el grupo | Media: hay que soltar el candado siempre, incluso al fallar | Parece la más simple y es la más engañosa |
| **Riesgo** | Rechazos seguidos en un estreno; es honesto, las butacas se agotaron | Un candado olvidado traba la función entera | Se pierde en cada reinicio y no sirve con un segundo proceso |

**Elección: A.** Con la tabla de ocupación de la decisión 2 la restricción de unicidad ya está y no
cuesta nada. B agrega una fila de espera justo en la función más vendida de la semana, que es el
momento que `RNF-1` pide sostener. C no garantiza nada fuera de un único proceso sin reiniciarse.

### 4. Quién hace que el tiempo pase

**Por qué es una decisión mayor:** el bloqueo vence a los 5 minutos, la reserva al empezar la
función y el reporte sale el día 1. Con la unicidad de la decisión 2, **una fila vencida sigue
ocupando el lugar**: no es solo basura, bloquea la venta si nadie la limpia.

| | A: solo perezoso | B: solo barrido periódico | C: perezoso + barrido |
|---|---|---|---|
| **Experiencia de uso** | La butaca se libera en el instante exacto | **Puede seguir apareciendo ocupada hasta un minuto**, contra `RN-19` | Se libera en el instante exacto |
| **Rendimiento** | Un borrado extra por operación, despreciable | Bueno, con un pico en cada corrida | Igual que A |
| **Recursos** | Ninguno | Un proceso que hay que mantener vivo | El mecanismo de tareas, que hace falta igual para el reporte |
| **Complejidad** | Baja, concentrada en la operación de tomar butacas | Media y engañosa: si se detiene, el síntoma es «no hay lugar» en una sala vacía | A más un barrido que puede fallar sin consecuencias |
| **Riesgo** | La basura se acumula indefinidamente | **La corrección pasa a depender de un proceso de fondo** | Bajo: solo olvidar que la corrección vive en la operación |

**Elección: C.** El reporte del día 1 obliga a tener tareas programadas de todos modos, así que el
barrido no agrega infraestructura: agrega una tarea a un mecanismo que ya existe. La diferencia
con B es dónde vive la corrección: en C vive en la operación de venta, y si el barrido se cae, el
cine sigue vendiendo — el reparto que quiere `RNF-3`.

## Otras decisiones

| Decisión | Opciones consideradas | Elección | Razón |
|---|---|---|---|
| Identificación de operadores | Usuario y contraseña / PIN corto por operador / sesión permanente por dispositivo | PIN corto por operador, sesión que se cierra al terminar la jornada | `RN-54` exige saber quién hizo cada operación, y la ventanilla cambia de persona en segundos: una contraseña larga se termina compartiendo |
| Número de compra | Correlativo / aleatorio largo / 6 caracteres sin ambigüedades | 6 caracteres de un alfabeto sin `0/O` ni `1/I/L` | `RN-25` pide poder dictarlo en voz alta en la fila; un correlativo además delataría cuánto vende el cine |
| Refresco del mapa de butacas | Cada 3 s / cada 10 s / manual | Sondeo cada 3 s mientras el mapa está a la vista | Acota la ventana de rechazos de `RNF-4` con carga trivial para `RNF-1` |
| Identificación de butacas | Correlativa 1 a 120 / fila y número | Fila y número (`A1`, `F7`) | Es como está impreso el mapa hoy; quien atiende no traduce nada |
| Formato del reporte al distribuidor | Cuerpo del correo / hoja de cálculo adjunta / PDF | Hoja de cálculo adjunta, con el resumen en el cuerpo | El distribuidor procesa números; el cuerpo permite leerlo del teléfono sin abrir el adjunto |
| Reintento de correos | Sin reintento / 24 horas / indefinido | Reintentos con espaciado creciente durante 24 horas, después marcado como fallido y visible | `RN-48` pide reintentar y avisar; 24 h cubre una caída del proveedor sin acumular cola indefinida |
| Frecuencia del barrido | Cada minuto / cada 10 minutos / cada hora | Cada 10 minutos | No es crítico por la decisión 4; 10 minutos mantiene la tabla chica sin ruido |
| Vencimiento de reservas | Barrido dedicado / mismo mecanismo que los bloqueos | El mismo mecanismo | Una sola forma de vencer, más fácil de entender y de probar |
| Sesión de compra anónima | Cuenta de cliente / identificador anónimo en el navegador | Identificador anónimo en el navegador | No hay cuentas (`RN-55`); solo hace falta saber a quién pertenece un bloqueo |
| Zona horaria | Configurable / fija en la del cine | Fija en la hora local del cine | Hay un solo cine; una zona configurable es una fuente de errores sin ningún usuario que la pida |
| Historial de precios | Solo el vigente / historial con fecha desde | Historial con fecha desde | Permite explicar un monto viejo aunque el congelado en la entrada se ponga en duda |
| Cierre de caja | Foto guardada al cerrar / cálculo al vuelo | Cálculo al vuelo sobre la jornada | Los montos ya están congelados en cada entrada; guardar una foto duplicaría la verdad |
| Lenguaje y marco del servicio | TypeScript full-stack / Python + Django / C# + ASP.NET Core | **TypeScript**: Node.js con Fastify en el servidor; React con `@carbon/react` en la PWA | Un solo lenguaje en todo el proyecto, tipos compartidos entre dominio y pantallas, y librería oficial de Carbon para React (decisión de UI de `CLAUDE.md` §8). Decidido por el usuario en T0 |
| Motor de base de datos | PostgreSQL / SQLite / MySQL-MariaDB | **SQLite en modo WAL** | Cero instalación y respaldo en un archivo, acorde a un solo cine. Cumple transacciones y unicidad (`RNF-4`). Se acepta la escritura serializada: las transacciones son cortas y `RNF-1` es sobre todo lectura por sondeo. Decidido por el usuario en T0 |
| Mecanismo de tareas programadas | Planificador embebido / cron del SO / cola con Redis | **Planificador embebido** (node-cron) en el mismo proceso | Un solo despliegue (decisión mayor 1); si el Reloj se cae, el cine sigue vendiendo (decisión mayor 4). Decidido por el usuario en T0 |

## Decisiones dejadas abiertas

| Qué no se decidió | Quién lo decide y cuándo |
|---|---|
| Proveedor de correo saliente | El usuario, a más tardar en la tarea T14. El componente Avisos lo aísla detrás de una interfaz de un solo método |
| Cómo se dibuja el mapa en una pantalla angosta: 12 butacas por fila con desplazamiento lateral, o la sala reducida a escala | Quien implemente, al construir la pantalla pública. La distribución de las salas ya es un dato fijo (`RN-1`, `RN-2`); lo que queda abierto es solo cómo se muestra |
| Cuántos operadores hay de cada puesto y cómo se dan de alta | La dueña, al poner el sistema en marcha |
