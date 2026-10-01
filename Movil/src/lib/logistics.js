// Estado de despacho de un pedido, portado de
// Web/private/frontend/src/lib/logistics.js (solo lo que usan las alertas
// del Dashboard por ahora).
export const LOCATIONS = ["Almacén", "Fabricación"];

const isSplit = (item) => item.fromStockQty != null && item.toManufactureQty != null;

export const isOrderDelivered = (order) => order.status === "Entregado" || Boolean(order.delivery?.deliveredAt);

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
