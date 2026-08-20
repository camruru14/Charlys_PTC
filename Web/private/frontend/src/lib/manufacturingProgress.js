// Deriva el "progreso" de los grupos por pedido de las dos tablas de
// Fabricación que agrupan por pedido (ver Fabricacion.jsx), para pintar sus
// barras segmentadas y sus filtros. Equivalente a orderProgress.js, pero
// para este dominio — dos variantes según qué se está agrupando:
//
//   - "Por fabricar" (manufacturingGroups: { order, lines }): cada línea del
//     pedido está sentToManufacturing pero puede o no tener ya un lote
//     asignado (item.manufacturingBatch). Solo dos categorías: en cola / en
//     fabricación — el detalle del status del lote vive en la otra tabla.
//   - "Fabricación de pedidos" (pedidoGroups: { order, batches }): cada
//     batch ya existe, agrupado por el status real del ProductionBatch
//     (Programado / En Proceso / Completado / Detenido).

// ---------------------------------------------------------------------
// "Por fabricar": en cola vs en fabricación
// ---------------------------------------------------------------------

// Conteo de líneas del grupo por estado.
export function getManufacturingCounts(group) {
  const lines = group?.lines || [];
  const counts = { enCola: 0, enFabricacion: 0 };
  for (const { item } of lines) {
    if (item.manufacturingBatch) counts.enFabricacion += 1;
    else counts.enCola += 1;
  }
  return counts;
}

// Estado "macro" del grupo, usado tanto por la barra como por el <select> de
// filtro. "parcial" cuando hay mezcla de líneas en cola y ya en fabricación.
export function manufacturingMacroStatus(group) {
  const { enCola, enFabricacion } = getManufacturingCounts(group);
  if (enCola > 0 && enFabricacion > 0) return "parcial";
  if (enFabricacion > 0) return "enFabricacion";
  return "enCola";
}

export const MANUFACTURING_STATUS_LABELS = {
  enCola: "En cola",
  enFabricacion: "En fabricación",
  parcial: "Parcial (mezcla)",
};

const MANUFACTURING_BAR_ORDER = ["enCola", "enFabricacion"];
const MANUFACTURING_BAR_COLORS = {
  enCola: "bg-slate-300",
  // bg-brand-400 no está definido en el theme (index.css solo declara
  // brand-50/100/200/500/600/700/800) y no pinta nada; brand-500 es el tono
  // "azul" real más cercano, el mismo que usa StatusPill para "En Proceso".
  enFabricacion: "bg-brand-500",
};
const MANUFACTURING_GROUP_LABELS = {
  enCola: "en cola",
  enFabricacion: "en fabricación",
};

// Segmentos listos para pintar (ancho proporcional al total de líneas).
export function manufacturingProgressSegments(group) {
  const counts = getManufacturingCounts(group);
  const total = MANUFACTURING_BAR_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return MANUFACTURING_BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    colorClass: MANUFACTURING_BAR_COLORS[key],
    label: MANUFACTURING_GROUP_LABELS[key],
  }));
}

// Texto corto bajo la barra, p. ej. "1 en fabricación · 1 en cola".
const MANUFACTURING_CAPTION_ORDER = ["enFabricacion", "enCola"];
const MANUFACTURING_CAPTION_LABELS = {
  enFabricacion: (n) => `${n} en fabricación`,
  enCola: (n) => `${n} en cola`,
};

export function manufacturingProgressCaption(group) {
  const counts = getManufacturingCounts(group);
  return MANUFACTURING_CAPTION_ORDER.filter((key) => counts[key] > 0)
    .map((key) => MANUFACTURING_CAPTION_LABELS[key](counts[key]))
    .join(" · ");
}

// ---------------------------------------------------------------------
// "Fabricación de pedidos": status real del ProductionBatch
// ---------------------------------------------------------------------

// Conteo de lotes del grupo por status.
export function getPedidoBatchCounts(group) {
  const batches = group?.batches || [];
  const counts = { programado: 0, enProceso: 0, completado: 0, detenido: 0 };
  for (const { batch } of batches) {
    if (batch.status === "En Proceso") counts.enProceso += 1;
    else if (batch.status === "Completado") counts.completado += 1;
    else if (batch.status === "Detenido") counts.detenido += 1;
    else counts.programado += 1; // status === "Programado"
  }
  return counts;
}

// Estado "macro" del grupo: la única categoría con lotes, o "parcial" si hay mezcla.
export function pedidoBatchMacroStatus(group) {
  const counts = getPedidoBatchCounts(group);
  const withBatches = Object.keys(counts).filter((key) => counts[key] > 0);
  if (withBatches.length === 0) return "programado";
  if (withBatches.length > 1) return "parcial";
  return withBatches[0];
}

export const PEDIDO_BATCH_STATUS_LABELS = {
  programado: "Programado",
  enProceso: "En proceso",
  completado: "Completado",
  detenido: "Detenido",
  parcial: "Parcial (mezcla)",
};

const PEDIDO_BATCH_BAR_ORDER = ["programado", "enProceso", "completado", "detenido"];
const PEDIDO_BATCH_BAR_COLORS = {
  programado: "bg-amber-400",
  // bg-brand-400 no está definido en el theme (ver nota arriba); brand-500
  // es el azul real que sí pinta, mismo tono que StatusPill usa para "En Proceso".
  enProceso: "bg-brand-500",
  completado: "bg-emerald-500",
  detenido: "bg-red-400",
};
const PEDIDO_BATCH_GROUP_LABELS = {
  programado: "programado",
  enProceso: "en proceso",
  completado: "completado",
  detenido: "detenido",
};

// Segmentos listos para pintar (ancho proporcional al total de lotes).
export function pedidoBatchProgressSegments(group) {
  const counts = getPedidoBatchCounts(group);
  const total = PEDIDO_BATCH_BAR_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return PEDIDO_BATCH_BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    colorClass: PEDIDO_BATCH_BAR_COLORS[key],
    label: PEDIDO_BATCH_GROUP_LABELS[key],
  }));
}

// Texto corto bajo la barra, p. ej. "1 en proceso · 1 programado". Orden de
// avance más reciente primero.
const PEDIDO_BATCH_CAPTION_ORDER = ["completado", "detenido", "enProceso", "programado"];
const PEDIDO_BATCH_CAPTION_LABELS = {
  programado: (n) => `${n} programado${n === 1 ? "" : "s"}`,
  enProceso: (n) => `${n} en proceso`,
  completado: (n) => `${n} completado${n === 1 ? "" : "s"}`,
  detenido: (n) => `${n} detenido${n === 1 ? "" : "s"}`,
};

export function pedidoBatchProgressCaption(group) {
  const counts = getPedidoBatchCounts(group);
  return PEDIDO_BATCH_CAPTION_ORDER.filter((key) => counts[key] > 0)
    .map((key) => PEDIDO_BATCH_CAPTION_LABELS[key](counts[key]))
    .join(" · ");
}
