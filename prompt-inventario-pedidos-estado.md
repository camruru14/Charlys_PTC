# Prompt para Claude Code — Estado de pedidos en Inventario > Pedidos

Copia y pega todo este archivo como prompt en Claude Code, dentro del repo del proyecto.

---

Estoy trabajando en `private/backend` (Express + Mongoose) y `private/frontend` (React + Vite) del proyecto Industrias Charly. Necesito arreglar cómo se muestra y se filtra el estado de los pedidos en la pestaña "Pedidos" de `private/frontend/src/pages/Inventario.jsx`.

## El problema

Un pedido (`Order`) tiene varios productos/líneas (`order.items`), y cada línea avanza de forma independiente: `verified`, `packed`, `sentToManufacturing` (ver `private/backend/src/models/Order.js`). Hoy hay dos representaciones de "estado" que no coinciden entre sí:

1. `order.status` (enum `Pendiente/Procesando/En Fabricación/Empacado/En Tránsito/Entregado`, definido en `Order.js` y mostrado en `private/frontend/src/pages/Pedidos.jsx`). El backend lo sobreescribe mal: en `ordersController.packOrderItem` y `ordersController.sendItemToManufacturing` (`private/backend/src/controller/ordersController.js`), en cuanto **una sola línea** se marca como empacada o enviada a fabricación, todo el pedido pasa a "Empacado" o "En Fabricación", aunque las demás líneas sigan sin tocar.
2. La columna "Estado" de la tabla "Pedidos" dentro de `Inventario.jsx` (pestaña `activeTab === "pedidos"`), que calcula un texto local aparte a partir de los items (ver el bloque de ternarys anidados alrededor de la variable `status` en esa tabla, líneas ~705-721 actualmente), con formatos ad-hoc tipo `"Empacado 1, Enviado 1"` o `"Sin Verificar - 2"`.

Quiero corregir las dos cosas.

## Parte 1 — Backend: `order.status` correcto

En `ordersController.js`, `order.status` (el enum del modelo, sin tocar el enum en sí) debe recalcularse siempre a partir del estado real de **todos** los items del pedido, no fijarse a mano en cada acción individual. Crea una función pura, por ejemplo `computeOrderStatus(order)`, que dado `order.items` devuelva uno de los valores válidos del enum existente, con esta prioridad:
- Si `order.delivery?.driver` existe → no tocar el status derivado de items (el ciclo de despacho ya lo maneja `assignDelivery`/`updateStatus`).
- Si todos los items están `packed` → `"Empacado"`.
- Si algún item está `sentToManufacturing` y ninguno está `packed` → `"En Fabricación"`.
- Si algún item está `verified` (o `packed`) pero no todos están `packed` → `"Procesando"`.
- Si ningún item tiene avance → `"Pendiente"`.

Usa esta función en `packOrderItem`, `sendItemToManufacturing`, `cancelManufacturingRequest` y `verifyOrderItem` en vez de asignar el status a mano. Revisa también `dashboardController.js` y cualquier otro lugar que dependa de valores exactos de `order.status` antes de cambiar el comportamiento, para no romper KPIs existentes.

## Parte 2 — Frontend: tabla "Pedidos" en Inventario.jsx

En la pestaña "pedidos" de `Inventario.jsx`, sustituye las columnas actuales `Num Lotes / Lotes Verificados / Empacados / En Fabricación / Estado` por:

- **Una sola columna "Progreso"**: una barra horizontal segmentada (una franja de color por cada grupo de items: gris = sin verificar, azul = verificado, ámbar = enviado a fabricación, verde = empacado), del ancho proporcional a la cantidad de items en cada estado, con un texto pequeño debajo tipo `"2 empacados · 1 enviado a fabricación · 1 sin verificar"`. Si el pedido tiene `delivery?.driver` asignado, la barra se reemplaza por el pill "Entregado" como hoy.
- Deja intacto el modal "Info Pedido" (`pedidoInfoOrder`) que ya muestra el detalle línea por línea — no hace falta tocarlo.

Crea una función auxiliar (puede vivir en `private/frontend/src/lib/`, ej. `orderProgress.js`) `getItemStatusCounts(order)` que devuelva `{ sinVerificar, verificado, enviado, empacado }` a partir de `order.items`, y `macroStatus(order)` que devuelva uno de `"sinVerificar" | "verificado" | "enviado" | "empacado" | "parcial"` (`"parcial"` cuando hay más de un grupo con conteo > 0), o `"entregado"` si `order.delivery?.driver`. Usa estas mismas funciones tanto para pintar la barra como para el filtro (siguiente punto), así nunca se desincronizan.

## Parte 3 — Filtro

Encima de la tabla "Pedidos", agrega:
- Un `<select>` de estado con las opciones: Todos, Sin verificar, Verificado, En fabricación, Empacado, Parcial (mezcla), Entregado — filtrando por `macroStatus(order)`. Sigue el mismo patrón visual y de implementación que el filtro `statusFilter` que ya existe en `WarehouseItemsTable` dentro del mismo archivo (mismo `selectFilterClass`, mismo estilo de `useMemo` para `filteredItems`).
- Un checkbox "Solo con pendientes" que filtra los pedidos donde `getItemStatusCounts(order).sinVerificar > 0`, sin importar su `macroStatus`.
- Todo el filtrado es client-side sobre `requestedOrders` (ya viene cargado por `useFetch("/orders")"`), no hace falta ningún endpoint nuevo.

## Verificación

- Confirma manualmente (o con un test si aplica) que empacar un solo item de un pedido de 3 items ya NO pone `order.status` en `"Empacado"` hasta que los 3 estén empacados.
- Confirma que la pestaña "Pedidos" de `Pedidos.jsx` y la de `Inventario.jsx` muestran información consistente para el mismo pedido.
- Prueba el filtro con un pedido mixto (algunos items empacados, otros sin verificar) y confirma que aparece en "Parcial" y también en "Solo con pendientes".
