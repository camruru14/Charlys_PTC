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
      enum: ["Pendiente", "Pagado", "Completado"],
      default: "Completado",
    },
    date: { type: Date, default: Date.now },
    relatedOrder: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

export default model("Transaction", transactionSchema);
