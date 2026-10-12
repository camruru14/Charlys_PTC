import { batchNumberSearchText, fmtDate, fmtWhen } from "./format";
import { sinceText } from "./batchFlow";

/*
  Fabricación > Pedidos a partir de /orders y /productionBatches: cada pedido
  con líneas enviadas a fabricación y sus lotes (categoría «Pedido»).
  Flujo de un lote: Programado → En proceso (⇄ Detenido) → Completado →
  Empacado (queda para recoger en «Fabricación» en Logística).
*/

const isSplit = (item) => item.fromStockQty != null && item.toManufactureQty != null;

// La parte fabricada de la línea ya está empacada en Fabricación.
export function isLinePacked(item) {
  return isSplit(item) ? Boolean(item.manufacturePackedAt) : Boolean(item.packed && item.packedLocation === "Fabricación");
}

// Estado del lote (dominio «lote»).
export function lotState(lot) {
  if (lot.packed) return "Empacado";
  if (lot.batch.status === "En Proceso") return "En proceso";
  return lot.batch.status || "Programado";
}

// Lotes de un pedido: [{ batch, item, index, packed, packedAt, qty }]. El
// lote completo sale de /productionBatches; si no está (p. ej. se borró),
// se usa el poblado en la línea.
function orderLots(order, batchesById) {
  return (order.items || []).flatMap((item, index) => {
    const ref = item.manufacturingBatch;
    if (!ref) return [];
    const id = String(ref._id || ref);
    const batch = batchesById.get(id) || (typeof ref === "object" ? ref : null);
    if (!batch) return [];
    const packed = isLinePacked(item);
    return [
      {
        batch,
        item,
        index,
        packed,
        packedAt: packed ? batch.packedAt || item.manufacturePackedAt || item.packedAt : null,
        qty: batch.targetQuantity ?? (isSplit(item) ? item.toManufactureQty : item.quantity),
      },
    ];
  });
}

// Estado macro del pedido (dominio «pedido-fabricacion»).
export function macroStatus(lots) {
  const states = lots.map(lotState);
  if (states.every((s) => s === "Programado")) return "Programado";
  if (states.every((s) => s === "Empacado")) return "Empacado";
  if (states.every((s) => s === "Completado" || s === "Empacado")) return "Por empacar";
  return states.includes("Detenido") ? "En proceso · detenido" : "En proceso";
}

// Etapa 0..3 (Programado, En proceso, Completado, Empacado).
const STAGE = { Programado: 0, "En proceso": 1, "En proceso · detenido": 1, "Por empacar": 2, Empacado: 3 };
const STEP_TONES = ["amber", "blue", "green", "purple"];
export const STEP_LABELS = ["Programado", "En proceso", "Completado", "Empacado"];

export function miniSegments(group) {
  const stage = STAGE[group.macro];
  return STEP_LABELS.map((label, i) => ({
    label,
    tone: i > stage ? null : i === 1 && group.macro === "En proceso · detenido" ? "rose" : STEP_TONES[i],
  }));
}

const times = (values) => values.filter(Boolean).map((v) => new Date(v).getTime()).filter((t) => !Number.isNaN(t));
const minDate = (values) => (times(values).length ? new Date(Math.min(...times(values))) : null);
const maxDate = (values) => (times(values).length ? new Date(Math.max(...times(values))) : null);

// Pasos del Stepper con su fecha: llegada a Fabricación, primer inicio,
// última terminación y último empaque.
export function stepperDates(group) {
  const { lots } = group;
  const allDone = (pred) => lots.length > 0 && lots.every(pred);
  return {
    dates: [
      group.arrivedAt,
      minDate(lots.map((l) => l.batch.startedAt)),
      allDone((l) => l.batch.status === "Completado" || l.packed) ? maxDate(lots.map((l) => l.batch.completedAt)) : null,
      allDone((l) => l.packed) ? maxDate(lots.map((l) => l.packedAt)) : null,
    ],
    stage: STAGE[group.macro],
  };
}

