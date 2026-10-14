import transactionModel from "../models/Transaction.js";
import { nextCode } from "./counters.js";

// Siguiente referencia correlativa del año (TRAN-2026-0001, TRAN-2026-0002, ...), en la
// MISMA secuencia que las transacciones creadas desde el panel (private/backend/src/
// controller/transactionsController.js): contador atómico compartido (utils/counters.js).
export const generateReference = () => nextCode("TRAN", transactionModel, "reference");

// Registra en Finanzas el ingreso "Ventas" de un pedido de la tienda. Todo
// pedido nace pagado (solo se crea si Wompi aprobó el cobro), así que se llama
// justo al crearlo, siempre. Idempotente: si ya existe un Ingreso "Ventas" para
// ese pedido, no crea otro.
// `session`: la transacción de MongoDB del checkout (el pedido y su venta se guardan
// juntos). `reference`: una referencia ya reservada con generateReference().
export async function recordSaleTransaction(order, { session, reference: reserved } = {}) {
  const alreadyExists = await transactionModel
    .findOne({
      relatedOrder: order._id,
      category: "Ventas",
      type: "Ingreso",
    })
    .session(session || null);
  if (alreadyExists) return alreadyExists;

  const reference = reserved || (await generateReference());
  const [created] = await transactionModel.create(
    [
      {
        reference,
        concept: `Venta pedido ${order.orderNumber}`,
        type: "Ingreso",
        category: "Ventas",
        amount: order.total,
        status: "Completado",
        paymentMethod: "Wompi",
        relatedOrder: order._id,
        orderNumber: order.orderNumber,
      },
    ],
    { session },
  );
  return created;
}
