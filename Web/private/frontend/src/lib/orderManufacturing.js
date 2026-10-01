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
  return [order.orderNumber, order.customer?.name, ...lots.map((l) => `${l.batch.batchNumber} ${l.item.product} ${l.item.color || ""}`)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
