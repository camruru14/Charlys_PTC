// Deriva el "progreso" de los grupos por pedido de los tabs "Por fabricar" y
// "Fabricación de pedidos" de Fabricación, portado de
// Web/private/frontend/src/lib/manufacturingProgress.js.

// ---------------------------------------------------------------------
// "Por fabricar": en cola vs en fabricación
// ---------------------------------------------------------------------

export function getManufacturingCounts(group) {
  const lines = group?.lines || [];
  const counts = { enCola: 0, enFabricacion: 0 };
  for (const { item } of lines) {
    if (item.manufacturingBatch) counts.enFabricacion += 1;
    else counts.enCola += 1;
  }
  return counts;
}

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
const MANUFACTURING_BAR_COLORS = { enCola: "#cbd5e1", enFabricacion: "#3b82f6" };
const MANUFACTURING_GROUP_LABELS = { enCola: "en cola", enFabricacion: "en fabricación" };

export function manufacturingProgressSegments(group) {
  const counts = getManufacturingCounts(group);
  const total = MANUFACTURING_BAR_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return MANUFACTURING_BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    color: MANUFACTURING_BAR_COLORS[key],
    label: MANUFACTURING_GROUP_LABELS[key],
  }));
}

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
// "Fabricación de pedidos": status real del lote
// ---------------------------------------------------------------------

export function getPedidoBatchCounts(group) {
  const batches = group?.batches || [];
  const counts = { programado: 0, enProceso: 0, completado: 0, detenido: 0 };
  for (const { batch } of batches) {
    if (batch.status === "En Proceso") counts.enProceso += 1;
    else if (batch.status === "Completado") counts.completado += 1;
    else if (batch.status === "Detenido") counts.detenido += 1;
    else counts.programado += 1;
  }
  return counts;
}

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
  programado: "#fbbf24",
  enProceso: "#3b82f6",
  completado: "#10b981",
  detenido: "#f87171",
};
const PEDIDO_BATCH_GROUP_LABELS = {
  programado: "programado",
  enProceso: "en proceso",
  completado: "completado",
  detenido: "detenido",
};

export function pedidoBatchProgressSegments(group) {
  const counts = getPedidoBatchCounts(group);
  const total = PEDIDO_BATCH_BAR_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return PEDIDO_BATCH_BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    color: PEDIDO_BATCH_BAR_COLORS[key],
    label: PEDIDO_BATCH_GROUP_LABELS[key],
  }));
}

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
