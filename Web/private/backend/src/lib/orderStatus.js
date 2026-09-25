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

export default setOrderStatus;
