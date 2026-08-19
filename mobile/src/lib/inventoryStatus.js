// Estado de existencia de un artículo de almacén, portado de stockStatus()
// en Web/private/frontend/src/pages/Inventario.jsx.
const STOCK_THRESHOLDS = { kg: 11, litro: 11, unidad: 100, caja: 100 };

export function stockStatus(item) {
  const threshold = STOCK_THRESHOLDS[item.unit] ?? 0;
  if ((item.stock || 0) < threshold) return "Insuficiente";
  return "Suficiente";
}

export function stockStatusTone(status) {
  return status === "Insuficiente" ? "red" : "green";
}

export const UNITS = ["kg", "unidad", "caja", "litro"];
export const MATERIAL_TYPES = ["Polimero", "Aditivo", "Tinta", "Insumo"];
