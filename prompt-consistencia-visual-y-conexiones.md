# Prompt para Claude Code — Consistencia visual, módulos conectados y limpieza

Copia y pega todo este archivo como prompt en Claude Code, dentro del repo del proyecto. Cubre varios cambios independientes entre sí — puedes pedirle que los haga todos en una sola sesión, o repetir este mismo prompt en partes si prefieres revisarlos por separado.

## Contexto

Estoy en `private/backend` (Express + Mongoose) y `private/frontend` (React + Vite) del proyecto Industrias Charly. El sistema funciona, pero tiene inconsistencias visuales (el mismo estado se pinta de colores distintos según la pantalla), módulos que deberían hablarse entre sí y no lo hacen, campos del modelo que ya no se usan, y un par de nombres de pestaña que se confunden entre sí. Quiero limpiar todo eso.

## Parte 1 — Modal "Info Pedido" (`private/frontend/src/pages/Inventario.jsx`)

Hoy la tabla de este modal tiene una columna "Estado" (con `StatusPill`) y una columna "Acciones" aparte, que a veces tiene un botón, a veces una insignia, y a veces queda completamente vacía (cuando la línea ya está empacada) — se ve incompleto.

Reemplázala por una lista de filas tipo tarjeta (una por producto), cada una con: nombre/color/cantidad a la izquierda, y a la derecha SIEMPRE una etiqueta de estado visible (nunca vacío) más, solo cuando aplica, el botón de la siguiente acción justo al lado:
- Sin verificar → etiqueta gris + botón "Verificar".
- En fabricación (`sentToManufacturing`, sin `verified`) → etiqueta ámbar + texto pequeño "esperando lote" (sin botón, la acción de empacar esto ocurre en Fabricación, no aquí).
- Verificado → etiqueta azul + botón "Empacar".
- Empacado → etiqueta verde con ícono de check (sin botón, fila resuelta).
- Entregado (`order.delivery?.driver` existe) → etiqueta verde con ícono de check (sin botón).

No cambies la lógica (`openVerify`, `handlePack`, `sendToManufacturing` siguen igual), solo la estructura visual de cada fila.

## Parte 2 — Un solo color por estado en toda la app

Hoy el mismo concepto se pinta distinto según el componente. Ejemplo real: "enviado a fabricación" es azul en `StatusPill` (label `"Enviado"`), verde en una insignia hecha a mano en el mismo modal, y ámbar en la barra de progreso (`orderProgress.js`). Fija esta paleta como la única fuente de verdad y aplícala en todos lados:

| Concepto | Tono |
|---|---|
| Sin verificar | gris |
| Verificado | azul |
| Enviado a fabricación / En Fabricación | ámbar |
| Empacado | verde |
| Entregado | verde |
| Recolectando (Logística) | amarillo |

Cambios concretos:
- En `private/frontend/src/components/ui/StatusPill.jsx` (`STATUS_TONE`): cambia `Empacado` de `blue` a `green`; cambia `"Sin Verificar"` de `yellow` a `gray`; agrega `"En Fabricación"` como `amber` si no existe ya con ese tono exacto; agrega `"Recolectando": "yellow"` para que Logística no tenga que pasar `tone="yellow"` a mano.
- En `private/frontend/src/lib/orderProgress.js` (`BAR_COLORS`): cambia `empacado` de `bg-purple-500` a un verde (`bg-emerald-500` o el que ya uses para "green" en el resto de la app).
- En el modal "Info Pedido" (parte 1), el label que hoy dice `"Enviado"` para `sentToManufacturing` cámbialo a `"En Fabricación"` — evita que choque con la palabra `"Enviado"` que ya se usa en Inventario > Lotes Reportados para un concepto totalmente distinto (lote enviado a almacén).
- Si te queda tiempo: reemplaza las insignias hechas a mano (`<span className="...emerald-50...">`) que representan un estado de una sola palabra por `<StatusPill status="..." />`, para que todas compartan la misma forma (redondeada completa + punto) en vez de mezclarse con el estilo `rounded-lg` + ícono que usan hoy. Ejemplos: el badge "Enviado" de Lotes Reportados, "Empacado · en Fabricación" de Fabricación de pedidos, los chips de "Recogido" en Logística. Esto es una mejora, no bloqueante — prioriza lo de arriba primero.

## Parte 3 — Conectar Finanzas con Pedidos

Un pedido pagado hoy no genera ninguna transacción en Finanzas — hay que capturarlo a mano dos veces. En `private/backend/src/controller/ordersController.js`, dentro de `updateOrder` (que es donde se guarda `paymentStatus`), detecta cuándo `paymentStatus` cambia a `"Pagado"` (y antes no lo era) y crea automáticamente una `Transaction`: `type: "Ingreso"`, `category: "Ventas"`, `amount: order.total`, `status: "Completado"`, `concept: "Venta pedido " + order.orderNumber`, `relatedOrder: order._id`, usando la misma lógica de generación de referencia (`TRAN-{año}-####`) que ya existe en `transactionsController.js`. Antes de crearla, verifica que no exista ya una transacción con ese `relatedOrder` y `category: "Ventas"` para no duplicar si el pedido se vuelve a guardar. Si `paymentStatus` cambia a `"Reembolsado"`, crea de la misma forma (con el mismo resguardo anti-duplicado) una transacción `type: "Gasto"`, `category: "Ventas"`, `concept: "Reembolso pedido " + order.orderNumber`.

