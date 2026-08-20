// Deriva el "progreso" de un pedido (order.items) para la pestaña
// Inventario > Pedidos, portado de Web/private/frontend/src/lib/orderProgress.js.
export function getItemStatusCounts(order) {
  const items = order?.items || [];
  const counts = { sinVerificar: 0, verificado: 0, enviado: 0, empacado: 0 };
  for (const item of items) {
    if (item.packed) counts.empacado += 1;
    else if (item.verified) counts.verificado += 1;
    else if (item.sentToManufacturing) counts.enviado += 1;
    else counts.sinVerificar += 1;
  }
  return counts;
}

export function macroStatus(order) {
  if (order?.delivery?.driver) return "entregado";
  const counts = getItemStatusCounts(order);
  const groupsWithItems = Object.values(counts).filter((n) => n > 0).length;
  if (groupsWithItems === 0) return "sinVerificar";
  if (groupsWithItems > 1) return "parcial";
  if (counts.empacado > 0) return "empacado";
  if (counts.enviado > 0) return "enviado";
  if (counts.verificado > 0) return "verificado";
  return "sinVerificar";
}

export const MACRO_STATUS_LABELS = {
  sinVerificar: "Sin verificar",
  verificado: "Verificado",
  enviado: "En fabricación",
  empacado: "Empacado",
  parcial: "Parcial (mezcla)",
  entregado: "Entregado",
};

const BAR_ORDER = ["sinVerificar", "verificado", "enviado", "empacado"];
const BAR_COLORS = {
  sinVerificar: "#cbd5e1",
  verificado: "#60a5fa",
  enviado: "#fbbf24",
  empacado: "#a855f7",
  entregado: "#10b981",
};
const GROUP_LABELS = {
  sinVerificar: "sin verificar",
  verificado: "verificado",
  enviado: "enviado a fabricación",
  empacado: "empacado",
  entregado: "entregado",
};

export function progressSegments(order) {
  if (macroStatus(order) === "entregado") {
    return [{ key: "entregado", count: (order?.items || []).length, pct: 100, color: BAR_COLORS.entregado, label: GROUP_LABELS.entregado }];
  }
  const counts = getItemStatusCounts(order);
  const total = counts.sinVerificar + counts.verificado + counts.enviado + counts.empacado;
  if (total === 0) return [];
  return BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    color: BAR_COLORS[key],
    label: GROUP_LABELS[key],
  }));
}

const CAPTION_ORDER = ["empacado", "enviado", "verificado", "sinVerificar"];
const CAPTION_LABELS = {
  empacado: (n) => `${n} empacado${n === 1 ? "" : "s"}`,
  enviado: (n) => `${n} enviado${n === 1 ? "" : "s"} a fabricación`,
  verificado: (n) => `${n} verificado${n === 1 ? "" : "s"}`,
  sinVerificar: (n) => `${n} sin verificar`,
};

export function progressCaption(order) {
  if (macroStatus(order) === "entregado") return "Entregado";
  const counts = getItemStatusCounts(order);
  return CAPTION_ORDER.filter((key) => counts[key] > 0)
    .map((key) => CAPTION_LABELS[key](counts[key]))
    .join(" · ");
}
