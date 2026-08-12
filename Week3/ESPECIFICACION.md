# Especificación: Sistema de venta de entradas del Cine Variedades

## Resumen

El Cine Variedades vende hoy únicamente en taquilla, con un cuaderno y un mapa de butacas
impreso que se marca a lápiz. El sistema permite vender butacas numeradas por internet y en
taquilla sobre un único mapa compartido, para descongestionar la fila de viernes y sábado, y
registra cada operación con el detalle necesario para el reporte mensual al distribuidor y el
cierre de caja diario.

## Glosario

Un término por concepto. Donde la conversación usó dos nombres para lo mismo, se eligió uno y
se deja constancia del descartado.

| Término | Definición |
|---|---|
| **Sala** | Cada uno de los dos auditorios del cine. Sala 1 tiene 120 butacas; Sala 2 tiene 60. *(Descartado: «auditorio».)* |
| **Butaca** | Asiento físico de una sala, identificado por su fila y su número dentro de ella: `A1`, `F7`. |
| **Mapa de butacas** | Representación de todas las butacas de una sala para una función determinada, con el estado de cada una. Es lo que se elige desde el teléfono y lo que hoy está impreso en papel. |
| **Película** | Título programado en la cartelera, con una duración en minutos. |
| **Función** | Proyección de una película, en una sala, en una fecha y hora de inicio determinadas. |
| **Cartelera semanal** | Conjunto de funciones de una semana, que va de jueves a miércoles. |
| **Jornada** | Día de operación del cine. Empieza a las 06:00 de un día y termina a las 05:59 del día siguiente, de modo que una función de las 23:00 y todo lo que ocurra después de la medianoche pertenecen a la misma jornada. |
| **Canal** | Medio por el que se registra una operación de venta: internet o taquilla. |
| **Entrada** | Derecho de una persona a ocupar una butaca en una función. *(Descartado: «boleto», usado por la dueña y por el distribuidor.)* |
| **Compra** | Operación pagada que convierte una o más butacas de una función en entradas. |
| **Número de compra** | Código corto y legible que identifica una compra o una reserva de estudiante, y permite encontrarla en la puerta o en taquilla. Una reserva conserva su número al convertirse en compra. |
| **Reserva de estudiante** | Apartado sin pago, hecho por internet, de una o más butacas a precio de estudiante. Se convierte en compra en taquilla o vence. |
| **Bloqueo** | Estado transitorio de una butaca mientras alguien está completando una compra por internet. |
| **Categoría de precio** | Precio bajo el cual se vende una entrada: general, estudiante o miércoles. |
| **Anulación** | Dejar sin efecto una compra puntual y liberar sus butacas. |
| **Cancelación de función** | Dejar sin efecto una función completa y devolver todas sus compras de una sola vez. |
| **Cierre de caja** | Resumen de una jornada, con la parte de ventanilla separada de la de internet. |
| **Reporte al distribuidor** | Detalle mensual, función por función, que el sistema le envía al distribuidor por correo. |
| **Operador** | Persona que usa el sistema desde adentro del cine. Hay tres puestos: dueña, taquilla y puerta. |

## Objetivos

- Vender butacas numeradas por internet, con el comprador eligiendo su asiento desde el teléfono.
- Vender en taquilla sobre el mismo mapa de butacas que internet, de modo que una butaca nunca
  se venda dos veces.
- Sostener el precio de estudiante por internet sin perder la verificación del carné.
- Validar en la puerta que quien entra compró, y qué butaca le toca.
- Devolver la plata de una función completa cuando el proyector falla.
- Enviarle al distribuidor su reporte mensual sin que nadie tenga que acordarse.
- Producir el cierre de caja de cada jornada sin trabajo manual.
- Conservar el detalle necesario para responder, un año después, qué película y qué horario
  llenan más, cuánto rinde el miércoles a mitad de precio y cuánto pesa internet contra taquilla.

## Fuera de alcance

- Más de un cine o más de dos salas.
- Cobro real: el pago se simula. El sistema registra que la compra quedó pagada, sin conectarse
  a ningún medio de pago.
