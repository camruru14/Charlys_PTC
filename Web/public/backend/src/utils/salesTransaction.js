import transactionModel from "../models/Transaction.js";

// Misma lógica que generateReference (private/backend/src/controller/
// transactionsController.js): siguiente referencia correlativa del año
// (TRAN-2026-0001, TRAN-2026-0002, ...), en la misma secuencia que las
// transacciones creadas desde el panel.
async function generateReference() {
  const prefix = `TRAN-${new Date().getFullYear()}-`;
  const last = await transactionModel
    .findOne({ reference: { $regex: `^${prefix}` } })
    .sort({ reference: -1 });

  const lastNumber = last ? parseInt(last.reference.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

// Registra en Finanzas el ingreso "Ventas" de un pedido pagado, igual que
// createOrderPaymentTransaction del panel privado (private/backend/src/
// controller/ordersController.js) cuando un pedido pasa a "Pagado". Un pedido
// del checkout nace ya pagado, así que nunca pasa por esa transición: se
// llama aquí justo al crearlo. Idempotente: si ya existe un Ingreso "Ventas"
// para ese pedido, no crea otro.
export async function recordSaleTransaction(order) {
  const alreadyExists = await transactionModel.findOne({
    relatedOrder: order._id,
    category: "Ventas",
    type: "Ingreso",
  });
  if (alreadyExists) return alreadyExists;

  const reference = await generateReference();
  return transactionModel.create({
    reference,
    concept: `Venta pedido ${order.orderNumber}`,
    type: "Ingreso",
    category: "Ventas",
    amount: order.total,
    status: "Completado",
    relatedOrder: order._id,
  });
}
