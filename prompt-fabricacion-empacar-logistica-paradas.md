# Prompt para Claude Code — Empacar desde Fabricación + paradas de recolección en Logística

Copia y pega todo este archivo como prompt en Claude Code, dentro del repo del proyecto. Da por hecho que la barra de progreso y el filtro de la pestaña "Pedidos" en Inventario ya están implementados (incluida la función que recalcula `order.status` a partir de los items, si la agregaste ahí — reutilízala en vez de duplicar lógica).

## Contexto

Estoy trabajando en `private/backend` (Express + Mongoose) y `private/frontend` (React + Vite) del proyecto Industrias Charly. Quiero cerrar dos huecos del flujo de pedidos:

1. Cuando un producto de un pedido se manda a fabricar (categoría `"Pedido"` en `ProductionBatch`, creado por `ordersController.manufactureOrderItem`), hoy el único camino para darlo por terminado es el flujo normal de "Reportar" (que lo manda a Inventario como stock genérico) — y ese stock nunca se reconecta con la línea del pedido que lo originó. Quiero que estos lotes se empaquen directo desde Fabricación, sin pasar por Inventario.
2. Un pedido puede terminar con productos listos en dos lugares distintos: **Almacén** (productos que ya había en stock, verificados y empacados desde Inventario > Pedidos) y **Fabricación** (productos que no había en stock, se mandaron a fabricar y se empacan ahí mismo). Quiero que se le asigne **un solo motorista** al pedido completo, y que el sistema lleve un checklist de por dónde tiene que pasar a recoger antes de salir donde el cliente — nunca más de un motorista para el mismo pedido.

## Parte 1 — Modelo (`private/backend/src/models/Order.js`)

En `orderItemSchema`, agrega:
```js
packedLocation: { type: String, enum: ["Almacén", "Fabricación"] },
```
Se llena solo (nunca a mano) cuando la línea se marca como empacada: `"Almacén"` si se empacó por el flujo normal de Inventario > Pedidos (`packOrderItem`), `"Fabricación"` si se empacó por el nuevo flujo de Fabricación (parte 2).

En `deliverySchema`, agrega:
```js
pickupWarehouseAt: { type: Date },
pickupFactoryAt: { type: Date },
```
Cada uno se llena cuando Logística confirma que el motorista ya recogió lo que le tocaba en ese lugar. Si el pedido nunca tuvo nada que recoger en un lugar, ese campo se queda vacío y simplemente no se muestra ni se exige en el frontend.

## Parte 2 — Backend: empacar desde Fabricación (`ordersController.js` + `routes/orders.js`)

Agrega una función nueva en `ordersController.js`, por ejemplo `packManufacturedItem`, análoga a `packOrderItem` pero sin exigir `item.verified` (no aplica: este stock es exclusivo para este pedido, no hay nada que verificar contra Inventario). Debe:
- Recibir `req.params.id` (pedido) y `req.params.index` (línea).
- Verificar que `order.items[index].manufacturingBatch` exista y que el lote (`ProductionBatch`) tenga `status === "Completado"`; si no, responder 400 con un mensaje claro.
- Marcar `item.verified = true`, `item.packed = true`, `item.packedAt = new Date()`, `item.packedLocation = "Fabricación"`.
- Recalcular `order.status` igual que hace `packOrderItem` (reutiliza la misma función/lógica que ya exista para eso, no la dupliques).
- **No** tocar `InventoryModel` para nada — este flujo nunca pasa por Inventario.

Registra la ruta en `routes/orders.js`, siguiendo el mismo patrón que las demás:
```js
router.route("/:id/items/:index/pack-manufactured").patch(ordersController.packManufacturedItem);
```

Agrega también `ordersController.confirmPickup`, que recibe `req.params.id` y `{ location }` (`"Almacén" | "Fabricación"`) en el body, y marca `order.delivery.pickupWarehouseAt` o `order.delivery.pickupFactoryAt` con la fecha actual según corresponda. Registra la ruta:
```js
router.route("/:id/delivery/pickup").patch(ordersController.confirmPickup);
```

No cambies el enum de `order.status` ni la lógica de `assignDelivery` — el checklist de recolección es un dato adicional en `delivery`, no un estado nuevo del pedido.

## Parte 3 — Frontend: `private/frontend/src/pages/Fabricacion.jsx` (pestaña "Fabricación de pedidos")