- Entradas impresas y códigos de barras.
- Cuentas de cliente. Quien compra por internet no se registra ni tiene sesión persistente.
- Acceso del distribuidor al sistema: recibe su reporte por correo y nada más.
- Envío de información al contador o a cualquier entidad fiscal.
- Pases o vales para otra función como alternativa a la devolución.
- Historial consultable de reservas vencidas y de bloqueos expirados.
- Cualquier exigencia de disponibilidad: una caída de una hora se asume como pérdida.
- Butacas con condición especial. **Todas las butacas son equivalentes**: no se distinguen las de
  accesibilidad, ni las de visión reducida, ni ninguna otra categoría. Se adopta esta decisión
  porque nadie mencionó que existan; si las hubiera, deja de valer y pasa a ser una regla del
  negocio.
- Precios distintos por película, por sala o por horario.
- Límite de butacas por compra.
- Venta con la función ya empezada, por cualquiera de los dos canales.
- Continuidad de la venta en taquilla mientras el sistema no responde: no hay procedimiento en
  papel de respaldo.

## Reglas del negocio

### Salas y cartelera

1. **RN-1**: El cine tiene exactamente dos salas. **Sala 1** tiene 120 butacas en 10 filas de 12,
   nombradas de la A a la J. **Sala 2** tiene 60 butacas en 6 filas de 10, nombradas de la A a la F.
2. **RN-2**: Cada butaca se identifica por su fila y su número dentro de la sala: `A1`, `F7`. Las
   filas se nombran desde la pantalla hacia atrás, y las butacas se numeran de izquierda a derecha
   mirando la pantalla. Un pasillo central parte cada fila en dos mitades iguales: en Sala 1 entre
   la butaca 6 y la 7, en Sala 2 entre la 5 y la 6.
3. **RN-3**: Una semana de cartelera empieza un jueves y termina el miércoles siguiente.
4. **RN-4**: Cada película lleva registrada su duración en minutos.
5. **RN-5**: Una función corresponde a exactamente una película, una sala, una fecha y una hora
   de inicio. Su hora de fin es la de inicio más la duración de la película.
6. **RN-6**: Entre el fin de una función y el inicio de la siguiente en la misma sala deben
   quedar al menos 20 minutos libres.
7. **RN-7**: El sistema no limita cuántas funciones diarias se programan en una sala.
8. **RN-8**: Como máximo pueden estar cargadas a la vez dos semanas de cartelera: la en curso y
   la siguiente.
9. **RN-9**: La venta de las funciones de una semana se abre en el momento en que la dueña
   termina de cargarla, y no antes.

### Jornada

10. **RN-10**: Una jornada empieza a las 06:00 de un día y termina a las 05:59 del día siguiente.
    Se la nombra por el día en que empieza.
11. **RN-11**: Toda operación —compra, anulación, cancelación, devolución entregada— se imputa a
    la jornada en que se registró, no al día de la función.

### Precios

12. **RN-12**: Existen dos montos, válidos para todo el cine sin distinción de película, sala ni
    horario: precio general y precio de estudiante. Los fija la dueña.
13. **RN-13**: En las funciones cuya fecha es miércoles, toda entrada se vende a la mitad del
    precio general, sin distinción de persona.
14. **RN-14**: En las funciones de miércoles no existe el precio de estudiante, no se pide carné
    y no se admiten reservas de estudiante.
15. **RN-15**: El precio de una entrada se determina por la fecha de la función, no por la fecha
    de la compra.
16. **RN-16**: Un cambio de precio no altera el monto de ninguna compra ya registrada.

### Butacas de una función

17. **RN-17**: Una butaca de una función está en exactamente uno de estos estados: libre,
    bloqueada, reservada o vendida.
18. **RN-18**: Una butaca bloqueada, reservada o vendida no puede ser elegida por nadie más, por
    ninguno de los dos canales.
19. **RN-19**: Una butaca se bloquea en el momento en que alguien la elige por internet, a favor
    de quien la eligió primero. El bloqueo termina cuando se confirma la compra o a los 5 minutos
    de haber elegido la butaca, lo que ocurra primero; al terminar sin compra, la butaca vuelve a
    estar libre.
20. **RN-20**: Una compra en taquilla no pasa por el estado bloqueada: la butaca pasa de libre a
    vendida en la misma operación.

### Compra

21. **RN-21**: La venta de una función se cierra a su hora de inicio, en internet y en taquilla
    al mismo tiempo.
22. **RN-22**: Una compra no tiene límite de butacas: puede llevarse todas las que estén libres
    en la función.
