import { routeLabel } from "./logistics";
import { api } from "./api";
import { formatClock, formatShortDate } from "./format";

// Preparación de pedidos a partir de /orders y /inventory, portado de
// Web/private/frontend/src/lib/inventoryOrders.js (Inventario > Pedidos):
// bodega sugerida por línea, estado de cada línea (o de cada parte de una
// línea dividida), estado macro del pedido y avance.
//
// Una línea dividida (fromStockQty + toManufactureQty) tiene dos partes: la
// tomada de bodega (verificada; empacada con stockPackedAt) y la enviada a
// fabricar (manufacturingBatch; empacada con manufacturePackedAt).

const keyOf = (product, color) => `${product}|${color || ""}`;

// Productos terminados de almacén que cuentan como existencia (sin los que
// vienen de un lote reportado), igual que finishedItems en Inventario.jsx.
export function finishedItemsOf(inventory = []) {
  return inventory.filter((i) => !i.batchNumber && i.category === "Producto Terminado");
}

// Mapa producto+color -> bodegas con existencia (mayor stock primero).
export function buildStockMap(finishedItems) {
  const map = new Map();
  for (const i of finishedItems) {
    if (!i.location || !(Number(i.stock) > 0)) continue;
    const key = keyOf(i.name, i.color);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ warehouse: i.location, stock: Number(i.stock) });
  }
  for (const list of map.values()) list.sort((a, b) => b.stock - a.stock);
  return map;
}

export function stockOptionsFor(item, stockMap) {
  return stockMap.get(keyOf(item.product, item.color)) || [];
}

// Bodega sugerida: la de mayor stock entre las que cubren la cantidad; si
// ninguna alcanza pero alguna tiene algo, existencia parcial con la de mayor
// stock; si ninguna tiene, sin existencia.
export function suggestWarehouse(item, stockMap) {
  const options = stockOptionsFor(item, stockMap);
  const full = options.find((o) => o.stock >= item.quantity);
  if (full) return { kind: "full", warehouse: full.warehouse, available: full.stock, options };
  if (options.length) return { kind: "partial", warehouse: options[0].warehouse, available: options[0].stock, options };
  return { kind: "none", warehouse: null, available: 0, options };
}

export function isSplit(item) {
  return item.fromStockQty != null && item.toManufactureQty != null;
}

// Partes a mostrar de una línea, cada una con su estado (dominio
// linea-inventario) y la cantidad que representa.
export function lineParts(item, stockMap) {
  if (isSplit(item)) {
    return [
      { part: "stock", qty: item.fromStockQty, status: item.stockPackedAt ? "Empacado" : "Verificado" },
      { part: "manufacture", qty: item.toManufactureQty, status: item.manufacturePackedAt ? "Empacado" : "En fabricación" },
    ];
  }
  if (item.packed) return [{ part: "whole", qty: item.quantity, status: "Empacado" }];
  if (item.sentToManufacturing) return [{ part: "whole", qty: item.quantity, status: "En fabricación" }];
  if (item.verified) return [{ part: "whole", qty: item.quantity, status: "Verificado" }];
  const suggestion = suggestWarehouse(item, stockMap);
  const status = { full: "Por verificar", partial: "Existencia parcial", none: "Sin existencia" }[suggestion.kind];
  return [{ part: "whole", qty: item.quantity, status, suggestion }];
}

// Línea lista: verificada o empacada por completo (una dividida, cuando su
// parte fabricada ya está empacada).
function isReady(item) {
  if (isSplit(item)) return Boolean(item.manufacturePackedAt);
  return Boolean(item.packed || (item.verified && !item.sentToManufacturing));
}

// Pendiente esperando un lote de fabricación.
function isWaitingBatch(item) {
  if (isSplit(item)) return !item.manufacturePackedAt;
  return Boolean(item.sentToManufacturing && !item.packed);
}

// Pendiente ya verificada, lista para empacar.
function isVerifiedPending(item) {
  if (isSplit(item)) return Boolean(item.manufacturePackedAt && !item.stockPackedAt);
  return Boolean(item.verified && !item.sentToManufacturing && !item.packed);
}

function isProcessed(item) {
  return Boolean(item.verified || item.sentToManufacturing || item.packed || item.stockPackedAt || item.manufacturePackedAt);
}

// Estado macro del pedido (dominio pedido-inventario). Primero manda el
// estado real del pedido (lo cambia Logística: En Tránsito al salir la ruta,
// Entregado al entregar) y la recogida del motorista; si no, se calcula por
// líneas. isDispatched no llama a esta función, así que no hay ciclo.
export function inventoryMacroStatus(order) {
  if (order.status === "Entregado") return "Entregado";
  if (order.status === "En Tránsito") return "En Tránsito";
  if (isDispatched(order)) return "Recogido";
  const items = order.items || [];
  if (items.length > 0 && items.every((i) => i.packed)) return "Empacado";
  const pending = items.filter((i) => !i.packed);
  if (pending.length > 0 && pending.every(isWaitingBatch)) return "Esperando lote";
  if (pending.length > 0 && pending.every(isVerifiedPending)) return "Listo para empacar";
  if (!items.some(isProcessed)) return "Sin verificar";
  return "Verificando";
}