En la tabla que recorre `pedidoRangeList` (lotes con `category === "Pedido"`), necesitas encontrar, para cada lote, a qué pedido/línea pertenece: recorre `orders` (ya viene de `ordersData`, igual que en `manufacturingLines`) buscando el item cuyo `manufacturingBatch` coincida con el `_id` del lote. Con eso:

- Si la línea ya tiene `packed === true` → muestra un badge `"Empacado · en Fabricación"` (mismo estilo que el badge "Reportado" que ya existe), sin botón.
- Si el lote tiene `status === "Completado"` y la línea aún no está empacada → botón `"Empacar"` que llama `PATCH /orders/:id/items/:index/pack-manufactured` y refresca `refetch()` + `refetchManufacturingOrders()`.
- Si el lote no está `"Completado"` todavía → sin botón, mismo texto informativo que ya usas en otros lados (algo como "Editar lote para avanzar").
- Quita los botones "Reportar" / "Reportado" (`openReport` / `openUndoReport`) de esta tabla — esos se quedan únicamente en la pestaña "Lotes de fabricación" (`diarioRangeList`), no la toques ahí.

## Parte 4 — Frontend: `private/frontend/src/pages/Logistica.jsx`

**Elegibilidad para aparecer en "Pedidos para despacho":** hoy el filtro `shipping` exige `["Empacado", "En Tránsito", "Entregado"].includes(o.status)`. Con `order.status` bien calculado (solo es `"Empacado"` cuando TODOS los items están empacados), eso ya no sirve para permitir asignar motorista apenas el primer producto esté listo. Cambia el filtro para incluir también cualquier pedido con al menos un item `packed === true`, por ejemplo definiendo `hasPackedItems(order)` y usando `hasPackedItems(o) || ["En Tránsito", "Entregado"].includes(o.status)`.

**Paradas requeridas:** agrega una función `getRequiredPickups(order)` que devuelva qué ubicaciones aplican, mirando `order.items` con `packed === true` (o que vayan a necesitarlo — usa `packedLocation` de los ya empacados): incluye `"Almacén"` si algún item tiene `packedLocation === "Almacén"`, e incluye `"Fabricación"` si algún item tiene `packedLocation === "Fabricación"`. Un pedido puede requerir una sola parada o las dos.

**Columna "Paradas" en la tabla:** un chip por cada ubicación requerida — verde con check si el campo correspondiente (`delivery.pickupWarehouseAt` / `delivery.pickupFactoryAt`) ya tiene fecha, gris/neutro si todavía no.

**Estado mostrado:** si el pedido tiene motorista asignado pero le falta alguna parada por recoger, muestra el pill como `"Recolectando"` en vez del `dispatchStatus`/`status` normal (esto es solo visual en el frontend, no un valor nuevo en la base de datos). Una vez todas las paradas requeridas están recogidas, vuelve a mostrar el pill normal (`dispatchStatus` o `status`, como ya hace hoy).

**Modal "Editar entrega":** agrega una sección "Paradas de recolección" listando cada ubicación requerida con su cantidad de productos (`order.items.filter(i => i.packedLocation === loc).length`) y, o bien un badge "Recogido" si ya tiene fecha, o un botón "Confirmar recogido" que llama `PATCH /orders/:id/delivery/pickup` con `{ location }` y refresca (`refetch()`).

**Modal "Asignar":** sigue igual (elegir motorista/vehículo/dirección), solo asegúrate de que ahora se pueda abrir para pedidos con solo una parte de sus items empacados (por el cambio en la elegibilidad de arriba).

## Verificación

- Crea un pedido de prueba con 2 productos: uno con stock disponible (se verifica y empaca desde Inventario) y otro sin stock (se envía a fabricación, se fabrica, se completa y se empaca desde Fabricación). Confirma que cada línea termina con el `packedLocation` correcto.
- Asigna un motorista al pedido en cuanto el primer producto esté empacado (antes de que el segundo esté listo) y confirma que aparece "Recolectando" con una parada pendiente.
- Confirma la parada de Fabricación una vez el segundo producto se empaque ahí, y verifica que el pedido deja de mostrar "Recolectando".
- Confirma que un pedido con todos sus productos ya en stock (nunca pasa por Fabricación) solo muestra la parada "Almacén", nunca "Fabricación".