23. **RN-23**: Una compra o una reserva por internet exige nombre, correo electrónico y teléfono
    de quien la hace.
24. **RN-24**: Una compra en taquilla no exige ningún dato de quien compra.
25. **RN-25**: Toda compra y toda reserva recibe un número de compra único, corto y legible en
    voz alta. Una reserva conserva su número al convertirse en compra.
26. **RN-26**: Una compra por internet solo queda registrada cuando el pago simulado se da por
    exitoso. Hasta ese momento las butacas siguen bloqueadas, no vendidas.
27. **RN-27**: Toda compra registra por cuál de los dos canales se hizo.

### Reserva de estudiante

28. **RN-28**: La reserva de estudiante solo existe por internet. En taquilla el carné se ve en
    el momento, y se vende directo a precio de estudiante.
29. **RN-29**: Una reserva de estudiante no involucra pago.
30. **RN-30**: Una reserva de estudiante vence a la hora de inicio de la función, y al vencer sus
    butacas vuelven a estar libres.
31. **RN-31**: Una reserva de estudiante se convierte en compra únicamente en taquilla,
    presentando carné de estudiante y pagando el precio de estudiante.
32. **RN-32**: Si quien reservó no presenta carné, la reserva no se convierte. En ese mismo
    momento se le ofrece comprar las mismas butacas a precio general: si acepta, se registra una
    compra a precio general; si no acepta, las butacas vuelven a estar libres.
33. **RN-33**: Quien no presenta carné y no paga precio general no entra a la sala.
34. **RN-34**: El sistema no conserva registro de las reservas que vencieron.

### Puerta

35. **RN-35**: En la puerta se identifica una compra por su número de compra.
36. **RN-36**: Validar una compra en la puerta marca sus entradas como usadas, con la hora y el
    operador que las validó.
37. **RN-37**: Una entrada ya marcada como usada no puede volver a usarse.

### Anulación, cancelación y devolución

38. **RN-38**: Una compra puede anularse hasta la hora de inicio de su función. Después, no.
39. **RN-39**: Una compra cuyas entradas ya fueron marcadas como usadas no puede anularse.
40. **RN-40**: Anular una compra libera sus butacas y registra quién la anuló, cuándo y por qué.
41. **RN-41**: Cancelar una función deja sin efecto todas sus compras de una sola vez, hayan sido
    validadas en la puerta o no, y registra quién canceló, cuándo y por qué.
42. **RN-42**: Una función puede cancelarse hasta el final de la jornada a la que pertenece.
    Después, no.
43. **RN-43**: Una función cancelada no admite ninguna venta nueva.
44. **RN-44**: La devolución de una compra hecha en taquilla se entrega en efectivo por
    ventanilla y se descuenta del cierre de caja de la jornada en que se entrega.
45. **RN-45**: La devolución de una compra hecha por internet vuelve por el mismo medio de pago.
    Como el pago está simulado, el sistema la registra como devuelta y se lo avisa por correo a
    quien compró; no hay movimiento de efectivo y no afecta la parte de ventanilla del cierre de
    caja.

### Salidas periódicas

46. **RN-46**: El cierre de caja de una jornada tiene dos partes: **ventanilla** —cobrado en
    efectivo menos devoluciones entregadas, que es lo que hay que contar y entregar— e
    **internet** —vendido por ese canal, informativo—.
47. **RN-47**: El día 1 de cada mes el sistema le envía al distribuidor, por correo electrónico y
    sin intervención de nadie, el reporte del mes recién terminado.
48. **RN-48**: Si el envío del reporte falla, el sistema reintenta y le avisa a la dueña, que
    puede reenviarlo a mano.
49. **RN-49**: La dueña mantiene la dirección de correo del distribuidor.

### Permisos

50. **RN-50**: Hay tres puestos de operador con permisos distintos: **dueña**, **taquilla** y
    **puerta**.
51. **RN-51**: La dueña carga la cartelera, registra las películas con su duración, fija los
    precios, mantiene el correo del distribuidor, consulta el reporte y el cierre de caja,
    cancela funciones y anula compras.
52. **RN-52**: Taquilla vende, convierte reservas de estudiante, entrega devoluciones en efectivo,
    cancela funciones, anula compras y hace el cierre de caja de la jornada.
