// Opciones fijas de los artículos de inventario (formulario y filtros),
// copiadas de Web/private/frontend/src/lib/inventoryOptions.js.
export const UNITS = ["kg", "unidad", "caja", "litro"];
export const MATERIAL_TYPES = ["Polimero", "Aditivo", "Tinta", "Insumo"];

// Unidad corta para mostrar junto a una cantidad ("18,450 u", "850 kg").
export function unitShort(unit) {
  if (!unit || unit === "unidad") return "u";
  return unit;
}
