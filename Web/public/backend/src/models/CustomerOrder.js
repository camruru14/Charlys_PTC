import { Schema, model } from "mongoose";

// Vínculo simple entre un Customer (cuenta de la tienda) y un Order (colección
// compartida con el panel privado). Se guarda aparte para no tener que
// añadirle un campo "customer" al esquema Order que ya usa el panel privado.
//
// IMPORTANTE: copia intencional en private/backend/src/models/CustomerOrder.js
// (el panel elimina pedidos entregados y le deja aquí el resumen). Si se
// modifica el esquema en uno, hay que actualizarlo igual en el otro.
//
// Cuando el panel elimina un pedido entregado, este vínculo se CONSERVA para
// que el cliente siga viendo su compra en «Mis pedidos»: `order` queda como un
// id sin documento (no se borra, para no chocar con el índice único que ya
// existe) y `snapshot` guarda el pedido tal como estaba (ver
// getMyOrders/getMyOrder en controller/ordersController.js).
const customerOrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    // Solo si el pedido interno fue eliminado desde el panel.
    deletedAt: { type: Date },
    snapshot: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default model("CustomerOrder", customerOrderSchema);