// Conteo por estado principal de cada línea, en el orden de la ficha.
export function lineCounts(order, stockMap) {
  const counts = { empacado: 0, verificado: 0, porVerificar: 0, parcial: 0, sinExistencia: 0, enFabricacion: 0 };
  for (const item of order.items || []) {
    if (item.packed) counts.empacado += 1;
    else if (isWaitingBatch(item)) counts.enFabricacion += 1;
    else if (isVerifiedPending(item)) counts.verificado += 1;
    else {
      const kind = suggestWarehouse(item, stockMap).kind;
      if (kind === "full") counts.porVerificar += 1;
      else if (kind === "partial") counts.parcial += 1;
      else counts.sinExistencia += 1;
    }
  }
  return counts;
}

// [clave de lineCounts, estado de la línea (dominio linea-inventario)], en
// el orden de la barra de avance de la web.
export const COUNT_STATUS = [
  ["empacado", "Empacado"],
  ["verificado", "Verificado"],
  ["porVerificar", "Por verificar"],
  ["parcial", "Existencia parcial"],
  ["sinExistencia", "Sin existencia"],
  ["enFabricacion", "En fabricación"],
];

// Líneas sin procesar (por verificar, parciales o sin existencia).
export function unprocessedCount(order) {
  return (order.items || []).filter((i) => !isProcessed(i) && !isSplit(i)).length;
}

// Despachado: ya salió, o está en una ruta de Logística y todas sus líneas
// por llevar (empacadas sin entregar) ya se recogieron.
export function isDispatched(order) {
  if (order.status === "En Tránsito" || order.status === "Entregado") return true;
  if (!order.delivery?.route) return false;
  const carried = (order.items || []).filter((i) => i.packed && !i.deliveredAt);
  return carried.length > 0 && carried.every((i) => i.pickedUpAt);
}

// Fecha del último cambio de status (la que filtra el rango en Recogido,
// En Tránsito y Entregado).
export function lastStatusAt(order) {
  const history = order.statusHistory || [];
  return history.length ? history[history.length - 1].at : order.updatedAt;
}

// «2 de 6 listos» o «1 de 2 · LOTE-2026-0012 en proceso» si espera un lote.
export function progressLabel(order) {
  const items = order.items || [];
  const ready = items.filter(isReady).length;
  const waiting = items.find(isWaitingBatch);
  const batch = waiting?.manufacturingBatch;
  if (batch?.batchNumber) {
    return `${ready} de ${items.length} · ${batch.batchNumber} ${String(batch.status || "").toLowerCase()}`;
  }
  return `${ready} de ${items.length} listos`;
}

// Líneas sin procesar con existencia completa en una bodega (para «Verificar
// todo»), con su bodega sugerida.
export function fullyVerifiableLines(order, stockMap) {
  return (order.items || []).flatMap((item, index) => {
    if (isProcessed(item) || isSplit(item)) return [];
    const s = suggestWarehouse(item, stockMap);
    return s.kind === "full" ? [{ index, item, warehouse: s.warehouse }] : [];
  });
}

// Líneas (o partes de bodega) verificadas y todavía sin empacar.
export function packableLines(order) {
  return (order.items || []).flatMap((item, index) => {
    if (isSplit(item)) return item.stockPackedAt ? [] : [{ index, item }];
    return item.verified && !item.sentToManufacturing && !item.packed ? [{ index, item }] : [];
  });
}

// «R-2026-0042 · Mario Pérez» para una línea empacada de un pedido en ruta (o null).
export function routeNote(order) {
  const route = order.delivery?.route;
  if (!route?.code && route?.number == null) return null;
  const driver = order.delivery?.driver;
  const name = driver?.name ? `${driver.name} ${driver.lastName || ""}`.trim() : "sin motorista";
  return `${routeLabel(route)} · ${name}`;
}

// ---- Lista de Pedidos agrupada por estado (como la web) ----

// Grupos de la lista, en su orden fijo. `key` identifica el estado elegido en
// el filtro; `status` es el estado macro (dominio pedido-inventario) que
// reúne cada grupo; `sort`: «arrival» = el que llegó antes a Inventario
// primero, «asc»/«desc» = por lastStatusAt. `ranged`: solo esos grupos se
// filtran por el rango de fechas. `selectable`: admiten selección múltiple.
export const ORDER_GROUPS = [
  { key: "listo", status: "Listo para empacar", label: "Listos para empacar", note: "solo falta empacar", sort: "arrival" },
  { key: "verificando", status: "Verificando", label: "Verificando", sort: "arrival", selectable: true },
  { key: "sin-verificar", status: "Sin verificar", label: "Sin verificar", sort: "arrival", selectable: true },
  { key: "esperando", status: "Esperando lote", label: "Esperando lote", note: "depende de Fabricación", sort: "arrival" },
  { key: "empacado", status: "Empacado", label: "Empacados", note: "esperan a Logística", sort: "arrival" },
  { key: "recogido", status: "Recogido", label: "Recogidos", note: "la ruta aún no sale", sort: "asc", ranged: true },
  { key: "transito", status: "En Tránsito", label: "En tránsito", sort: "asc", ranged: true },
  { key: "entregado", status: "Entregado", label: "Entregados", note: "más recientes primero", sort: "desc", ranged: true },
];

