import { Schema, model } from "mongoose";

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
    // N° del pedido como texto: queda legible aunque el pedido se elimine (al
    // eliminarlo se quita relatedOrder y esto se conserva).
    orderNumber: { type: String },
  },
  { timestamps: true },
);

export default model("Transaction", transactionSchema);
