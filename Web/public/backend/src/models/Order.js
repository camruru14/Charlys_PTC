import { Schema, model } from "mongoose";

// IMPORTANTE: este esquema es una copia intencional del modelo Order del
// panel privado (private/backend/src/models/Order.js). Ambos backends
// apuntan a la MISMA base de datos y a la MISMA colección "orders", para que
// los pedidos creados aquí (desde la tienda pública) aparezcan de inmediato
// en Pedidos / Inventario / Fabricación / Logística del panel administrativo
// ya construido, sin pasos de sincronización manual.
//
// Si se modifica el esquema en el panel privado, este archivo debe
// actualizarse igual para que ambos lados sigan siendo compatibles.
// Los datos específicos de Wompi (enlace de pago, hash, respuesta del
// webhook, etc.) NO se guardan aquí: viven en el modelo PaymentTransaction
// de este backend, para no tocar/romper el esquema que ya usa el panel
// privado.

const orderItemSchema = new Schema(
  {
    product: { type: String, required: true }, // ej. "Pajilla", "Pelota"
    color: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    verified: { type: Boolean, default: false },
    verifiedWarehouse: { type: String },
    verifiedAt: { type: Date },
    packed: { type: Boolean, default: false },
    packedAt: { type: Date },
    packedLocation: { type: String, enum: ["Almacén", "Fabricación"] },
    sentToManufacturing: { type: Boolean, default: false },
    sentToManufacturingAt: { type: Date },
    manufacturingBatch: { type: Schema.Types.ObjectId, ref: "ProductionBatch" },
    manufacturedAt: { type: Date },
  },
  { _id: false },
);

const deliverySchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: "Employee" },
    vehicle: { type: String },
    dispatchStatus: {
      type: String,
      enum: ["Saliendo", "A tiempo", "Demorado", "Entregado"],
      default: "Saliendo",
    },
    dispatchedAt: { type: Date },
    deliveredAt: { type: Date },
    address: { type: String },
    pickupWarehouseAt: { type: Date },
    pickupFactoryAt: { type: Date },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      address: { type: String },
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "Pendiente",
        "Procesando",
        "En Fabricación",
        "Empacado",
        "En Tránsito",
        "Entregado",
      ],
      default: "Pendiente",
    },
    paymentStatus: {
      type: String,
      enum: ["Pendiente", "Pagado", "Reembolsado"],
      default: "Pendiente",
    },
    source: {
      type: String,
      default: "ecommerce",
    },
    delivery: deliverySchema,
    notes: {
      type: String,
    },
    inventoryRequestedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Order", orderSchema);
