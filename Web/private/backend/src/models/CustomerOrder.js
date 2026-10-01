import { Schema, model } from "mongoose";

// IMPORTANTE: copia intencional del modelo CustomerOrder de la tienda pública
// (public/backend/src/models/CustomerOrder.js). Ambos backends usan la MISMA
// colección "customerorders": el vínculo entre una cuenta de la tienda y su
// pedido. Aquí solo se usa al eliminar un pedido entregado (ver deleteOrder en
// controller/ordersController.js): el vínculo se conserva y se le guarda un
// resumen del pedido para que el cliente siga viéndolo en «Mis pedidos».
// Si se modifica el esquema en uno, hay que actualizarlo igual en el otro.
const customerOrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    deletedAt: { type: Date },
    snapshot: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default model("CustomerOrder", customerOrderSchema);
