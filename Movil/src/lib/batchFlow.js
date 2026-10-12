import { calendarDaysAgo, formatClock, formatShortDate, formatWhen, fromDateOnly } from "./format";

// Lotes de fabricación, portado de Web/private/frontend/src/lib/batchFlow.js.
// Flujo de un lote de stock (no «Pedido»): Programado → En proceso
// (⇄ Detenido) → Completado, que se muestra «Por enviar» → Enviar a bodega
// → «En bodega».
export const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];
export const BATCH_STATUSES = ["Programado", "En Proceso", "Completado", "Detenido"];

export const isStockBatch = (b) => b?.category !== "Pedido";

// Estado visible del lote (dominio "lote" de statusTones.js).
export function batchState(b) {
  if (!b) return "—";
  if (b.status === "Completado" && isStockBatch(b)) return b.sentToWarehouseAt ? "En bodega" : "Por enviar";
  if (b.status === "En Proceso") return "En proceso";
  return b.status || "—";
}

// Estado del encabezado del detalle.
export function batchHeaderState(b) {
  const state = batchState(b);
  return state === "Por enviar" ? "Completado · por enviar" : state;
}

// Seguras ante null/undefined: productLabel(null) -> "", pendingUnits(null) -> 0.
export const productLabel = (b) => (b ? [b.product, b.color].filter(Boolean).join(" ") : "");

// Unidades que faltan por sumar a inventario al enviar.
export const pendingUnits = (b) => (b ? Math.max(0, (b.producedQuantity || 0) - (b.sentQuantity || 0)) : 0);

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

// ---- Lista de Lotes agrupada por estado (como la web) ----

// Grupos de la lista, en su orden fijo. `state` es batchState(); `ranged`:
// solo «En bodega» se filtra por el rango de fechas (por sentToWarehouseAt);
// los lotes activos se ven siempre. `key` identifica el estado elegido.
export const BATCH_GROUPS = [
  { key: "detenido", state: "Detenido", label: "Detenidos", note: "requieren atención" },
  { key: "por-enviar", state: "Por enviar", label: "Por enviar", note: "completados, falta enviar a bodega" },
  { key: "en-proceso", state: "En proceso", label: "En proceso", note: "en línea ahora" },
  { key: "programado", state: "Programado", label: "Programados", note: "por iniciar" },
  { key: "en-bodega", state: "En bodega", label: "En bodega", note: "más recientes primero", ranged: true },
];

const ms = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// Fecha de inicio programada (startDate no lleva hora) o, sin ella, la de creación.
const scheduledStart = (b) => (b.startDate ? fromDateOnly(b.startDate) : b.createdAt ? new Date(b.createdAt) : null);

// Cuándo se completó (con hora si el flujo nuevo la registró).
const completedAt = (b) => batchEnd(b)?.date || (b.updatedAt ? new Date(b.updatedAt) : null);

// Valor por el que se ordena cada grupo (ascendente, menos «En bodega»).
const SORT_KEY = {
  Detenido: (b) => ms(b.stoppedAt || b.updatedAt),
  "Por enviar": (b) => ms(completedAt(b)),
  "En proceso": (b) => ms(batchStart(b)?.date),
  Programado: (b) => ms(scheduledStart(b)),
  "En bodega": (b) => ms(b.sentToWarehouseAt),
};

// ¿El lote se ve con el rango de fechas? Solo «En bodega» se filtra.
export function inBatchRange(b, group, range) {
  if (!group.ranged || !range?.from || !range?.to) return true;
  const at = ms(b.sentToWarehouseAt);
  return !at || (at >= range.from.getTime() && at <= range.to.getTime());
}

// Lotes por grupo, en el orden de BATCH_GROUPS y con el orden de cada uno.
// Devuelve [{ ...grupo, items }], incluidos los vacíos.
export function groupBatches(list, range) {
  const byState = new Map(BATCH_GROUPS.map((g) => [g.state, []]));
  for (const b of list) byState.get(batchState(b))?.push(b);
  return BATCH_GROUPS.map((group) => {
    const key = SORT_KEY[group.state];
    const items = byState.get(group.state).filter((b) => inBatchRange(b, group, range));
    items.sort((a, b) => (group.state === "En bodega" ? key(b) - key(a) : key(a) - key(b)));
    return { ...group, items };
  });
}

// «hace 5 min» / «hace 2 h» si fue hoy; si no, «ayer 16:10» o «hace N días».
function sinceText(value, now) {
  const when = formatWhen(value, now);
  if (!when) return null;
  if (when.days > 0) return when.text;
  const minutes = Math.max(0, Math.floor((now - new Date(value)) / 60000));
  if (minutes < 1) return "hace un momento";
  return minutes < 60 ? `hace ${minutes} min` : `hace ${Math.floor(minutes / 60)} h`;
}

// Nota de tiempo de la tarjeta de un lote: { text, tone, bold }. `tone` es
// «rose» (detenido), «amber» (atrasado) o null (gris).
//   Detenido: «detenido hace 2 h» · Por enviar: «completado hoy 09:15» (ámbar
//   pasadas 24 h) · En proceso: «desde 07:30» · Programado: «inicia mañana»,
//   «debió iniciar 10 oct» (ámbar) · En bodega: «enviado 11 oct».
export function batchTimeNote(b, now = new Date()) {
  const state = batchState(b);
  if (state === "Detenido") {
    const text = sinceText(b.stoppedAt || b.updatedAt, now);
    return text ? { text: `detenido ${text}`, tone: "rose", bold: true } : null;
  }
  if (state === "Por enviar") {
    const end = batchEnd(b);
    const date = end?.date || (b.updatedAt ? new Date(b.updatedAt) : null);
    if (!date || Number.isNaN(date.getTime())) return null;
    const days = calendarDaysAgo(date, now);
    const when = end && !end.withTime ? (days <= 0 ? "hoy" : days === 1 ? "ayer" : formatShortDate(date)) : formatWhen(date, now).text;
    const late = now - date > 86400000;
    return { text: `completado ${when}`, tone: late ? "amber" : null, bold: late };
  }
  if (state === "En proceso") {
    const start = batchStart(b);
    if (!start?.date || Number.isNaN(start.date.getTime())) return null;
    const days = calendarDaysAgo(start.date, now);
    const time = start.withTime ? ` ${formatClock(start.date)}` : "";
    if (days <= 0) return { text: start.withTime ? `desde ${formatClock(start.date)}` : "desde hoy", tone: null, bold: false };
    if (days === 1) return { text: `desde ayer${time}`, tone: null, bold: false };
    return { text: `desde ${formatShortDate(start.date)}`, tone: null, bold: false };
  }
  if (state === "Programado") {
    const start = b.startDate ? fromDateOnly(b.startDate) : null;
    if (!start) return { text: "sin fecha de inicio", tone: null, bold: false };
    const days = calendarDaysAgo(start, now);
    if (days > 0) return { text: `debió iniciar ${formatShortDate(start)}`, tone: "amber", bold: true };
    if (days === 0) return { text: "inicia hoy", tone: null, bold: false };
    return { text: days === -1 ? "inicia mañana" : `inicia ${formatShortDate(start)}`, tone: null, bold: false };
  }
  if (state === "En bodega") {
    return b.sentToWarehouseAt ? { text: `enviado ${formatShortDate(b.sentToWarehouseAt)}`, tone: null, bold: false } : null;
  }
  return null;
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
