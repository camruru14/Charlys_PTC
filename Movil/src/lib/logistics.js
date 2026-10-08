import { formatNumber } from "./format";
import { statusTone } from "./statusTones";

// Logística a partir de /routes y /orders, portado de
// Web/private/frontend/src/lib/logistics.js. Una ruta lleva las líneas
// empacadas por completo y sin entregar de sus pedidos: primero se recogen
// (Almacén y/o Fabricación) y luego se entregan parada por parada.
export const LOCATIONS = ["Almacén", "Fabricación"];
const PICKUP_KEY = { "Almacén": "almacen", "Fabricación": "fabricacion" };

const isSplit = (item) => item.fromStockQty != null && item.toManufactureQty != null;
const isCarriable = (item) => Boolean(item.packed && !item.deliveredAt);

// Ubicaciones donde se recoge una línea empacada (dividida: las dos).
function itemLocations(item) {
  if (!item.packed) return [];
  if (isSplit(item)) return LOCATIONS;
  return item.packedLocation ? [item.packedLocation] : [];
}

export function orderPickups(order) {
  const set = new Set();
  (order.items || []).filter(isCarriable).forEach((i) => itemLocations(i).forEach((l) => set.add(l)));
  return LOCATIONS.filter((l) => set.has(l));
}

export const isOrderDelivered = (order) => order.status === "Entregado" || Boolean(order.delivery?.deliveredAt);
export const personName = (p) => (p?.name ? `${p.name} ${p.lastName || ""}`.trim() : null);
// «J. Menjívar»
export const shortName = (p) => (p?.name ? `${p.name.trim()[0]}. ${p.lastName || ""}`.trim() : null);

// --- Estado de lo que falta de un pedido -------------------------------------

// Parte pendiente de una línea sin empacar: [estado, ubicación, ya empezó].
function missingPart(item) {
  const batch = item.manufacturingBatch;
  const batchState = () => {
    const status = batch?.status;
    if (status === "Completado") return ["completado sin empacar", "Fabricación", true];
    if (status === "En Proceso") return ["en proceso", "Fabricación", true];
    if (status === "Detenido") return ["detenido", "Fabricación", true];
    if (status === "Programado") return ["programado", "Fabricación", false];
    return ["en fabricación", "Fabricación", true];
  };
  if (isSplit(item)) {
    if (!item.stockPackedAt) return ["verificado sin empacar", "Almacén", true];
    return batchState();
  }
  if (item.sentToManufacturing || batch) return batchState();
  if (item.verified) return ["verificado sin empacar", "Almacén", true];
  return ["sin verificar", "Almacén", false];
}

const MISSING_ORDER = [
  "completado sin empacar",
  "en proceso",
  "detenido",
  "programado",
  "en fabricación",
  "verificado sin empacar",
  "sin verificar",
];

const joinList = (parts) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

// Estado de despacho (dominio «despacho») sobre las líneas sin entregar:
//   «Listo · N de N»      todo empacado
//   «Esperando · X de N»  lo que falta todavía no empieza
//   «Faltan P de N»       lo que falta ya está en marcha
export function dispatchInfo(order) {
  const remaining = (order.items || []).filter((i) => !i.deliveredAt);
  const total = remaining.length;
  const ready = remaining.filter((i) => i.packed).length;
  const missing = remaining.filter((i) => !i.packed).map(missingPart);
  let status;
  if (!missing.length) status = `Listo · ${ready} de ${total}`;
  else if (missing.every(([, , started]) => !started)) status = `Esperando · ${ready} de ${total}`;
  else status = `Faltan ${missing.length} de ${total}`;

  const counts = new Map();
  missing.forEach(([state]) => counts.set(state, (counts.get(state) || 0) + 1));
  const detail = joinList(MISSING_ORDER.filter((s) => counts.has(s)).map((s) => `${counts.get(s)} ${s}`));
  const places = LOCATIONS.filter((l) => missing.some(([, place]) => place === l));
  return { status, ready: !missing.length, total, missing: missing.length, detail, places };
}

// Texto del aviso ámbar de un pedido incompleto en una ruta.
export function incompleteText(order) {
  const info = dispatchInfo(order);
  const back = info.places.length === 2 ? "Almacén y Fabricación" : info.places[0] || "Almacén";
  return `A ${order.orderNumber} le faltan ${info.missing} de ${info.total} productos: ${info.detail}. Si sale hoy, habrá que volver a ${back}.`;
}

// Nota del lote que retiene a un pedido («lote L-4828 en proceso»).
export function lotNote(order) {
  const item = (order.items || []).find((i) => {
    if (!i.manufacturingBatch || i.deliveredAt) return false;
    return isSplit(i) ? !i.manufacturePackedAt : !i.packed;
  });
  if (!item) return null;
  const batch = item.manufacturingBatch;
  if (!batch?.batchNumber) return "lote en fabricación";
  return `lote ${batch.batchNumber} ${String(batch.status || "en fabricación").toLowerCase()}`;
}