/*
  Pedidos con lotes de fabricación (salvo los ya entregados), del más
  reciente en llegar a Fabricación al más antiguo.
    [{ order, lots, macro, arrivedAt, stopped }]
*/
export function buildGroups(orders, batches) {
  const batchesById = new Map(batches.map((b) => [String(b._id), b]));
  return orders
    .filter((o) => o.status !== "Entregado")
    .map((order) => {
      const lots = orderLots(order, batchesById);
      if (!lots.length) return null;
      return {
        order,
        lots,
        macro: macroStatus(lots),
        arrivedAt: minDate(
          lots.map((l) => l.item.sentToManufacturingAt || l.item.manufacturedAt || l.batch.createdAt),
        ),
        stopped: lots.filter((l) => l.batch.status === "Detenido"),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.arrivedAt?.getTime() || 0) - (a.arrivedAt?.getTime() || 0));
}

export function groupSearchText(group) {
  const { order, lots } = group;
  return [order.orderNumber, order.customer?.name, ...lots.map((l) => `${batchNumberSearchText(l.batch.batchNumber)} ${l.item.product} ${l.item.color || ""}`)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/*
  Lista de Pedidos agrupada por estado (como Lotes e Inventario > Pedidos).
  `macro` es el estado macro (macroStatus); `state` el nombre en el combobox
  «Estado»; `tone` el estado cuyo color lleva el punto (dominio
  pedido-fabricacion). `ranged`: solo «Empacado» se filtra por el rango de
  fechas (por el último empaque); los pedidos activos se ven siempre.
  `key` va en la URL (?estadoPedido=).
*/
export const MFG_GROUPS = [
  { key: "detenido", macro: "En proceso · detenido", state: "Detenido", label: "Detenidos", note: "algún lote parado · requieren atención" },
  { key: "por-empacar", macro: "Por empacar", state: "Por empacar", label: "Por empacar", note: "lotes terminados, falta empacar" },
  { key: "en-proceso", macro: "En proceso", state: "En proceso", label: "En proceso" },
  { key: "programado", macro: "Programado", state: "Programado", label: "Programados", note: "esperan iniciar" },
  { key: "empacado", macro: "Empacado", state: "Empacado", label: "Empacados", note: "más recientes primero", ranged: true },
];

const ms = (value) => {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

// Fecha del último empaque del pedido (el mismo dato de stepperDates).
export const lastPackedAt = (group) => maxDate(group.lots.map((l) => l.packedAt));

// Cuándo se detuvo el lote parado que lleva más tiempo (para «Detenidos»).
const stoppedSince = (group) => minDate(group.stopped.map((l) => l.batch.stoppedAt || l.batch.updatedAt));

// Cuándo terminó el último lote (para «Por empacar»).
const lastCompletedAt = (group) => maxDate(group.lots.map((l) => l.batch.completedAt || l.batch.updatedAt));

// Valor por el que se ordena cada grupo (ascendente, menos «Empacado»).
const SORT_KEY = {
  "En proceso · detenido": (g) => ms(stoppedSince(g)),
  "Por empacar": (g) => ms(lastCompletedAt(g)),
  "En proceso": (g) => ms(g.arrivedAt),
  Programado: (g) => ms(g.arrivedAt),
  Empacado: (g) => ms(lastPackedAt(g)),
};

// ¿El pedido se ve con el rango de fechas? Solo «Empacado» se filtra.
export function inMfgRange(group, mfgGroup, range) {
  if (!mfgGroup.ranged || !range?.from || !range?.to) return true;
  const at = ms(lastPackedAt(group));
  return !at || (at >= range.from.getTime() && at <= range.to.getTime());
}

// Pedidos por grupo, en el orden de MFG_GROUPS y con el orden de cada uno.
// Devuelve [{ ...grupo, items }], incluidos los vacíos.
export function groupMfgOrders(groups, range) {
  const byMacro = new Map(MFG_GROUPS.map((g) => [g.macro, []]));
  for (const g of groups) byMacro.get(g.macro)?.push(g);
  return MFG_GROUPS.map((mfg) => {
    const key = SORT_KEY[mfg.macro];
    const items = byMacro.get(mfg.macro).filter((g) => inMfgRange(g, mfg, range));
    items.sort((a, b) => (mfg.macro === "Empacado" ? key(b) - key(a) : key(a) - key(b)));
    return { ...mfg, items };
  });
}

/*
  Nota de tiempo de la fila de un pedido: { text, tone, bold } (tone: «rose»,
  «amber» o null = gris).
    Detenidos: «detenido hace 2 h» · Por empacar: «listo ayer 17:40» (ámbar
    pasadas 24 h) · En proceso y Programados: «llegó hoy 08:20» (ámbar pasados
    2 días) · Empacados: «empacado 11 oct».
*/
export function mfgTimeNote(group, now = new Date()) {
  if (group.macro === "En proceso · detenido") {
    const text = sinceText(stoppedSince(group), now);
    return text ? { text: `detenido ${text}`, tone: "rose", bold: true } : null;
  }
  if (group.macro === "Por empacar") {
    const at = lastCompletedAt(group);
    const when = fmtWhen(at, now);
    if (!when) return null;
    const late = now - at > 86400000;
    return { text: `listo ${when.text}`, tone: late ? "amber" : null, bold: late };
  }
  if (group.macro === "Empacado") {
    const at = lastPackedAt(group);
    return at ? { text: `empacado ${fmtDate(at)}`, tone: null, bold: false } : null;
  }
  const when = fmtWhen(group.arrivedAt, now);
  if (!when) return null;
  const late = when.days > 2;
  return { text: `llegó ${when.text}`, tone: late ? "amber" : null, bold: late };
}
