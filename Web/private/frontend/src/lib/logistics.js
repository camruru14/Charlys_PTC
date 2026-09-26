import { fmtNumber } from "./format";

/*
  Logística a partir de /routes y /orders (rutas de la Fase 7).
  Una ruta lleva las líneas empacadas por completo y sin entregar de sus
  pedidos: primero se recogen (Almacén y/o Fabricación) y luego se entregan.
*/

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

const joinList = (parts) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`);

/*
  Estado de despacho (dominio «despacho») sobre las líneas sin entregar:
    «Listo · N de N»      todo empacado
    «Esperando · X de N»  lo que falta todavía no empieza
    «Faltan P de N»       lo que falta ya está en marcha
*/
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
  return `${fmtNumber(total)} ${total === 1 ? "producto" : "productos"} · ${joinList(parts.map((p) => `${p.o.orderNumber} (${p.n})`))}`;
}

/*
  Paradas de una ruta en orden: las de `orders` más las entregadas a medias
  (salieron de `orders`; se reinsertan en su posición).
    [{ order, delivered, partial, deliveredAt }]
*/
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
