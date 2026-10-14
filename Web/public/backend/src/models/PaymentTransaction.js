import { Schema, model } from "mongoose";

// Registro de auditoría de un cobro con Wompi (tokenización directa, ver
// src/utils/wompiClient.js). Se guarda aparte del modelo Order para no
// modificar el esquema que ya usa/lee el panel privado. Como el cobro es
// síncrono (se resuelve dentro de POST /orders/checkout), solo se crea un
// registro por pedido, y solo cuando el pago fue aprobado — si Wompi lo
// rechaza no se crea ni el pedido ni este registro (el cliente reintenta
// desde el checkout con otra tarjeta).
//
// Excepción: si el cobro SE APROBÓ pero no se pudo guardar el pedido, se guarda aquí
// un registro con needsReconciliation: true (sin `order`, con el pedido que se iba a
// crear en `payload`) para conciliarlo a mano contra Wompi. No se reembolsa solo.
//
// Otra excepción: un cobro SIN CONFIRMAR (Wompi no respondió, respondió 5xx o su respuesta 2xx
// no se pudo leer; wompiClient marca el error con `unconfirmed`). No sabemos si se cobró, así que
// se guarda con status "pendiente_conciliacion" y needsReconciliation: true (sin `order`, con el
// pedido reservado y su número en `payload` y el motivo en `failureReason`) para
// revisarlo a mano contra Wompi; el cliente recibe un 502 y no reintenta.
const paymentTransactionSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: function requiresOrder() { return !this.needsReconciliation; }, index: true },
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
      enum: ["aprobado", "rechazado", "pendiente_conciliacion"],
      required: true,
    },

    // Cobro aprobado cuyo pedido no se pudo registrar: hay que conciliarlo a mano.
    needsReconciliation: { type: Boolean, default: false, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    // El pedido que se iba a crear (número, líneas, dirección…) y el motivo del fallo.
    payload: { type: Schema.Types.Mixed },
    failureReason: { type: String },
  },
  { timestamps: true },
);

export default model("PaymentTransaction", paymentTransactionSchema);
