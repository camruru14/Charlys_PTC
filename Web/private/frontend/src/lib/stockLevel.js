/*
  Nivel de stock de un artículo de inventario, en 3 tramos según el umbral
  T de su unidad (STOCK_THRESHOLDS):
    Bajo mínimo  stock < T
    Estable      T <= stock < 3T
    Suficiente   stock >= 3T
  El medidor se llena min(100, stock / (4T) × 100) %.
*/

// Umbral mínimo de existencia según la unidad del artículo.
export const STOCK_THRESHOLDS = { kg: 11, litro: 11, unidad: 100, caja: 100 };

export const STOCK_LEVEL_TONE = {
  "Bajo mínimo": "rose",
  Estable: "blue",
  Suficiente: "green",
};

function thresholdFor(item) {
  return STOCK_THRESHOLDS[item?.unit] ?? 0;
}

export function stockLevel(item) {
  const t = thresholdFor(item);
  const stock = Number(item?.stock) || 0;
  if (stock < t) return "Bajo mínimo";
  if (stock < 3 * t) return "Estable";
  return "Suficiente";
}

export function stockFillPercent(item) {
  const t = thresholdFor(item);
  const stock = Number(item?.stock) || 0;
  if (t <= 0) return stock > 0 ? 100 : 0;
  return Math.min(100, (stock / (4 * t)) * 100);
}

export function isBelowMinimum(item) {
  return stockLevel(item) === "Bajo mínimo";
}

// Ingreso reciente: lastInbound.at es de hoy o de ayer (hora local).
export function isRecentInbound(item) {
  const raw = item?.lastInbound?.at;
  if (!raw) return false;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  return at >= start;
}