// Volvió de una ruta con entrega parcial y todavía no tiene otra.
export const isPartialReturn = (order) => (order.items || []).some((i) => i.deliveredAt) && !order.delivery?.route;

// Pedidos para despacho: alguna línea empacada sin entregar y todavía no salieron.
export function dispatchOrders(orders) {
  return orders.filter(
    (o) => o.status !== "En Tránsito" && o.status !== "Entregado" && (o.items || []).some(isCarriable),
  );
}

// --- Rutas -----------------------------------------------------------------

export const isConfirmed = (route, location) => Boolean(route.pickups?.[PICKUP_KEY[location]]?.confirmedAt);
export const pickupAt = (route, location) => route.pickups?.[PICKUP_KEY[location]]?.confirmedAt || null;

export function requiredPickups(orders) {
  const set = new Set(orders.flatMap(orderPickups));
  return LOCATIONS.filter((l) => set.has(l));
}

// «8 productos · PED-1031 (5) y PED-1035 (3)»: líneas por llevar en esa ubicación.
export function pickupDetail(orders, location) {
  const parts = orders
    .map((o) => ({ o, n: (o.items || []).filter((i) => isCarriable(i) && itemLocations(i).includes(location)).length }))
    .filter((p) => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0);
  return `${formatNumber(total)} ${total === 1 ? "producto" : "productos"} · ${joinList(parts.map((p) => `${p.o.orderNumber} (${p.n})`))}`;
}

// Paradas de una ruta en orden: las de `orders` más las entregadas a medias
// (salieron de `orders`; se reinsertan en su posición).
//   [{ order, delivered, partial, deliveredAt }]
export function routeStops(route) {
  const lastAt = new Map();
  (route.deliveries || []).forEach((d) => lastAt.set(String(d.order?._id || d.order), d.at));
  const stops = (route.orders || []).map((order) => ({
    order,
    delivered: isOrderDelivered(order),
    partial: false,
    deliveredAt: order.delivery?.deliveredAt || (isOrderDelivered(order) ? lastAt.get(String(order._id)) : null),
  }));
  (route.deliveries || [])
    .filter((d) => d.partial && d.order && typeof d.order === "object")
    .sort((a, b) => a.position - b.position)
    .forEach((d) => {
      stops.splice(Math.min(d.position, stops.length), 0, { order: d.order, delivered: true, partial: true, deliveredAt: d.at });
    });
  return stops;
}

export function routeProgress(route) {
  const stops = routeStops(route);
  const delivered = stops.filter((s) => s.delivered).length;
  const current = route.status === "En tránsito" ? stops.findIndex((s) => !s.delivered) : -1;
  const deliveredValue = stops.filter((s) => s.delivered).reduce((sum, s) => sum + (Number(s.order.total) || 0), 0);
  const totalValue = stops.reduce((sum, s) => sum + (Number(s.order.total) || 0), 0);
  return { stops, delivered, total: stops.length, current, deliveredValue, totalValue };
}

export function progressNote(delivered, total) {
  if (!total || delivered === 0) return "sin entregas";
  if (delivered === total) return "todas entregadas";
  const ratio = delivered / total;
  if (ratio === 0.5) return "la mitad de la ruta";
  return ratio < 0.5 ? "menos de la mitad" : "más de la mitad";
}

// Razón por la que la ruta todavía no puede salir (o null).
export function departBlocker(route, orders) {
  if (!route.driver) return "falta motorista";
  if (!route.vehicle) return "falta vehículo";
  if (!orders.length) return "faltan pedidos";
  const missing = requiredPickups(orders).filter((l) => !isConfirmed(route, l)).length;
  if (missing) return missing === 1 ? "falta 1 recogida" : `faltan ${missing} recogidas`;
  return null;
}

// «P123-456 · Isuzu NPR» (solo la placa si el vehículo no tiene modelo).
// COPIA de vehicleLabel de Web/private/frontend/src/lib/logistics.js.
export const vehicleLabel = (vehicle) => (vehicle?.model ? `${vehicle.plate} · ${vehicle.model}` : vehicle?.plate || "");

// Opciones de motorista y vehículo según /routes/availability. Ocupado = va
// en otra ruta del día que no está Completada (la propia `routeId` no cuenta).
export function crewOptions(availability, routeId) {
  const busy = (item) => Boolean(item.busy && (!routeId || String(item.route?._id) !== String(routeId)));
  return {
    drivers: (availability?.drivers || []).map((d) => ({ value: String(d._id), label: personName(d), busy: busy(d) })),
    vehicles: (availability?.vehicles || []).map((v) => ({ value: v.plate, label: vehicleLabel(v), busy: busy(v) })),
  };
}

