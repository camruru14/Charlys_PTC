import { Schema, model } from "mongoose";

// Vínculo simple entre un Customer (cuenta de la tienda) y un Order (colección
// compartida con el panel privado). Se guarda aparte para no tener que
// añadirle un campo "customer" al esquema Order que ya usa el panel privado.
const customerOrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  },
  { timestamps: true },
);

export default model("CustomerOrder", customerOrderSchema);
