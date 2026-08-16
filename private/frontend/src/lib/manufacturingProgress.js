// Deriva el "progreso" de un grupo de líneas enviadas a fabricación (ver
// manufacturingGroups en Fabricacion.jsx) para pintar la barra segmentada y
// el filtro de la pestaña "Por fabricar". Equivalente a orderProgress.js,
// pero para este dominio: acá todas las líneas ya están sentToManufacturing,
// y el estado por línea refleja el lote de fabricación real
// (item.manufacturingBatch.status, poblado por ordersController.js) en vez
// de verificado/empacado, que son pasos posteriores de Inventario > Pedidos.

// Conteo de líneas del grupo por estado del lote de fabricación. Antes de
// tener lote, la línea está "en cola"; una vez creado, sigue el status del
// ProductionBatch (Programado / En Proceso / Completado / Detenido).
export function getManufacturingCounts(group) {
  const lines = group?.lines || [];
  const counts = { enCola: 0, programado: 0, enProceso: 0, completado: 0, detenido: 0 };
  for (const { item } of lines) {
    const status = item.manufacturingBatch?.status;
    if (!item.manufacturingBatch) counts.enCola += 1;
    else if (status === "En Proceso") counts.enProceso += 1;
    else if (status === "Completado") counts.completado += 1;
    else if (status === "Detenido") counts.detenido += 1;
    else counts.programado += 1; // status === "Programado" (o lote recién creado sin status aún)
  }
  return counts;
}

// Estado "macro" del grupo, usado tanto por la barra como por el <select> de
// filtro: la única categoría con líneas, o "parcial" si hay mezcla.
export function manufacturingMacroStatus(group) {
  const counts = getManufacturingCounts(group);
  const withLines = Object.keys(counts).filter((key) => counts[key] > 0);
  if (withLines.length === 0) return "enCola";
  if (withLines.length > 1) return "parcial";
  return withLines[0];
}

export const MANUFACTURING_STATUS_LABELS = {
  enCola: "En cola",
  programado: "Programado",
  enProceso: "En proceso",
  completado: "Completado",
  detenido: "Detenido",
  parcial: "Parcial (mezcla)",
};

// Colores de los segmentos: mismo tono que StatusPill usa para cada estado
// de lote (Programado -> amarillo, En Proceso -> azul, Completado -> verde,
// Detenido -> rojo). "En cola" en gris, igual que "sin verificar" en el
// resto de la app.
const BAR_ORDER = ["enCola", "programado", "enProceso", "completado", "detenido"];
const BAR_COLORS = {
  enCola: "bg-slate-300",
  programado: "bg-amber-400",
  enProceso: "bg-brand-500",
  completado: "bg-emerald-500",
  detenido: "bg-red-500",
};
const GROUP_LABELS = {
  enCola: "en cola",
  programado: "programado",
  enProceso: "en proceso",
  completado: "completado",
  detenido: "detenido",
};

// Segmentos listos para pintar (ancho proporcional al total de líneas).
// Izquierda a derecha sigue el flujo real (en cola -> programado -> en
// proceso -> completado -> detenido), igual criterio que BAR_ORDER en
// orderProgress.js.
export function manufacturingProgressSegments(group) {
  const counts = getManufacturingCounts(group);
  const total = BAR_ORDER.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  return BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    colorClass: BAR_COLORS[key],
    label: GROUP_LABELS[key],
  }));
}

// Texto corto bajo la barra, p. ej. "1 en proceso · 1 programado". Orden de
// avance más reciente primero, para que lo más relevante quede al frente.
const CAPTION_ORDER = ["completado", "detenido", "enProceso", "programado", "enCola"];
const CAPTION_LABELS = {
  enCola: (n) => `${n} en cola`,
  programado: (n) => `${n} programado${n === 1 ? "" : "s"}`,
  enProceso: (n) => `${n} en proceso`,
  completado: (n) => `${n} completado${n === 1 ? "" : "s"}`,
  detenido: (n) => `${n} detenido${n === 1 ? "" : "s"}`,
};

export function manufacturingProgressCaption(group) {
  const counts = getManufacturingCounts(group);
  return CAPTION_ORDER.filter((key) => counts[key] > 0)
    .map((key) => CAPTION_LABELS[key](counts[key]))
    .join(" · ");
}
