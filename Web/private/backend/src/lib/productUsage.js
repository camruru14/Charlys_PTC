import orderModel from "../models/Order.js";
import productionBatchModel from "../models/ProductionBatch.js";
import dailyBatchModel from "../models/DailyBatch.js";
import inventoryItemModel from "../models/InventoryItem.js";
import { NAME_COLLATION } from "../models/Product.js";

/*
  Dónde se guarda el nombre de un producto del Catálogo como texto. Si aparece
  en alguno, el producto "está en uso" y ya no se puede renombrar, cambiar de
  categoría ni eliminar (solo desactivar, para ocultarlo de la tienda).
    orders.items.product, productionbatches.product, dailybatches.product e
    inventoryitems.name (solo "Producto Terminado").
*/
const USAGES = [
  { model: orderModel, field: "items.product" },
  { model: productionBatchModel, field: "product" },
  { model: dailyBatchModel, field: "product" },
  { model: inventoryItemModel, field: "name", filter: { category: "Producto Terminado" } },
];

const keyOf = (name) => String(name).trim().toLocaleLowerCase("es");

// Nombres en uso, en minúsculas: una consulta distinct por colección (no una
// por producto), para marcar `inUse` en todo el listado.
export async function usedNameKeys() {
  const lists = await Promise.all(USAGES.map(({ model, field, filter }) => model.distinct(field, filter)));
  const keys = new Set();
  for (const list of lists) {
    for (const name of list) if (typeof name === "string" && name.trim()) keys.add(keyOf(name));
  }
  return keys;
}

// ¿Este nombre se usa en algún registro? Para un solo producto: un `exists`
// por colección (mismo criterio que el índice único: sin distinguir mayúsculas).
export async function isNameInUse(name) {
  const hits = await Promise.all(
    USAGES.map(({ model, field, filter }) =>
      model.exists({ ...filter, [field]: name }).collation(NAME_COLLATION),
    ),
  );
  return hits.some(Boolean);
}

export { keyOf as nameKey };
