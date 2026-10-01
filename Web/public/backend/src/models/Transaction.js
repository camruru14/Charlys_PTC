import { Schema, model } from "mongoose";

// IMPORTANTE: copia intencional del modelo Transaction del panel privado
// (private/backend/src/models/Transaction.js), igual que Order.js. Ambos
// backends escriben en la MISMA colección "transactions", así que la venta
// que registra el checkout aparece de inmediato en Finanzas del panel.
// Si se modifica el esquema en el panel privado, este archivo debe
// actualizarse igual.
const transactionSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    concept: { type: String, required: true },
    type: {
      type: String,
      enum: ["Ingreso", "Gasto"],
      required: true,
    },
    category: { type: String },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pendiente", "Completado"],
      default: "Completado",
    },
    date: { type: Date, default: Date.now },
    relatedOrder: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

export default model("Transaction", transactionSchema);
