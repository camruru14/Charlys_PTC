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

export function isBelowMinimum(item) {
  return stockLevel(item) === "Bajo mínimo";
}
