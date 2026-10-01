// El «producto» de pedidos, lotes y producción diaria es el nombre de una
// subcategoría (Configuración > Subcategorías): las pruebas que usan nombres
// sueltos ("Silla", "Pajilla"…) los siembran aquí como subcategorías activas.
import Subcategory from "../../src/models/Subcategory.js";

export const DEFAULT_PRODUCT_NAMES = ["Silla", "Mesa", "Vaso", "Pajilla", "Pelota"];

export async function seedProductNames(names = DEFAULT_PRODUCT_NAMES) {
  await Subcategory.deleteMany({});
  await Subcategory.insertMany(names.map((name) => ({ name, category: "Pajillas" })));
}
