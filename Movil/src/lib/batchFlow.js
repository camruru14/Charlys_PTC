import { fromDateOnly } from "./format";

// Lotes de fabricación, portado de Web/private/frontend/src/lib/batchFlow.js.
// Flujo de un lote de stock (no «Pedido»): Programado → En proceso
// (⇄ Detenido) → Completado, que se muestra «Por enviar» → Enviar a bodega
// → «En bodega».
export const isStockBatch = (b) => b?.category !== "Pedido";

// Estado visible del lote (dominio "lote" de statusTones.js).
export function batchState(b) {
  if (b.status === "Completado" && isStockBatch(b)) return b.sentToWarehouseAt ? "En bodega" : "Por enviar";
  if (b.status === "En Proceso") return "En proceso";
  return b.status || "—";
}

export const productLabel = (b) => [b.product, b.color].filter(Boolean).join(" ");

// Inicio del lote: con hora si el flujo nuevo lo registró; en lotes viejos
// solo la fecha (startDate se guarda sin hora).
export function batchStart(b) {
  if (b.startedAt) return { date: new Date(b.startedAt), withTime: true };
  if (b.startDate) return { date: fromDateOnly(b.startDate), withTime: false };
  return null;
}
