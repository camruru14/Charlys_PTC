import { Schema, model } from "mongoose";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Wompi"];

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true }, // secure_url de Cloudinary
    publicId: { type: String, required: true }, // public_id (para poder borrarla)
    resourceType: { type: String, default: "image" }, // resource_type con el que se subió
    name: { type: String }, // nombre original del archivo
    mimeType: { type: String },
  },
  { _id: false },
);

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
    // Método de pago. Las ventas de la tienda entran con "Wompi"; los
    // movimientos manuales del panel usan Efectivo, Transferencia o Cheque.
    paymentMethod: { type: String, enum: PAYMENT_METHODS },
    // Vencimiento de lo «por pagar» / «por cobrar». Solo con status
    // "Pendiente"; se borra al pasar a "Completado".
    dueDate: { type: Date },
    // Fecha en que se marcó como pagado.
    paidAt: { type: Date },
    // Factura adjunta (imagen o PDF en Cloudinary). No aplica a las ventas.
    attachment: { type: attachmentSchema },
    // Venta de un pedido con pago SIMULADO (modo de pago demo/auto de la tienda): el panel la marca
    // «Pago de prueba».
    paymentDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Una venta de la tienda (la crea sola el checkout) lleva el pedido o su N°.
// Esas ventas no se editan, no se borran y no admiten archivos desde el panel.
export const isStoreSale = (t) => Boolean(t?.relatedOrder || t?.orderNumber);

export default model("Transaction", transactionSchema);
