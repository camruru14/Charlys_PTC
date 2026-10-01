// Los pedidos solo los crea el checkout de la tienda (public/backend): el panel
// ya no tiene crear ni editar. Las pruebas arman el pedido como lo deja ese
// checkout: «Procesando» desde el inicio, con el correo del cliente, que pasa
// solo a Inventario, y con su Ingreso «Ventas» en Finanzas (todo pedido nace
// pagado: ya no existe un estado de pago).
import Order from "../../src/models/Order.js";
import Transaction from "../../src/models/Transaction.js";

let seq = 0;

export async function createStoreOrder({ customer = { name: "Cliente de la tienda" }, items = [], total, notes, status = "Procesando" } = {}) {
  seq += 1;
  const createdAt = new Date();
  const orderTotal = total ?? items.reduce((sum, i) => sum + (i.subtotal ?? i.quantity * i.unitPrice), 0);
  const order = await Order.create({
    orderNumber: `ORD-2026-${String(seq).padStart(4, "0")}`,
    customer: { email: "cliente@example.com", ...customer },
    items,
    total: orderTotal,
    notes,
    source: "ecommerce",
    status,
    statusHistory: [{ status, at: createdAt }],
    sentToInventoryAt: createdAt,
  });
  await Transaction.create({
    reference: `TRAN-2026-${String(seq).padStart(4, "0")}`,
    concept: `Venta pedido ${order.orderNumber}`,
    type: "Ingreso",
    category: "Ventas",
    amount: order.total,
    status: "Completado",
    relatedOrder: order._id,
    orderNumber: order.orderNumber,
  });
  return order;
}
