// Filtros y helpers de Logística, portados de
// Web/private/frontend/src/pages/Logistica.jsx — para que las pestañas
// "Pedidos para despacho" y "Pedidos en Tránsito" filtren exactamente igual
// que las tablas del panel web (mismas opciones, mismo criterio "todos").

// Al menos una línea ya empacada (en Almacén o Fabricación, ver
// packedLocation en Order.js): con eso basta para que Logística pueda
// asignar motorista, aunque el pedido no esté "Empacado" completo todavía
// (order.status solo llega a "Empacado" cuando TODAS las líneas lo están).
export function hasPackedItems(order) {
  return (order.items || []).some((i) => i.packed);
}

// Ubicaciones donde el pedido tiene algo empacado esperando a que el
// motorista lo recoja: "Almacén" si algún item se empacó desde Inventario >
// Pedidos, "Fabricación" si algún item se empacó desde Fabricación >
// Fabricación de pedidos. Un pedido puede requerir una sola parada o las dos.
export function getRequiredPickups(order) {
  const items = order.items || [];
  const locations = [];
  if (items.some((i) => i.packedLocation === "Almacén")) locations.push("Almacén");
  if (items.some((i) => i.packedLocation === "Fabricación")) locations.push("Fabricación");
  return locations;
}

// Fecha en que Logística confirmó la recolección en esa ubicación (o
// undefined si todavía no).
export function pickupDateFor(order, location) {
  return location === "Almacén" ? order.delivery?.pickupWarehouseAt : order.delivery?.pickupFactoryAt;
}

// Opciones de motorista/vehículo/estado presentes en una lista de pedidos
// (una por pestaña), para no mostrar en el filtro opciones que no aplican a
// lo que esa lista está mostrando.
export function driverOptionsFor(orders) {
  const map = new Map();
  orders.forEach((o) => {
    const d = o.delivery?.driver;
    if (d && typeof d === "object" && d._id) map.set(d._id, d);
  });
  return Array.from(map.values());
}

export function vehicleOptionsFor(orders) {
  const set = new Set();
  orders.forEach((o) => {
    if (o.delivery?.vehicle) set.add(o.delivery.vehicle);
  });
  return Array.from(set).sort();
}

export function statusOptionsFor(orders) {
  const set = new Set();
  orders.forEach((o) => set.add(o.delivery?.dispatchStatus || o.status));
  return Array.from(set);
}

export function filterOrders(orders, { driver, vehicle, status }) {
  return orders.filter((o) => {
    if (driver) {
      const id = typeof o.delivery?.driver === "object" ? o.delivery?.driver?._id : o.delivery?.driver;
      if (id !== driver) return false;
    }
    if (vehicle && o.delivery?.vehicle !== vehicle) return false;
    if (status && (o.delivery?.dispatchStatus || o.status) !== status) return false;
    return true;
  });
}
