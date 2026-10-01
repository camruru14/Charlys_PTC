import { fromDateOnly } from "./format";

// Lotes de fabricación, portado de Web/private/frontend/src/lib/batchFlow.js.
// Flujo de un lote de stock (no «Pedido»): Programado → En proceso
// (⇄ Detenido) → Completado, que se muestra «Por enviar» → Enviar a bodega
// → «En bodega».
export const PRODUCTS = ["Pajilla", "Pelota"];
export const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];
export const BATCH_STATUSES = ["Programado", "En Proceso", "Completado", "Detenido"];

export const isStockBatch = (b) => b?.category !== "Pedido";

// Estado visible del lote (dominio "lote" de statusTones.js).
export function batchState(b) {
  if (b.status === "Completado" && isStockBatch(b)) return b.sentToWarehouseAt ? "En bodega" : "Por enviar";
  if (b.status === "En Proceso") return "En proceso";
  return b.status || "—";
}

// Estado del encabezado del detalle.
export function batchHeaderState(b) {
  const state = batchState(b);
  return state === "Por enviar" ? "Completado · por enviar" : state;
}

export const productLabel = (b) => [b.product, b.color].filter(Boolean).join(" ");

// Unidades que faltan por sumar a inventario al enviar.
export const pendingUnits = (b) => Math.max(0, (b.producedQuantity || 0) - (b.sentQuantity || 0));

// Inicio y fin: con hora si el flujo nuevo los registró; en lotes viejos
// solo la fecha (startDate/endDate se guardan sin hora).
export function batchStart(b) {
  if (b.startedAt) return { date: new Date(b.startedAt), withTime: true };
  if (b.startDate) return { date: fromDateOnly(b.startDate), withTime: false };
  return null;
}

export function batchEnd(b) {
  if (b.completedAt) return { date: new Date(b.completedAt), withTime: true };
  if (b.endDate) return { date: fromDateOnly(b.endDate), withTime: false };
  return null;
}

// Fecha para ordenar lotes completados en el tiempo.
function completedTime(b) {
  const end = batchEnd(b)?.date || batchStart(b)?.date || new Date(b.updatedAt || b.createdAt);
  return end.getTime();
}

// Historial de la línea del lote: últimos 6 lotes completados de esa línea
// en orden cronológico (si el lote ya está completado, la ventana termina en
// él). { history, previous, average }; previous = lote completado anterior
// de la misma línea (para «vs. lote anterior»).
export function lineStats(batch, batches, size = 6) {
  if (!batch?.productionLine) return { history: [], previous: null, average: null };
  const completed = batches
    .filter((b) => b.status === "Completado" && b.productionLine === batch.productionLine)
    .sort((a, b) => completedTime(a) - completedTime(b));

  let upTo = completed.length;
  if (batch.status === "Completado") {
    const at = completed.findIndex((b) => b._id === batch._id);
    if (at >= 0) upTo = at + 1;
  }
  const history = completed.slice(Math.max(0, upTo - size), upTo);
  const currentIndex = batch.status === "Completado" ? upTo - 1 : -1;
  const previous = currentIndex > 0 ? completed[currentIndex - 1] : null;
  const average = history.length
    ? Math.round(history.reduce((s, b) => s + (b.producedQuantity || 0), 0) / history.length)
    : null;
  return { history, previous, average };
}

export function batchSearchText(b) {
  return [b.batchNumber, b.product, b.color, b.productionLine].filter(Boolean).join(" ").toLowerCase();
}

// Vista previa del próximo número de lote (el backend genera el definitivo).
export function previewBatchNumber(list) {
  const prefix = `LOTE-${new Date().getFullYear()}-`;
  const lastNumber = list.reduce((max, b) => {
    if (!b.batchNumber?.startsWith(prefix)) return max;
    const n = parseInt(b.batchNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

// Vista previa del próximo ID de lote diario.
export function previewDailyBatchNumber(list) {
  const prefix = "LTE-DIARIO-";
  const lastNumber = list.reduce((max, b) => {
    if (!b.dailyBatchNumber?.startsWith(prefix)) return max;
    const n = parseInt(b.dailyBatchNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}