En `transactionsController.js` (`getTransactions`/`getTransaction`), agrega `.populate("relatedOrder", "orderNumber")`, y en `private/frontend/src/components/transactions/TransactionTable.jsx` muestra el número de pedido como una pequeña referencia cuando `relatedOrder` exista, para que se note la conexión.

## Parte 4 — Campos muertos en el modelo

- Quita `batch` de `orderSchema` en `private/backend/src/models/Order.js` — quedó reemplazado por `items[].manufacturingBatch` (por línea). Antes de borrarlo, confirma con un `grep` en `private/frontend/src` que ningún componente lo lea o lo escriba (búscalo como `\.batch\b`), y quita también su `.populate("batch", ...)` en `ordersController.getOrder` y su manejo en `updateOrder`.
- `rawMaterials` y `qualityCheck` en `private/backend/src/models/ProductionBatch.js` no tienen ningún formulario que los llene hoy (confirmado: no aparecen en `BatchFormModal.jsx` ni en ningún otro componente). Quítalos del modelo para no dejar campos fantasma. Si prefieres conservarlos para una futura pantalla de control de calidad, no los borres — en su lugar dímelo y seguimos con eso aparte.

## Parte 5 — Nombres de pestaña que se confunden

En `private/frontend/src/pages/Fabricacion.jsx`, la pestaña `activeTab === "pedidos"` (la lista de líneas enviadas a fabricación, `manufacturingLines`) se llama "Pedidos" — se confunde con la pestaña vecina "Fabricación de pedidos" (los lotes ya creados). Renómbrala a "Por fabricar" (en el botón del selector de pestañas y en el `title` del `SectionCard` de esa tabla). No toques la pestaña "Pedidos" de `Inventario.jsx`, esa se queda igual.

## Parte 6 — KPI duplicado en Finanzas

En `private/frontend/src/pages/Finanzas.jsx`, las tarjetas "Rentabilidad neta" y "Flujo de caja" muestran el mismo número (`kpis.net` en ambas). Cambia "Flujo de caja" por algo distinto y ya disponible: la suma de `amount` de transacciones con `status === "Pendiente"` — labelalo como "Pendiente por cobrar/pagar".

## Parte 7 — Asistencia en Empleados

El menú lateral (`private/frontend/src/lib/nav.jsx`) promete "Asistencia, horas extra y planillas" para Empleados, pero `Empleados.jsx` no tiene nada de eso, aunque el modelo `Employee.attendance` (checkIn, checkOut, workedHours, overtimeHours) ya existe. Agrega una pestaña "Asistencia" en `Empleados.jsx` (mismo patrón de selector de pestañas que ya usan Inventario y Fabricación) con una tabla: empleado, fecha, entrada, salida, horas trabajadas, horas extra, y un botón/modal para registrar una marcación manual (no hay app móvil de marcación todavía). No hace falta calcular planilla completa en este cambio, con listar y registrar asistencia es suficiente por ahora. Necesitarás un endpoint nuevo en `employeesController.js`/`routes/employees.js` para agregar un registro al arreglo `attendance` de un empleado.

## Parte 8 — Configuración real + bodegas configurables

Reemplaza el placeholder de `Configuracion.jsx` por una versión mínima real: datos básicos de la empresa, y sobre todo una lista editable de bodegas que sustituya la constante hardcodeada `WAREHOUSES = ["Bodega A-1"]` en `private/frontend/src/hooks/useBatchForm.js` (usada en Inventario, el modal de verificación de pedidos, y los reportes de Fabricación). Crea un modelo `Warehouse` simple (`name`) con su controlador/rutas CRUD, y actualiza los lugares que hoy importan `WAREHOUSES` para que lean la lista real desde `/api/warehouses` en vez del arreglo fijo.

## Orden sugerido

Backend primero (partes 3, 4 y 8), después el modal y los colores (partes 1 y 2), y al final lo demás (partes 5, 6 y 7) — así cada parte se puede probar por separado sin depender de las otras.

## Verificación

- Verifica visualmente que "Verificado", "En Fabricación" y "Empacado" se vean del mismo color sin importar si los miras en el modal, la barra de progreso o cualquier insignia suelta.
- Marca un pedido como "Pagado" desde Pedidos y confirma que aparece una transacción nueva en Finanzas sin capturarla a mano, con el número de pedido visible.
- Confirma que las pestañas "Pedidos" (Inventario) y "Por fabricar" / "Fabricación de pedidos" (Fabricación) ya no se prestan a confusión.
- Confirma que el proyecto sigue corriendo sin errores después de quitar `order.batch`, `rawMaterials` y `qualityCheck` (no debe quedar ninguna referencia suelta).
