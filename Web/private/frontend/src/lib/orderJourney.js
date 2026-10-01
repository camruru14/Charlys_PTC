import { fmtDateTime } from "./format";

/*
  Recorrido de un pedido (Stepper de la ficha en Pedidos), a partir de
  order.status y order.statusHistory (que llena el backend en cada cambio de
  status, ver private/backend/src/lib/orderStatus.js).

  Reglas:
  - Tramo con registro en statusHistory: lleva la fecha del último registro
    de ese status («19 sep · 14:10»).
  - Tramo actual: "current" (azul); si es «Entregado», "done".
  - Tramo anterior al actual sin registro: "done" con «—» (el pedido ya pasó
    por ahí, pero no hay fecha: pedidos del checkout que arrancan en
    Procesando o pedidos migrados que solo tienen su status actual).
  - «En Fabricación» es "skipped" (omitido) si el pedido ya llegó a Empacado
    o más allá y el historial no tiene ningún registro de «En Fabricación».
  - Tramos posteriores al actual: "pending".
*/
export const ORDER_STEPS = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];

function lastEntryFor(history, status) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].status === status) return history[i];
  }
  return null;
}

export function orderJourneySteps(order) {
  const history = order?.statusHistory || [];
  const currentIdx = ORDER_STEPS.indexOf(order?.status);
  const packedIdx = ORDER_STEPS.indexOf("Empacado");

  return ORDER_STEPS.map((label, i) => {
    const entry = lastEntryFor(history, label);
    let state;
    if (currentIdx === -1 || i > currentIdx) state = "pending";
    else if (i === currentIdx) state = label === "Entregado" ? "done" : "current";
    else if (label === "En Fabricación" && currentIdx >= packedIdx && !entry) state = "skipped";
    else state = "done";

    return { label, state, date: state !== "pending" && entry ? fmtDateTime(entry.at) : null };
  });
}

// Último registro del historial (para «Última acción» en la ficha).
export function lastStatusEntry(order) {
  const history = order?.statusHistory || [];
  return history.length ? history[history.length - 1] : null;
}