// Id de la ruta de un pedido (poblada o no).
export const routeIdOf = (order) => String(order.delivery?.route?._id || order.delivery?.route || "");

// --- Jerarquía de Logística (grupos, orden, chips y conteos) ------------------
// COPIA de la jerarquía de Web/private/frontend/src/lib/logistics.js (las
// funciones puras de «Para despacho» y «En tránsito»): mismos nombres, grupos,
// etiquetas, orden y reglas. Si cambia una, debe cambiar la otra igual. Toda la
// clasificación sale de aquí y se recalcula con cada dato nuevo.

// --- Código de la ruta ---------------------------------------------------------
// COPIA de Web/private/frontend/src/lib/logistics.js (mantener igual).

// «R-2026-0042». Una ruta vieja que todavía no tiene código usa «Ruta N».
export const routeLabel = (route) => route?.code || (route?.number != null ? `Ruta ${route.number}` : "Ruta");

// Cómo se nombra la ruta dentro de una frase: «la ruta R-2026-0042» / «la Ruta 3».
export const routeRef = (route) => (route?.code ? `la ruta ${route.code}` : `la ${routeLabel(route)}`);

// Clave para ordenar rutas por código (las viejas, por su número, antes).
const routeSortKey = (route) => route?.code || (route?.number != null ? `0-${String(route.number).padStart(6, "0")}` : "");

// Texto en el que busca el buscador de Logística: código (completo o parcial,
// «0042»), zona, motorista y vehículo.
export const routeSearchText = (route) =>
  [routeLabel(route), route?.zone, personName(route?.driver), route?.vehicle].filter(Boolean).join(" ").toLowerCase();

export const matchesQuery = (text, query) => !query.trim() || text.includes(query.trim().toLowerCase());

// «YYYY-MM-DD» en hora local del dispositivo (para ?from= y ?to= de /routes).
export const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Fecha que muestra la tarjeta de una ruta: cuándo se completó, o cuándo se creó.
export const routeDate = (route) => (route.status === "Completada" && route.completedAt) || route.createdAt || route.date;

export const DISPATCH_GROUPS = [
  { key: "listos", label: "Listos para ruta", chip: "Listos", tone: "green" },
  { key: "incompletos", label: "Incompletos", chip: "Incompletos", tone: "amber" },
  { key: "recoleccion", label: "En recolección", chip: "En recolección", tone: "blue" },
];

// Grupo de un pedido de dispatchOrders():
//   recoleccion  ya tiene ruta (la ruta todavía no sale: si saliera, el pedido
//                pasaría a «En Tránsito» y dejaría de estar en esta lista)
//   listos       sin ruta y todas sus líneas por entregar empacadas
//   incompletos  sin ruta, con algo empacado y otro lote o producto pendiente
// «Nada empacado todavía» no existe aquí: dispatchOrders exige al menos una
// línea empacada.
export function dispatchGroup(order) {
  if (order.delivery?.route) return "recoleccion";
  return dispatchInfo(order).ready ? "listos" : "incompletos";
}

const timeOf = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

// Desde cuándo espera el pedido: listos, desde que se empacó lo último;
// incompletos, desde que se empacó lo primero. Sin fechas, desde que se creó.
export function waitingSince(order) {
  const times = (order.items || [])
    .filter((i) => !i.deliveredAt)
    .flatMap((i) => [i.packedAt, i.stockPackedAt, i.manufacturePackedAt])
    .map(timeOf)
    .filter((t) => t != null);
  if (times.length) return dispatchInfo(order).ready ? Math.max(...times) : Math.min(...times);
  return timeOf(order.createdAt) ?? 0;
}

// Más antiguo primero (en recolección: por ruta y, dentro de la ruta, igual).
function compareDispatch(a, b) {
  return routeSortKey(a.delivery?.route).localeCompare(routeSortKey(b.delivery?.route), "es", { numeric: true }) || waitingSince(a) - waitingSince(b) || String(a.orderNumber).localeCompare(String(b.orderNumber));
}

// Pedidos agrupados y ordenados: [{ ...grupo, items }] sin grupos vacíos.
// filter: "todos" o la clave de un grupo.
export function groupDispatchOrders(orders, filter = "todos") {
  return DISPATCH_GROUPS.filter((g) => filter === "todos" || filter === g.key)
    .map((g) => ({ ...g, items: orders.filter((o) => dispatchGroup(o) === g.key).sort(compareDispatch) }))
    .filter((g) => g.items.length);
}

export function dispatchCounts(orders) {
  const counts = { todos: orders.length };
  DISPATCH_GROUPS.forEach((g) => (counts[g.key] = 0));
  orders.forEach((o) => (counts[dispatchGroup(o)] += 1));
  return counts;
}

