import { Schema, model } from "mongoose";

// IMPORTANTE: este esquema es una copia intencional del modelo Product de la
// tienda pública (public/backend/src/models/Product.js), igual que se hizo
// con Employee.js, Order.js y Transaction.js. Ambos backends apuntan a la
// MISMA base de datos y a la MISMA colección "products": public/backend solo
// la lee (catálogo de la tienda, precios del checkout) y este backend la
// administra desde el panel (pages/Catalogo.jsx: crear, editar, eliminar
// productos y sus imágenes), así el Catálogo del panel no depende de que la
// tienda pública esté corriendo.
//
// Si se modifica el esquema en un lado, el otro archivo debe actualizarse
// igual para que ambos sigan siendo compatibles.

// Sin distinguir mayúsculas (strength 2): "Jumbo" y "jumbo" son el mismo nombre.
export const NAME_COLLATION = { locale: "es", strength: 2 };

const productImageSchema = new Schema(
  {
    url: { type: String, required: true }, // secure_url de Cloudinary
    publicId: { type: String, required: true }, // public_id de Cloudinary (para poder borrarla)
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    // El nombre es el «producto» que se elige en Fabricación, Producción
    // diaria e Inventario y el que guardan las líneas de los pedidos. Es único
    // sin distinguir mayúsculas ni espacios sobrantes (índice de abajo).
    name: { type: String, required: true, trim: true }, // ej. "Pajilla jumbo"
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
// Nombre único sin distinguir mayúsculas (strength 2). El panel además lo
// recorta y colapsa sus espacios antes de guardar.
productSchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION });

export default model("Product", productSchema);