53. **RN-53**: Puerta valida compras. No vende, no anula y no cancela.
54. **RN-54**: Toda operación de venta, anulación, cancelación, devolución y validación registra
    qué operador la hizo.
55. **RN-55**: Quien compra por internet no es un operador y no tiene cuenta en el sistema.

### El mapa de butacas

56. **RN-56**: El mapa que ve quien compra por internet muestra cada butaca con solo dos
    apariencias: **libre** y **no disponible**. No distingue entre bloqueada, reservada y vendida.
57. **RN-57**: El mapa que ve taquilla muestra los cuatro estados de `RN-17`, porque quien atiende
    necesita saber si una butaca está reservada por un estudiante que todavía puede presentarse.

## Qué queda registrado

1. **REG-1** — De cada compra: número de compra, canal, fecha y hora, jornada, función, butacas,
   categoría de precio de cada butaca, monto total, estado (pagada, anulada o devuelta), operador
   que la registró si fue en taquilla, y nombre, correo y teléfono si fue por internet.
2. **REG-2** — De cada entrada: si fue usada, en qué momento y qué operador la validó.
3. **REG-3** — De cada reserva de estudiante vigente: función, butacas, datos de contacto y
   momento en que se hizo. Las vencidas no se conservan (RN-34).
4. **REG-4** — De cada anulación y de cada cancelación de función: qué operador, en qué momento,
   en qué jornada y con qué motivo.
5. **REG-5** — De cada devolución entregada en efectivo: qué operador la entregó, en qué momento
   y en qué jornada.
6. **REG-6** — De cada función: película, duración, sala, fecha, hora de inicio y estado
   (programada o cancelada). El precio aplicado queda congelado en cada compra (RN-16).
7. **REG-7** — De cada envío del reporte al distribuidor: fecha, dirección de destino y si salió
   o falló.
8. **REG-8** — No se registran los bloqueos de butaca que vencieron sin convertirse en compra.

Con eso se pueden contestar:

| Pregunta | De dónde sale |
|---|---|
| ¿Qué película y qué horario llenan más? | Entradas vendidas por función (REG-1) contra butacas de la sala (RN-1), agrupadas por película, día de la semana y hora (REG-6). |
| ¿Cuánto rinde el miércoles a mitad de precio? | Entradas y monto de las funciones de miércoles (REG-1, REG-6) contra los demás días. |
| ¿Cuánto pesa internet contra taquilla? | Canal de cada compra (REG-1, RN-27), por período. |
| ¿Qué se le informó al distribuidor este mes? | Compras por función del mes, con las funciones canceladas marcadas (REG-1, REG-4, REG-6), y el registro del envío (REG-7). |
| ¿Cuánto efectivo tiene que haber en la caja al cerrar esta jornada? | Compras de canal taquilla de la jornada menos devoluciones entregadas en esa jornada (REG-1, REG-5, RN-44). |
| ¿Quién canceló aquella función y por qué? | REG-4. |
| ¿Cuántos estudiantes reservaron y no se presentaron? | **No se puede contestar**, por decisión explícita (RN-34). |

## Salidas que consume alguien más

| Quién | Qué recibe | Formato | Frecuencia |
|---|---|---|---|
| Distribuidor | Detalle función por función del mes: fecha, hora, sala, película, entradas vendidas y monto. Las funciones canceladas aparecen marcadas como tales, con sus entradas vendidas y devueltas a la vista. | Correo electrónico enviado por el sistema, sin intervención de nadie | Mensual, el día 1 |
| Dueña | Cierre de caja de la jornada, en dos partes: **ventanilla** e **internet** (RN-46). | En pantalla | Por jornada |

## Recorridos

### Compra por internet que termina bien

1. Alguien abre la cartelera y elige una función que todavía no empezó.
2. Ve el mapa de butacas de esa función y elige una o más butacas libres.
3. Las butacas quedan bloqueadas a su favor (RN-19).
4. Escribe nombre, correo y teléfono.
5. Confirma el pago; el pago simulado se da por exitoso.
6. Las butacas pasan a vendidas y se emite el número de compra, que ve en pantalla y le llega al
   correo.

### Compra en taquilla que termina bien

1. Quien atiende elige la función.
2. Ve el mapa de butacas y elige las libres que el cliente señala.
3. Indica la categoría de precio de cada butaca: general, o estudiante si el cliente muestra el
   carné. Si la función es de miércoles, la categoría es miércoles y no se pregunta nada (RN-14).
