// Mapeo de estado -> tono de color, compartido entre pantallas que muestran
// el mismo tipo de estado (ej. el status de un lote aparece tanto en
// FabricacionScreen como en el "Lotes recientes" del Dashboard).
export function batchStatusTone(status) {
  switch (status) {
    case "En Proceso":
      return "blue";
    case "Completado":
      return "green";
    case "Detenido":
      return "red";
    case "Programado":
    default:
      return "gray";
  }
}

export function transactionStatusTone(status) {
  return status === "Completado" ? "green" : "amber";
}

export function inventoryStockTone(item) {
  const min = Number(item?.minStock || 0);
  const stock = Number(item?.stock || 0);
  if (min <= 0) return "gray";
  if (stock <= 0) return "red";
  if (stock <= min) return "amber";
  return "gray";
}

// Mismo mapeo "global" que StatusPill.jsx del panel web (STATUS_TONE, no la
// variante ORDER_STATUS_TONE que usa Pedidos.jsx solo para su tabla) — es el
// criterio que ya seguían batchStatusTone/transactionStatusTone acá arriba.
export function orderStatusTone(status) {
  switch (status) {
    case "Procesando":
      return "blue";
    case "Empacado":
    case "Entregado":
      return "green";
    default:
      // Pendiente, En Fabricación, En Tránsito
      return "amber";
  }
}

export function paymentStatusTone(status) {
  if (status === "Pagado") return "green";
  if (status === "Pendiente") return "amber";
  return "gray"; // Reembolsado
}

export function dispatchStatusTone(status) {
  switch (status) {
    case "A tiempo":
      return "blue";
    case "Demorado":
      return "red";
    case "Entregado":
      return "green";
    default:
      return "amber"; // Saliendo
  }
}

// Mapeo de estado -> tono EXCLUSIVO de la lista de Pedidos (OrderCard y
// PedidoFormScreen): un color por cada una de las 6 etapas, distinto de
// orderStatusTone() de arriba — igual que ORDER_STATUS_TONE en
// Web/private/frontend/src/pages/Pedidos.jsx, que también es exclusivo de
// esa tabla y no toca el StatusPill global (esas mismas palabras, ej.
// "Empacado", significan otra cosa en otras pantallas — ver comentario de
// ORDER_STATUS_TONE en la web).
export function orderStatusToneDetailed(status) {
  switch (status) {
    case "Procesando":
      return "blue";
    case "En Fabricación":
      return "yellow";
    case "Empacado":
      return "purple";
    case "En Tránsito":
      return "sky";
    case "Entregado":
      return "green";
    default:
      return "gray"; // Pendiente
  }
}
