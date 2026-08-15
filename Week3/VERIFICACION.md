# VERIFICACIÓN FINAL — Cine Variedades (T22)

> Constancia del cierre del plan (`PLAN.md`, T22): el recorrido de los diez criterios de
> aceptación de `ESPECIFICACION.md`, la prueba de carga de `RNF-1`, las tres promesas
> transversales de `DISENO.md` y la revisión del alcance acumulado.
>
> **Fecha:** 15 de agosto de 2026 · Sesión 15.
> **Criterio de esta verificación:** nada se da por bueno porque «debería funcionar». Cada línea de
> este documento apunta a una prueba que corre o a una medición que se tomó.

## Cómo reproducir esta verificación

```
cd cine-variedades
npm test          # 251 pruebas, incluye src/aceptacion/ (los CA- y las promesas)
npm run typecheck # TypeScript estricto, sin errores
npm run carga     # prueba de carga de RNF-1: 200 usuarios contra el servidor real

cd entrada-cliente
npm test          # 15 pruebas de componentes
npm run typecheck && npm run build
```

**Resultado del 15/08/2026:** 251 pruebas en verde en `cine-variedades/`, 15 en
`entrada-cliente/`, typecheck limpio en los dos paquetes, `build` del cliente correcto y la prueba
de carga con sus seis comprobaciones cumplidas.

## 1. Los diez criterios de aceptación

Cada criterio tiene su propia prueba, nombrada por su identificador, en
`cine-variedades/src/aceptacion/criterios.prueba.ts` (17 pruebas). Los que hablan de canales o de
pantallas pasan por las rutas HTTP reales; los que fijan un instante al segundo o una jornada van
por el dominio, que recibe `ahora` como parámetro en vez de mirar el reloj.

| Criterio | Qué se verificó | Por dónde | Resultado |
|---|---|---|---|
| **CA-1** | Dos sesiones anónimas piden la misma butaca: una la obtiene, la otra recibe `ButacasYaTomadas` con el id que se adelantó. Se repite con **veinte** simultáneas: una sola gana y la tabla `ocupacion` tiene exactamente una fila para esa butaca | `POST /api/funciones/:id/bloqueo` | **Cumple** |
| **CA-2** | Pago a las 18:59:59 de una función de las 19:00 → compra registrada. Pago a las 19:00:01 con el bloqueo todavía vivo → rechazo «La función no está en venta» y **cero** filas en `compra` | Dominio (`bloquear` + `pagar`) | **Cumple** |
| **CA-3** | La cartelera de una función de miércoles ofrece solo `{ miercoles: 4000 }` —la mitad de 8000, sin estudiante—, la reserva se rechaza con su mensaje, y vender con categoría general o estudiante se rechaza | HTTP + dominio | **Cumple** |
| **CA-4** | Vendida una entrada a ₡8 000 y subido el precio a ₡12 000, la compra vieja conserva ₡8 000 en la entrada, en el cierre de caja y en el reporte del mes; la nueva cobra ₡12 000 | Dominio (`cierreDeCaja`, `reporteMensual`) | **Cumple** |
| **CA-5** | Cancelada una función con dos compras —una ya validada en la puerta—, ninguna queda `pagada`: ambas `devuelta`. En el reporte del mes la función aparece `cancelada: true` con sus 2 entradas y su monto a la vista | Dominio (`cancelarFuncion`) | **Cumple** |
| **CA-6** | Ventanilla = ₡16 000 cobrados − ₡8 000 entregados esa jornada = ₡8 000, y la compra de internet aparece **solo** en su propia parte. Se comprobó además que una devolución entregada otra jornada descuenta la de la entrega, no la de la venta | Dominio (`cierreDeCaja`) | **Cumple** |
| **CA-7** | Una película de 120 minutos a las 19:00 en Sala 1: programar a las 21:19 se rechaza diciendo «La primera hora posible es 21:20», y a las 21:20 se admite | Dominio (`programarFuncion`) | **Cumple** |
| **CA-8** | Función de las 23:00 del viernes: su venta de las 22:00 queda en la jornada del viernes y aparece en ese cierre; se cancela a las 00:15 del sábado sin rechazo y su compra queda devuelta | Dominio | **Cumple** |
| **CA-9** | Mapa público: una butaca bloqueada y una vendida son ambas `no-disponible`. Mapa de taquilla: `bloqueada`, `vendida` y `reservada` por separado, con el número de la reserva visible y la sesión anónima del bloqueo **nunca** expuesta (`RN-55`) | Las dos rutas de mapa | **Cumple** |
| **CA-10** | El mapa de Sala 1 devuelve 120 butacas, 10 filas (A–J) de 12, de la A1 a la J12. El **pasillo entre la 6 y la 7** se verifica en el cliente: exactamente una butaca por fila lleva el corte, y es la A6 | HTTP + prueba de componente | **Cumple** |