4. Cobra y registra la compra. Las butacas pasan a vendidas y se emite el número de compra.

### Reserva de estudiante que termina bien

1. Alguien elige una función que no es de miércoles y marca que va a pagar precio de estudiante.
2. Elige butacas libres y escribe nombre, correo y teléfono. Las butacas pasan a reservadas.
3. Recibe un número de compra en pantalla y por correo.
4. Llega a taquilla antes del inicio de la función, da el número y muestra el carné.
5. Quien atiende convierte la reserva en compra, cobra el precio de estudiante y las butacas
   pasan a vendidas, conservando el mismo número (RN-25).

### Validación en la puerta que termina bien

1. Quien llega da su número de compra.
2. Quien recibe lo busca, ve la función y las butacas.
3. Marca las entradas como usadas y lo deja pasar.

### Cierre de la jornada que termina bien

1. Al terminar la última función, quien atiende pide el cierre de la jornada.
2. El sistema muestra la parte de ventanilla —cobrado en efectivo menos devoluciones
   entregadas— y la parte de internet.
3. Quien atiende cuenta el efectivo, lo compara con la parte de ventanilla y lo entrega.

### Recorridos que terminan mal

| Situación | Qué hace el sistema |
|---|---|
| El bloqueo vence mientras la persona escribe sus datos o paga | Las butacas vuelven a estar libres. Se le informa que se le venció el tiempo y se lo devuelve al mapa, donde puede volver a elegir si siguen libres. No se registra ninguna compra. |
| Elige una butaca que otro tomó primero | La butaca ya no aparece libre. Se le informa y se le muestra el mapa actualizado. |
| Intenta comprar una función que ya empezó | La función no aparece en venta. Si estaba en pantalla desde antes, la compra se rechaza al confirmar (RN-21). |
| Intenta comprar una función cancelada | La función no aparece en venta y la compra se rechaza (RN-43). |
| El pago simulado falla | Las butacas siguen bloqueadas hasta que venza el bloqueo. No se registra compra. Se le ofrece reintentar. |
| Quien reservó no llega antes del inicio de la función | La reserva vence, las butacas vuelven a estar libres y no queda registro (RN-30, RN-34). |
| Quien reservó llega sin carné | Se le ofrece pagar precio general por las mismas butacas. Si acepta, se registra la compra a precio general; si no, las butacas se liberan y no entra (RN-32, RN-33). |
| El número de compra no existe o está mal dictado | No se encuentra nada. Quien recibe puede buscar por nombre o por correo antes de rechazarlo. |
| El número de compra corresponde a otra función o a otro día | Se muestra a qué función corresponde y no se valida. |
| Las entradas ya fueron marcadas como usadas | No se valida. Se muestra a qué hora y qué operador las validó (RN-37, REG-2). |
| Se intenta validar una compra de una función cancelada | No se valida. Se muestra que la función fue cancelada y que la compra está devuelta. |
| Quien atiende registró mal una venta | Anula la compra hasta antes del inicio de la función, con motivo; las butacas se liberan y vuelve a vender (RN-38, RN-40). |
| Se intenta anular una compra ya validada en la puerta | No se anula (RN-39). Si la persona ya entró, el caso se resuelve cancelando la función o por fuera del sistema. |
| El proyector falla a mitad de función | La dueña o taquilla cancelan la función con motivo, dentro de la misma jornada. Todas sus compras quedan devueltas de una sola vez (RN-41, RN-42). |
| Se intenta cancelar una función de una jornada ya cerrada | No se cancela (RN-42). El caso se resuelve por fuera del sistema. |
| Al cargar la cartelera, una función se pisa con otra de la misma sala | No se programa. Se indica con cuál choca y cuál es la primera hora de inicio admisible (RN-6). |
| El envío del reporte al distribuidor falla | Se reintenta y se le avisa a la dueña, que puede reenviarlo a mano. Queda registrado el intento fallido (RN-48, REG-7). |
| El sistema no responde | No se vende por ningún canal hasta que vuelva. No hay procedimiento de respaldo en papel. |

## Requisitos funcionales

### Cartelera y precios

1. **RF-1**: La dueña puede registrar películas con su duración en minutos.
2. **RF-2**: La dueña puede cargar la cartelera de una semana: qué película, en qué sala, qué día
   y a qué hora, para cada función.