// Lo que falta de un pedido incompleto, con el tono de cada estado:
// [{ label: "1 lote detenido", tone: "rose" }, …] en el orden de MISSING_ORDER.
const LOT_STATES = new Set(["completado sin empacar", "detenido", "programado"]);
export function missingBreakdown(order) {
  const counts = new Map();
  (order.items || [])
    .filter((i) => !i.deliveredAt && !i.packed)
    .map(missingPart)
    .forEach(([state]) => counts.set(state, (counts.get(state) || 0) + 1));
  return MISSING_ORDER.filter((s) => counts.has(s)).map((s) => ({
    label: `${counts.get(s)} ${LOT_STATES.has(s) ? "lote " : ""}${s}`,
    tone: statusTone(s, "falta"),
  }));
}

// «Falta recoger en Almacén y Fabricación» de un pedido con ruta.
export function pickupNote(order, route) {
  const places = orderPickups(order);
  if (!route || !places.length) return null;
  const missing = places.filter((l) => !isConfirmed(route, l));
  return missing.length ? `Falta recoger en ${joinList(missing)}` : "Recogida completa";
}

export const ROUTE_GROUPS = [
  { key: "pendiente", label: "Pendiente", chip: "Pendiente", tone: "blue" },
  { key: "transito", label: "En tránsito", chip: "En tránsito", tone: "teal" },
  { key: "completadas", label: "Completadas", chip: "Completadas", tone: "green" },
];

// Una ruta demorada (route.delayed) que todavía no se completa: solo sube al
// principio de «En tránsito»; no tiene chip ni filtro.
export const isRouteDelayed = (route) => Boolean(route.delayed) && route.status !== "Completada";

// Grupo de una ruta:
//   completadas  status Completada
//   transito     ya salió (En tránsito, o con departedAt) y no se completó
//   pendiente    Pendiente o Recolectando, sin salir
export function routeGroup(route) {
  if (route.status === "Completada") return "completadas";
  if (route.status === "En tránsito" || route.departedAt) return "transito";
  return "pendiente";
}

const byCode = (a, b) => routeSortKey(a).localeCompare(routeSortKey(b), "es", { numeric: true });
const stamp = (...values) => values.map(timeOf).find((t) => t != null) ?? 0;

// Orden dentro de cada grupo: pendiente, la más reciente primero; en tránsito,
// las demoradas arriba y después la que salió primero; completadas, la que se
// completó más recientemente primero.
const ROUTE_COMPARE = {
  pendiente: (a, b) => stamp(b.createdAt, b.date) - stamp(a.createdAt, a.date) || byCode(b, a),
  transito: (a, b) =>
    Number(isRouteDelayed(b)) - Number(isRouteDelayed(a)) ||
    stamp(a.departedAt, a.createdAt) - stamp(b.departedAt, b.createdAt) ||
    byCode(a, b),
  completadas: (a, b) =>
    stamp(b.completedAt, b.departedAt, b.updatedAt) - stamp(a.completedAt, a.departedAt, a.updatedAt) || byCode(b, a),
};

// filter: "todas" o la clave de un grupo.
export function groupRoutes(routes, filter = "todas") {
  return ROUTE_GROUPS.filter((g) => filter === "todas" || filter === g.key)
    .map((g) => ({ ...g, items: routes.filter((r) => routeGroup(r) === g.key).sort(ROUTE_COMPARE[g.key]) }))
    .filter((g) => g.items.length);
}

export function routeCounts(routes) {
  const counts = { todas: routes.length };
  ROUTE_GROUPS.forEach((g) => (counts[g.key] = 0));
  routes.forEach((r) => (counts[routeGroup(r)] += 1));
  return counts;
}

// --- Quitar un pedido de su ruta ---------------------------------------------

// Por qué un pedido no se puede quitar de su ruta (o null si sí). COPIA de
// removeBlocker de Web/private/frontend/src/lib/logistics.js (y del backend,
// Web/private/backend/src/lib/routes.js): debe mantenerse igual.
//   - la ruta ya salió (departedAt, En tránsito o Completada), o
//   - ya se confirmó la recogida de alguno de los lugares donde están
//     empacados los productos del pedido (Almacén y/o Fabricación).
export function removeBlocker(order, route) {
  if (!route) return "El pedido no está en una ruta";
  if (route.departedAt || route.status === "En tránsito" || route.status === "Completada") return "La ruta ya salió";
  const confirmed = orderPickups(order).filter((l) => isConfirmed(route, l));
  if (confirmed.length) return `Ya se confirmó la recolección de este pedido en ${confirmed.join(" y ")}; no se puede quitar`;
  return null;
}

export const canRemoveFromRoute = (order, route) => !removeBlocker(order, route);
