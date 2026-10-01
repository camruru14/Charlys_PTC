// Nivel de stock de un artículo de inventario, portado de
// Web/private/frontend/src/lib/stockLevel.js. 3 tramos según el umbral T de
// su unidad: Bajo mínimo (stock < T), Estable (T <= stock < 3T) y
// Suficiente (stock >= 3T).
export const STOCK_THRESHOLDS = { kg: 11, litro: 11, unidad: 100, caja: 100 };

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

export const STOCK_LEVEL_TONE = {
  "Bajo mínimo": "rose",
  Estable: "blue",
  Suficiente: "green",
};

// El medidor se llena min(100, stock / (4T) × 100) %.
export function stockFillPercent(item) {
  const t = thresholdFor(item);
  const stock = Number(item?.stock) || 0;
  if (t <= 0) return stock > 0 ? 100 : 0;
  return Math.min(100, (stock / (4 * t)) * 100);
}

export function isBelowMinimum(item) {
  return stockLevel(item) === "Bajo mínimo";
}

// Ingreso reciente desde Fabricación: lastInbound.at es de hoy o de ayer
// (hora local).
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
