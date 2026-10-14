import { Schema, model } from "mongoose";

// IMPORTANTE: copia intencional del modelo Activity del panel privado
// (private/backend/src/models/Activity.js), igual que Transaction.js y
// Order.js. Ambos backends escriben en la MISMA colección "activities": cada
// pedido nuevo de la tienda se registra aquí para que el panel muestre la
// burbuja de novedades en Pedidos, Inventario > Pedidos y Finanzas.
// Si se modifica el esquema en el panel privado, este archivo debe
// actualizarse igual (incluido el índice TTL de 45 días).
const ACTIVITY_TTL_DAYS = 45;

const activitySchema = new Schema({
  keys: { type: [String], required: true },
  entityType: {
    type: String,
    enum: ["order", "batch", "dailyBatch", "route", "inventory", "transaction", "employee"],
    required: true,
  },
  entityId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String },
  // null: la acción la hizo la tienda, no un empleado.
  actor: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
  at: { type: Date, default: Date.now },
});

activitySchema.index({ keys: 1, at: -1 });
activitySchema.index({ at: 1 }, { expireAfterSeconds: ACTIVITY_TTL_DAYS * 24 * 60 * 60 });

export default model("Activity", activitySchema);
