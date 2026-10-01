import { Schema, model } from "mongoose";

// Subcategorías de producto (Configuración > Subcategorías). Cada una
// pertenece a una categoría del catálogo ("Pajillas" o "Pelotas") y su NOMBRE
// es el "producto" que se muestra en el sistema (p. ej. "Pajilla jumbo").
// Igual que Warehouse, Vehicle y ProductionLine, el resto de colecciones
// guarda el nombre como texto (Product.subcategory, Order.items.product,
// ProductionBatch.product…), no una referencia: por eso una subcategoría que
// ya se usa no se puede renombrar ni eliminar (solo desactivar).
// active: false = ya no se ofrece al crear productos, pero se conserva.
export const SUBCATEGORY_CATEGORIES = ["Pajillas", "Pelotas"];

// Sin distinguir mayúsculas (strength 2): "Jumbo" y "jumbo" son el mismo nombre.
export const NAME_COLLATION = { locale: "es", strength: 2 };

const subcategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: SUBCATEGORY_CATEGORIES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

subcategorySchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION });
subcategorySchema.index({ category: 1, name: 1 });

export default model("Subcategory", subcategorySchema);
