import { Schema, model } from "mongoose";

// Catálogo propio de la tienda pública. Independiente de InventoryItem
// (que es materia prima / control de bodega interno): este modelo es el que
// alimenta las páginas de Inicio, Productos y Detalle de producto, y el que
// se usa para calcular precios en el checkout (nunca se confía en el precio
// que manda el navegador).
const productImageSchema = new Schema(
  {
    url: { type: String, required: true }, // secure_url de Cloudinary
    publicId: { type: String, required: true }, // public_id de Cloudinary (para poder borrarla)
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // ej. "Pelota plástica 60 mm"
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: {
      type: String,
      enum: ["Pelotas", "Pajillas"],
      required: true,
    },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 }, // precio unitario en USD
    compareAtPrice: { type: Number, min: 0 }, // precio "antes" opcional, para mostrar descuento
    images: { type: [productImageSchema], default: [] },
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] }, // ej. ["40 mm", "60 mm", "80 mm"] o ["Normal", "Jumbo", "Smoothie"]
    minOrderQuantity: { type: Number, default: 1, min: 1 },
    stock: { type: Number, default: 0, min: 0 }, // disponibilidad mostrada en la tienda (no ligado a Inventario interno)
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ category: 1, active: 1 });

export default model("Product", productSchema);
