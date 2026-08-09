// Deriva el "progreso" de un pedido (order.items) para pintar la barra
// segmentada y el filtro de la pestaña Inventario > Pedidos. Centralizado
// acá para que la barra y el filtro nunca se desincronicen entre sí.
//
// Cada línea del pedido cae en exactamente un grupo, con esta prioridad
// (la misma que ya usaba el modal "Info Pedido" para el estado por línea):
// empacado > verificado > enviado a fabricación > sin verificar.

// Conteo de líneas del pedido por grupo.
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

// Estado "macro" del pedido completo, usado tanto por la barra (pill
// "Entregado") como por el <select> de filtro. "parcial" cuando hay más de
// un grupo con conteo > 0 (líneas en pasos distintos); "entregado" cuando ya
// se le asignó motorista (igual criterio que Logística/Pedidos: entregado al
// repartidor, no necesariamente al cliente).
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

// Orden e info visual de la barra segmentada: izquierda a derecha sigue el
// flujo real del pedido (sin verificar -> verificado -> enviado a
// fabricación -> empacado). "entregado" no es un grupo por línea (todo el
// pedido ya salió con motorista), se pinta como barra completa aparte.
const BAR_ORDER = ["sinVerificar", "verificado", "enviado", "empacado"];
const BAR_COLORS = {
  sinVerificar: "bg-slate-300",
  verificado: "bg-brand-400",
  enviado: "bg-amber-400",
  empacado: "bg-purple-500",
  entregado: "bg-emerald-500",
};
const GROUP_LABELS = {
  sinVerificar: "sin verificar",
  verificado: "verificado",
  enviado: "enviado a fabricación",
  empacado: "empacado",
  entregado: "entregado",
};

// Segmentos listos para pintar (ancho proporcional al total de líneas). Si el
// pedido ya está "entregado" (motorista asignado), la barra es un solo
// segmento completo en vez de reflejar el detalle por línea.
export function progressSegments(order) {
  if (macroStatus(order) === "entregado") {
    return [{ key: "entregado", count: (order?.items || []).length, pct: 100, colorClass: BAR_COLORS.entregado, label: GROUP_LABELS.entregado }];
  }

  const counts = getItemStatusCounts(order);
  const total = counts.sinVerificar + counts.verificado + counts.enviado + counts.empacado;
  if (total === 0) return [];
  return BAR_ORDER.filter((key) => counts[key] > 0).map((key) => ({
    key,
    count: counts[key],
    pct: (counts[key] / total) * 100,
    colorClass: BAR_COLORS[key],
    label: GROUP_LABELS[key],
  }));
}

// Texto corto bajo la barra, p. ej. "2 empacados · 1 enviado a fabricación ·
// 1 sin verificar". Orden de avance más reciente primero, para que lo más
// relevante quede al frente del texto.
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
