import activityModel from "../models/Activity.js";

// Registra las novedades de un pedido nuevo de la tienda para el panel (ver
// private/backend/src/lib/activity.js). Cada pestaña marca la fila que ella
// muestra: el pedido en Pedidos e Inventario > Pedidos, y la venta (su
// transacción) en Finanzas. `actor: null` porque lo hizo la tienda. Si falla
// solo se escribe en el log: el cliente ya pagó y su pedido existe.
export async function recordStoreOrderActivity(order, sale) {
  try {
    const docs = [
      { keys: ["pedidos", "inventario.pedidos"], entityType: "order", entityId: order._id, action: "store-order", actor: null },
    ];
    if (sale?._id) docs.push({ keys: ["finanzas"], entityType: "transaction", entityId: sale._id, action: "store-order", actor: null });
    await activityModel.create(docs);
  } catch (error) {
    console.log(`error al registrar la actividad de ${order.orderNumber}: ${error}`);
  }
}
