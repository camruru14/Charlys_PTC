import { Schema, model } from "mongoose";

// Registro de auditoría de un cobro con Wompi (tokenización directa, ver
// src/utils/wompiClient.js). Se guarda aparte del modelo Order para no
// modificar el esquema que ya usa/lee el panel privado. Como el cobro es
// síncrono (se resuelve dentro de POST /orders/checkout), solo se crea un
// registro por pedido, y solo cuando el pago fue aprobado — si Wompi lo
// rechaza no se crea ni el pedido ni este registro (el cliente reintenta
// desde el checkout con otra tarjeta).
const paymentTransactionSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: String, default: "wompi" },

    // Respuesta del cobro (TransaccionCompra/TokenizadaSin3Ds)
    idTransaccion: { type: String },
    monto: { type: Number },
    esAprobada: { type: Boolean, required: true },
    formaPago: { type: String },
    codigoAutorizacion: { type: String },
    mensaje: { type: String },

    // Solo los últimos 4 dígitos: la tarjeta completa nunca se guarda.
    cardLast4: { type: String },

    status: {
      type: String,
      enum: ["aprobado", "rechazado"],
      required: true,
    },
  },
  { timestamps: true },
);

export default model("PaymentTransaction", paymentTransactionSchema);