3. **RF-3**: El sistema rechaza programar una función que deje menos de 20 minutos libres
   respecto de otra de la misma sala (RN-6).
4. **RF-4**: La dueña puede modificar y eliminar funciones de una semana mientras ninguna de sus
   butacas esté vendida o reservada.
5. **RF-5**: El sistema abre la venta de las funciones de una semana en el momento en que la
   dueña la da por cargada (RN-9).
6. **RF-6**: La dueña puede fijar y cambiar el precio general y el precio de estudiante.
7. **RF-7**: El sistema calcula el precio de cada entrada a partir de la fecha de la función y de
   la categoría de precio (RN-13, RN-14, RN-15).

### Venta

8. **RF-8**: Cualquier persona puede ver, sin identificarse, la cartelera de las funciones en
   venta.
9. **RF-9**: El sistema muestra el mapa de butacas de una función, con las butacas ubicadas según
   la distribución de la sala (`RN-1`, `RN-2`) y con el detalle de estado que corresponde al canal
   (`RN-56`, `RN-57`).
10. **RF-10**: El sistema bloquea las butacas elegidas por internet a favor de quien las eligió
    primero, y las libera al vencer el bloqueo (RN-19).
11. **RF-11**: El sistema registra una compra por internet cuando el pago simulado resulta
    exitoso, y le entrega a quien compró el número de compra en pantalla y por correo.
12. **RF-12**: Taquilla puede registrar una compra eligiendo butacas libres y la categoría de
    precio de cada una.
13. **RF-13**: El sistema rechaza toda venta de una función cuya hora de inicio ya pasó, o que
    esté cancelada.

### Reserva de estudiante

14. **RF-14**: Por internet se puede reservar butacas a precio de estudiante en funciones que no
    sean de miércoles, sin pagar.
15. **RF-15**: El sistema libera las butacas de una reserva a la hora de inicio de la función.
16. **RF-16**: Taquilla puede convertir una reserva en compra, previa presentación de carné,
    cobrando el precio de estudiante.
17. **RF-17**: Taquilla puede registrar, sobre una reserva no convertida, una compra a precio
    general de las mismas butacas.

### Puerta

18. **RF-18**: Puerta puede buscar una compra por número de compra, y también por nombre o
    correo.
19. **RF-19**: Puerta puede marcar las entradas de una compra como usadas.
20. **RF-20**: El sistema rechaza validar entradas ya usadas, de funciones canceladas o de
    compras anuladas, indicando el motivo.

### Anulación, cancelación y devolución

21. **RF-21**: Taquilla y la dueña pueden anular una compra hasta la hora de inicio de su
    función, indicando un motivo.
22. **RF-22**: El sistema impide anular una compra con entradas ya usadas (RN-39).
23. **RF-23**: Taquilla y la dueña pueden cancelar una función indicando un motivo, hasta el
    final de la jornada a la que pertenece, lo que deja todas sus compras devueltas.
24. **RF-24**: El sistema le avisa por correo, a cada persona que compró por internet en una
    función cancelada, que la función se cayó y que su compra quedó devuelta.
25. **RF-25**: Taquilla puede marcar como entregada la devolución en efectivo de una compra hecha
    en taquilla.

### Información

26. **RF-26**: El sistema produce el cierre de caja de una jornada, con la parte de ventanilla
    separada de la de internet.
27. **RF-27**: El sistema arma el reporte mensual al distribuidor, con detalle función por
    función y las canceladas marcadas, y se lo envía por correo el día 1 del mes siguiente.
28. **RF-28**: Si el envío falla, el sistema reintenta, le avisa a la dueña y le permite
    reenviarlo a mano.
29. **RF-29**: La dueña puede consultar y cambiar la dirección de correo del distribuidor.
30. **RF-30**: La dueña puede consultar la ocupación de las funciones por película, día de la
    semana y hora.
31. **RF-31**: La dueña puede consultar entradas y monto por categoría de precio y por canal, en
    un período que elija.

### Operadores

32. **RF-32**: Un operador se identifica ante el sistema antes de vender, validar, anular,
    cancelar o entregar una devolución.
33. **RF-33**: El sistema impide a cada puesto las operaciones que no le corresponden (RN-51 a
    RN-53).

## Requisitos no funcionales