El pasillo de CA-10 se prueba en `entrada-cliente/src/componentes/MapaDeButacas.prueba.tsx`, porque
es presentación: el servidor entrega las 120 butacas y el cliente decide dónde cae el hueco.

## 2. `RNF-1` — 200 personas al mismo tiempo

`npm run carga` (`cine-variedades/src/carga/carga.ts`) levanta el **servidor real** —Fastify sobre
SQLite en modo WAL, el stack de T0— contra una base de datos de archivo temporal y dispara 200
compradores concurrentes. Cada uno sondea el mapa 3 veces (el refresco de 3 s de T19), bloquea una
butaca y, si la consigue, paga.

El escenario reparte los 200 sobre las **120 butacas de la Sala 1**, así que 80 chocan por diseño:
es la única forma de someter `RNF-4` a concurrencia real de proceso, que la suite no puede
reproducir porque corre en un solo hilo.

**Medición del 15/08/2026, primera corrida** (920 pedidos en 2,10 s):

| Operación | Pedidos | p50 | p95 | máximo |
|---|---|---|---|---|
| Mapa de butacas | 600 | 406,9 ms | 849,7 ms | 880,1 ms |
| Bloqueo | 200 | 325,9 ms | 540,0 ms | 545,7 ms |
| Pago | 120 | 258,9 ms | 377,3 ms | 381,6 ms |

Se corrió dos veces. La segunda dio 920 pedidos en **1,27 s** —bloqueo 198,2 / 331,0 / 335,5 ms y
pago 148,4 / 238,7 / 240,4 ms—, con los mismos 120 conseguidos, los mismos 80 rechazos y las seis
comprobaciones cumplidas otra vez. Los tiempos varían entre corridas según lo que esté haciendo la
máquina; **lo que no varía es el reparto**: siempre 120 butacas y ni una de más. Los números de
arriba son la corrida más lenta de las dos, que es la que conviene registrar.

**Comprobaciones, todas cumplidas:**

- Ningún fallo del servidor (cero respuestas 5xx).
- Ninguna respuesta fuera de 200 / 409: los 80 rechazos son exactamente los esperados.
- **`RNF-4`: ninguna butaca tomada dos veces** ni vendida dos veces, verificado contra la base
  después de la corrida.
- Nunca más entradas que butacas de la sala: 120 sobre 120.
- Los 200 recibieron respuesta; 120 compras pagadas.

Las latencias son el peor caso por construcción —los 200 arrancan en el mismo instante, sin ninguna
separación—, y aun así el pico de un viernes se resuelve en poco más de dos segundos. El
`ESPECIFICACION.md` no fija un umbral de tiempo de respuesta, así que la medición queda registrada
como línea de base, no como aprobación de un límite que nadie pidió.

## 3. Las tres promesas transversales de `DISENO.md`

Verificadas en `cine-variedades/src/aceptacion/promesas.prueba.ts` (8 pruebas).

**1. Toda operación que toca butacas es una sola transacción.** Dos comprobaciones: cuando otro se
adelantó con una butaca del grupo, ninguna del grupo queda tomada y no se escribe compra alguna; y
—forzando un fallo del disco **después** de que las butacas ya fueron tomadas, dentro de la misma
transacción— no queda ninguna butaca tomada, ninguna compra y ninguna entrada. Es el «si falla en el
medio» de la promesa, observado y no supuesto.

**2. Ningún aviso revierte nada (`RNF-5`).** Con un Avisos que se cae en cada llamada: la compra por
internet queda registrada y con su número, la reserva de estudiante queda hecha, y la cancelación de
una función es firme aunque no salga ni un correo a los compradores.

**3. Ningún mensaje dice «error inesperado».** Un barrido sobre todos los `.ts` y `.tsx` del
servidor y del cliente busca siete frases genéricas («error inesperado», «algo salió mal», «error
interno», «internal server error»…) y no encuentra ninguna en código —los comentarios que citan la
promesa se descartan, y una prueba aparte comprueba que el barrido no quedó ciego al descartarlos—.
Además se verificó por HTTP que un rechazo sin clase propia llega con el mensaje del dominio («La
función no está en venta»), no con uno genérico.

**Límite conocido, ya documentado en `errores.ts`:** los rechazos que no tienen clase de error
propia son `Error` simples. La capa de entrada no puede distinguirlos de un error de programación
real sin envolver cada `throw` escrito en T1–T17, así que ambos salen como 400 con su mensaje. Para
quien opera esto es correcto —el mensaje de dominio siempre está en español y nombra el objeto
concreto—, pero un fallo técnico auténtico se vería como un rechazo de negocio.

## 4. Revisión del alcance acumulado

Los puntos de **Fuera de alcance** de `ESPECIFICACION.md`, uno por uno, contra el código construido:

| Fuera de alcance | Cómo se comprobó | Estado |
|---|---|---|
| Más de un cine o más de dos salas | `SALAS` en `cartelera.ts` tiene exactamente dos entradas, sembradas una sola vez | Respetado |
| Cobro real | El pago es un `pagoSimulado()` inyectable; no hay ninguna pasarela ni credencial de pago en el árbol | Respetado |
| Entradas impresas y códigos de barras | Sin rastro de impresión, códigos de barras ni QR en servidor ni cliente | Respetado |
| Cuentas de cliente | No existe tabla de usuarios ni de sesiones; quien compra por internet lleva un id anónimo en cookie | Respetado |
| Acceso del distribuidor | Solo recibe correo; no tiene ruta, pantalla ni operador | Respetado |
| Envío al contador o a entidad fiscal | Sin rastro | Respetado |
| Pases o vales para otra función | La única reversa es la devolución del dinero | Respetado |
| Historial de reservas vencidas y bloqueos expirados | El barrido **borra** las filas vencidas y solo devuelve cuántas (`REG-8`) | Respetado |
| Exigencia de disponibilidad | Sin respaldo ni continuidad; el service worker precachea el cascarón y **nunca** rutas `/api` (`RNF-3`) | Respetado |
| Butacas con condición especial | La tabla `butaca` tiene sala, fila y número: ninguna columna de categoría | Respetado |
| Precios distintos por película, sala u horario | `precio_vigente` guarda general, estudiante y fecha desde: nada más | Respetado |
| Límite de butacas por compra | No existe tal validación en ningún punto | Respetado |
| Venta con la función ya empezada | Rechazada por los dos canales; es CA-2 | Respetado |
| Continuidad en papel de la taquilla | Sin procedimiento de respaldo | Respetado |

**Esquema:** las 13 entidades del modelo de `DISENO.md` (`sala`, `butaca`, `pelicula`,
`semana_cartelera`, `funcion`, `precio_vigente`, `ocupacion`, `reserva`, `compra`, `entrada`,
`operador`, `envio_reporte`, `configuracion`), más `aviso` —tabla propia del componente Avisos,
agregada en T14 y ya justificada allí porque Avisos no sabe qué es una compra—. Ninguna tabla de
más: la `entrada_nueva` que aparece en la migración `002` es la tabla intermedia del patrón de
SQLite para cambiar un CHECK, y termina renombrada a `entrada`.

## 5. Hallazgo de esta sesión: la suite caducaba con el calendario

Al tomar la línea de base, **15 de las 226 pruebas fallaban**. Ninguna era un defecto del sistema.

**Causa raíz.** Las tres suites de rutas HTTP dejaban que el servidor leyera el reloj real
(`ahoraServidor()`) mientras fijaban su escenario en fechas de agosto de 2026. Dos suites usaban la
función del viernes 14/08 a las 19:00, y la tercera —que ya calculaba fechas relativas— programaba
la suya el viernes de la semana en curso. Corriendo un sábado, esa función ya había empezado: no
estaba en venta (`RN-21`) y su jornada había cerrado (`RN-42`). Evidencia directa: la misma función
da `enVenta = true` al 12/08 y `false` con el instante real de hoy.

**Arreglo, decidido con el usuario.** Congelar el reloj en cada suite HTTP con
`vi.setSystemTime`, en el instante coherente con su propio escenario. No se tocó una sola línea de
código de producción, el escenario y las aserciones quedaron intactos, y las pruebas dejaron de
depender del día en que se corren. Las 251 pasan.

**Por qué importa más allá del arreglo:** las 211 pruebas de dominio nunca fallaron, porque reciben
`ahora` como parámetro en vez de mirar el reloj —la misma decisión de `DISENO.md` que mantiene las
reglas fuera del Reloj—. Las que caducaron fueron exactamente las de la única capa que sí lee la
hora. La disciplina ya estaba en el diseño; lo que faltó fue aplicarla al probar esa capa.

## 6. Estado final

| Comprobación | Resultado |
|---|---|
| Pruebas de `cine-variedades/` | 251 en verde (19 archivos) |
| Pruebas de `entrada-cliente/` | 15 en verde (3 archivos) |
| TypeScript estricto, ambos paquetes | Sin errores |
| `build` del cliente (PWA) | Correcto |
| Criterios de aceptación CA-1 a CA-10 | 10 de 10 cumplidos |
| `RNF-1` con 200 usuarios simultáneos | Sostenido, sin 5xx y sin doble venta |
| Promesas transversales de `DISENO.md` | 3 de 3 verificadas |
| Alcance de `ESPECIFICACION.md` | Sin desvíos |

**Queda abierto** —no es un defecto, es trabajo de documentación pendiente de aprobación sección por
sección, según `CLAUDE.md` §6—: registrar en `DISENO.md` las decisiones tomadas durante la
construcción que ese documento dejaba abiertas (Carbon y PWA de `CLAUDE.md` §8, el proveedor SMTP de
T14, el tercer trabajo del Reloj de T17, y el mapa a tamaño real en pantalla angosta de T19). Están
todas anotadas en `STATUS.md` con su razón.