const time = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Cuándo llegó el pedido a Inventario.
export const arrivedAt = (order) => order.sentToInventoryAt || order.createdAt;

// Número de pedido (completo o parcial) o nombre del cliente.
export function matchesOrderQuery(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${order.orderNumber || ""} ${order.customer?.name || ""}`.toLowerCase().includes(q);
}

// ¿El pedido se ve con el rango de fechas? Solo Recogido, En Tránsito y
// Entregado se filtran (por lastStatusAt); lo que sigue en bodega se ve siempre.
export function inDateRange(order, group, range) {
  if (!group.ranged || !range?.from || !range?.to) return true;
  const at = time(lastStatusAt(order));
  return !at || (at >= range.from.getTime() && at <= range.to.getTime());
}

// Pedidos por grupo (en el orden de ORDER_GROUPS) y con el orden de cada uno.
// Devuelve [{ ...grupo, items }], incluidos los vacíos.
export function groupInventoryOrders(orders, range) {
  const byStatus = new Map(ORDER_GROUPS.map((g) => [g.status, []]));
  for (const order of orders) byStatus.get(inventoryMacroStatus(order))?.push(order);
  return ORDER_GROUPS.map((group) => {
    const items = byStatus.get(group.status).filter((o) => inDateRange(o, group, range));
    const key = group.sort === "arrival" ? (o) => time(arrivedAt(o)) : (o) => time(lastStatusAt(o));
    items.sort((a, b) => (group.sort === "desc" ? key(b) - key(a) : key(a) - key(b)));
    return { ...group, items };
  });
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Cuándo llegó a Inventario: «hoy 08:20», «ayer 15:30» o «hace N días».
// `late`: lleva más de 2 días.
export function arrivalLabel(order, now = new Date()) {
  const at = arrivedAt(order);
  const d = new Date(at);
  if (!at || Number.isNaN(d.getTime())) return null;
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (days <= 0) return { text: `hoy ${formatClock(d)}`, late: false };
  if (days === 1) return { text: `ayer ${formatClock(d)}`, late: false };
  return { text: `hace ${days} días`, late: days > 2 };
}

// Segunda línea de un pedido que ya salió de bodega: «R-2026-0048 · salió
// 08:05», «Entregado 11 oct · 14:20». Recogido usa la hora de la recogida.
export function dispatchNote(order) {
  const status = inventoryMacroStatus(order);
  const last = lastStatusAt(order);
  if (status === "Entregado") return `Entregado ${formatShortDate(last)} · ${formatClock(last)}`;
  const r = order.delivery?.route;
  const route = r?.code || r?.number != null ? routeLabel(r) : null;
  let text;
  if (status === "En Tránsito") text = `salió ${formatClock(last)}`;
  else {
    const picked = Math.max(0, ...(order.items || []).map((i) => time(i.pickedUpAt)));
    text = picked ? `recogido ${formatClock(picked)}` : "recogido";
  }
  return route ? `${route} · ${text}` : text;
}

// ---- Acciones por línea (mismos endpoints que PedidosInventario.jsx) ----
const base = (orderId, index) => `/orders/${orderId}/items/${index}`;

export const orderLineApi = {
  verify: (orderId, index, warehouse) => api.patch(`${base(orderId, index)}/verify`, { warehouse }),
  unverify: (orderId, index) => api.patch(`${base(orderId, index)}/unverify`),
  pack: (orderId, index) => api.patch(`${base(orderId, index)}/pack`),
  unpack: (orderId, index) => api.patch(`${base(orderId, index)}/unpack`),
  sendToManufacturing: (orderId, index) => api.patch(`${base(orderId, index)}/send-manufacturing`),
  cancelManufacturing: (orderId, index) => api.del(`${base(orderId, index)}/send-manufacturing`),
  split: (orderId, index, warehouse, quantity) =>
    api.patch(`${base(orderId, index)}/split-partial`, { warehouse, quantity }),
  unsplit: (orderId, index) => api.del(`${base(orderId, index)}/split-partial`),
  // orders = [{ id, items: [{ index, warehouse }] }]
  verifyBulk: (orders) => api.post("/orders/verify-bulk", { orders }),
};

// Ejecuta las llamadas en orden (como runAll de la web).
export function runAll(calls) {
  return calls.reduce((p, fn) => p.then(async (results) => [...results, await fn()]), Promise.resolve([]));
}