1. **RNF-1**: El sistema debe sostener hasta 200 personas usándolo al mismo tiempo en el peor
   momento —un viernes por la noche—, sumando compradores por internet, taquilla y puerta.
2. **RNF-2**: El volumen máximo es del orden de 1.400 entradas por jornada: dos salas de 120 y 60
   butacas, con tres o cuatro funciones diarias cada una.
3. **RNF-3**: No hay exigencia de disponibilidad. Una caída de una hora se asume como pérdida de
   esa hora de venta, y no se construye respaldo ni continuidad para ese caso.
4. **RNF-4**: Dos personas que elijan la misma butaca al mismo tiempo, por el canal que sea,
   nunca pueden terminar las dos con esa butaca. Una de las dos recibe un rechazo.
5. **RNF-5**: La indisponibilidad del correo no puede impedir una venta. Si el correo con el
   número de compra no sale, la compra igual queda registrada y el número se muestra en pantalla.

## Criterios de aceptación

Solo los que no se deducen del enunciado del requisito.

| ID | Criterio | Requisito asociado |
|---|---|---|
| CA-1 | Con dos personas eligiendo la misma butaca de la misma función al mismo tiempo, una queda con la butaca bloqueada y la otra recibe el rechazo. Nunca las dos. | RNF-4, RF-10 |
| CA-2 | Una compra confirmada 1 segundo antes de la hora de inicio se registra; una confirmada 1 segundo después se rechaza. | RN-21, RF-13 |
| CA-3 | Para una función de miércoles, el sistema no ofrece la categoría estudiante ni permite reservar, y toda entrada sale a la mitad del precio general. | RN-13, RN-14, RF-14 |
| CA-4 | Cambiado el precio general, una compra registrada antes del cambio conserva su monto original en el cierre de caja y en el reporte al distribuidor. | RN-16, REG-1 |
| CA-5 | Cancelada una función con entradas vendidas y validadas, ninguna de sus compras queda como pagada, y la función aparece marcada como cancelada en el reporte del mes con sus entradas vendidas y devueltas. | RN-41, RF-23, RF-27 |
| CA-6 | La parte de ventanilla del cierre coincide con el efectivo cobrado menos las devoluciones entregadas en esa jornada, y no incluye ninguna compra de internet. | RN-44, RN-45, RF-26 |
| CA-7 | Una película de 120 minutos programada a las 19:00 en Sala 1 impide programar otra función en Sala 1 antes de las 21:20, y admite una a las 21:20. | RN-6, RF-3 |
| CA-8 | Una función que empieza a las 23:00 del viernes se puede cancelar a las 00:15 del sábado, y aparece en el cierre de la jornada del viernes. | RN-10, RN-11, RN-42 |
| CA-9 | En el mapa que ve quien compra por internet, una butaca bloqueada y una vendida se ven exactamente igual. En el de taquilla, distinto. | RN-56, RN-57, RF-9 |
| CA-10 | El mapa de una función de Sala 1 muestra 120 butacas en 10 filas de 12, de la A1 a la J12, con el pasillo entre la 6 y la 7 de cada fila. | RN-1, RN-2, RF-9 |

## Dependencias

- Un servicio de correo electrónico saliente, usado para el número de compra, el aviso de
  función cancelada y el reporte mensual al distribuidor.

## Preguntas abiertas

Ninguna. Las cinco que dejó la entrevista quedaron resueltas y convertidas en reglas:

| Pregunta original | Dónde quedó |
|---|---|
| Forma de entrega del reporte al distribuidor | RN-47 a RN-49, RF-27 a RF-29 |
| Solapamiento de funciones en una misma sala | RN-4 a RN-6, RF-1, RF-3, CA-7 |
| Cómo se le devuelve la plata a quien compró por internet | RN-45, RF-24 |
| Hasta cuándo se puede cancelar una función | RN-42, RF-23 |
| A qué día se imputa una función que termina pasada la medianoche | RN-10, RN-11, CA-8 |

## Referencias

- `Consigna Caso Practico 3 - SINT-732.docx` — contexto del Cine Variedades, las cinco frases de
  la dueña, y las restricciones de alcance impuestas por el curso.
- Entrevista de clarificación de esta sesión: 22 preguntas de contexto más las 5 preguntas
  abiertas, registradas en la conversación que produjo este documento.
