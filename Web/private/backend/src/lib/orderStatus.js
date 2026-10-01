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
//   1. Si ya hay motorista asignado, el ciclo de despacho activo lo maneja
//      assignDelivery/updateStatus aparte: no se toca.
//   2. Todas las líneas empacadas -> "Empacado".
//   3. Alguna línea enviada a fabricación y ninguna empacada -> "En Fabricación".
//   4. Alguna línea con avance (verificada o empacada) -> "Procesando".
//   5. Si ninguna línea tiene avance -> "Pendiente".
export function computeOrderStatus(order) {
  if (order.delivery?.driver) return order.status;

  const items = order.items || [];
  const anyPack = items.some((i) => i.packed || i.stockPackedAt || i.manufacturePackedAt);
  if (items.length > 0 && items.every((i) => i.packed)) return "Empacado";
  if (items.some((i) => i.sentToManufacturing) && !anyPack) return "En Fabricación";
  if (items.some((i) => i.verified) || anyPack) return "Procesando";
  return "Pendiente";
}

export default setOrderStatus;
