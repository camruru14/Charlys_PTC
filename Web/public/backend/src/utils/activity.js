import activityModel from "../models/Activity.js";

// Registra la novedad de un pedido nuevo de la tienda para las burbujas del
// panel (ver private/backend/src/lib/activity.js): el pedido aparece en
// Pedidos y en Inventario > Pedidos, y su venta en Finanzas. `actor: null`
// porque lo hizo la tienda. Si falla solo se escribe en el log: el cliente
// ya pagó y su pedido existe.
export async function recordStoreOrderActivity(order) {
  try {
    await activityModel.create({
      keys: ["pedidos", "inventario.pedidos", "finanzas"],
      entityType: "order",
      entityId: order._id,
      action: "store-order",
      actor: null,
    });
  } catch (error) {
    console.log(`error al registrar la actividad de ${order.orderNumber}: ${error}`);
  }
}
