import productModel from "../models/Product.js";
import orderModel from "../models/Order.js";
import productionBatchModel from "../models/ProductionBatch.js";
import dailyBatchModel from "../models/DailyBatch.js";
import inventoryItemModel from "../models/InventoryItem.js";
import subcategoryModel, { NAME_COLLATION } from "../models/Subcategory.js";

/*
  Dónde se guarda el nombre de una subcategoría como texto. Si aparece en
  alguno, la subcategoría "está en uso" y ya no se puede renombrar, cambiar de
  categoría ni eliminar (solo desactivar).
    products.subcategory, orders.items.product, productionbatches.product,
    dailybatches.product e inventoryitems.name (solo "Producto Terminado").
*/
const USAGES = [
  { model: productModel, field: "subcategory" },
  { model: orderModel, field: "items.product" },
  { model: productionBatchModel, field: "product" },
  { model: dailyBatchModel, field: "product" },
  { model: inventoryItemModel, field: "name", filter: { category: "Producto Terminado" } },
];

const keyOf = (name) => String(name).trim().toLocaleLowerCase("es");

// Nombres en uso, en minúsculas: una consulta distinct por colección (no una
// por subcategoría), para marcar `inUse` en todo el listado.
export async function usedNameKeys() {
  const lists = await Promise.all(USAGES.map(({ model, field, filter }) => model.distinct(field, filter)));
  const keys = new Set();
  for (const list of lists) {
    for (const name of list) if (typeof name === "string" && name.trim()) keys.add(keyOf(name));
  }
  return keys;
}

// ¿Este nombre se usa en algún registro? Para una sola subcategoría: un
// `exists` por colección (mismo criterio que el índice único: sin distinguir
// mayúsculas).
export async function isNameInUse(name) {
  const hits = await Promise.all(
    USAGES.map(({ model, field, filter }) =>
      model.exists({ ...filter, [field]: name }).collation(NAME_COLLATION),
    ),
  );
  return hits.some(Boolean);
}

// Busca la subcategoría por nombre sin distinguir mayúsculas.
export function findSubcategoryByName(name) {
  return subcategoryModel.findOne({ name: String(name).trim() }).collation(NAME_COLLATION);
}
