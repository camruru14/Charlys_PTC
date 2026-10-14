// Único punto para cambiar el status de un pedido en el backend privado.
// Además de fijar order.status, agrega el registro correspondiente a
// order.statusHistory (que alimenta el recorrido del pedido en Pedidos), así
// el historial nunca se desincroniza del status real.
//
// - Solo registra cuando el status realmente cambia (o cuando el historial
//   está vacío, ej. al crear el pedido), para no duplicar registros cuando un
//   controlador recalcula el mismo status.
// - No guarda el documento: eso queda a cargo de quien llama.
export function setOrderStatus(order, status, at = new Date()) {
  if (!status) return order;

  const history = order.statusHistory || [];
  const last = history[history.length - 1];
  const changed = order.status !== status || !last || last.status !== status;

  order.status = status;
  if (changed) {
    order.statusHistory = [...history, { status, at }];
  }
  return order;
}

// Calcula order.status (uno de los valores del enum de Order.js) a partir del
// estado real de todas las líneas del pedido, en vez de que cada acción de
// Inventario/Fabricación lo fije a mano mirando solo la línea que acaba de
// tocar. Prioridad:
//   1. Si el pedido ya salió con su ruta (delivery.dispatchedAt, que pone depart
//      en lib/routes.js), o ya se entregó, el ciclo de despacho lo maneja
//      Logística aparte: no se toca. Tener motorista NO congela el estado: una
//      ruta en «Recolectando» todavía acepta que se empaque o desempaque una
//      línea, y el pedido pasa a «Empacado» (o vuelve) como cualquier otro.
//   2. Todas las líneas empacadas -> "Empacado".
//   3. Alguna línea enviada a fabricación y ninguna empacada -> "En Fabricación".
//   4. Alguna línea con avance (verificada o empacada) -> "Procesando".
//   5. Sin avance: "Procesando" si el pedido ya pasó a Inventario
//      (sentToInventoryAt: los de la tienda nacen así y deshacer una acción no los
//      devuelve a «Pendiente»); "Pendiente" solo si todavía no se manda a Inventario.
export function computeOrderStatus(order) {
  if (order.status === "Entregado" || order.delivery?.deliveredAt) return order.status;
  if ((order.delivery?.dispatchedAt || order.status === "En Tránsito") && order.delivery?.route) return order.status;

  const items = order.items || [];
  const anyPack = items.some((i) => i.packed || i.stockPackedAt || i.manufacturePackedAt);
  if (items.length > 0 && items.every((i) => i.packed)) return "Empacado";
  if (items.some((i) => i.sentToManufacturing) && !anyPack) return "En Fabricación";
  if (items.some((i) => i.verified) || anyPack) return "Procesando";
  return order.sentToInventoryAt ? "Procesando" : "Pendiente";
}

export default setOrderStatus;
