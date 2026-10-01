import { useState } from "react";
import Modal from "../ui/Modal";
import RadioCardList from "../ui/RadioCardList";
import ColorSwatch from "../ui/ColorSwatch";
import { buttonClass } from "../../lib/buttonStyles";
import { fmtNumber } from "../../lib/format";
import { productLabel, pendingUnits } from "../../lib/batchFlow";

// Existencia actual del artículo del lote (mismo producto y color) por bodega.
// Solo producto terminado real: los artículos con batchNumber son reportes
// antiguos de la app Movil, no stock.
function stockByWarehouse(batch, finishedItems) {
  const map = new Map();
  for (const i of finishedItems) {
    if (i.batchNumber || i.name !== batch.product || (i.color || "") !== (batch.color || "")) continue;
    map.set(i.location, (map.get(i.location) || 0) + (Number(i.stock) || 0));
  }
  return map;
}

// Bodega preseleccionada: la que ya tiene el artículo (si hay varias, la de más stock).
function suggestedWarehouse(warehouses, stock) {
  let best = null;
  for (const w of warehouses) {
    if (!stock.has(w)) continue;
    if (best == null || stock.get(w) > stock.get(best)) best = w;
  }
  return best ?? warehouses[0] ?? "";
}

/*
  Modal «Enviar a bodega»: elige la bodega de destino de un lote completado.
  Se monta solo mientras está abierto (así la preselección se calcula al abrir).
*/
function SendToWarehouseModal({ batch, warehouses, finishedItems, busy, onClose, onConfirm }) {
  const stock = stockByWarehouse(batch, finishedItems);
  const [warehouse, setWarehouse] = useState(() => suggestedWarehouse(warehouses, stock));
  const units = pendingUnits(batch);

  const options = warehouses.map((w) => {
    const has = stock.has(w);
    return {
      value: w,
      title: w,
      detail: has
        ? `Ya tiene ${fmtNumber(stock.get(w))} · quedarían ${fmtNumber(stock.get(w) + units)} unidades`
        : "Sin este artículo · entraría como nuevo",
      tag: has ? "Ya está aquí" : undefined,
    };
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Enviar a bodega"
      subtitle={
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <ColorSwatch color={batch.color} size={12} />
          {productLabel(batch)} · {batch.batchNumber} · {fmtNumber(units)} unidades
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !warehouse}
            onClick={() => onConfirm(warehouse)}
            className={buttonClass("primary", "modal")}
          >
            Enviar a {warehouse || "—"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="t-label">Bodega de destino</p>
        {options.length ? (
          <RadioCardList name="send-warehouse" value={warehouse} onChange={setWarehouse} options={options} />
        ) : (
          <p className="t-aux">No hay bodegas configuradas. Agrégalas en Configuración → Bodegas.</p>
        )}
        <p className="text-[11.5px] text-muted">
          Las unidades aparecen de una vez en <strong className="font-semibold text-ink-2">Inventario → Producto terminado</strong>, en la
          bodega elegida. El lote queda aquí marcado «En bodega».
        </p>
      </div>
    </Modal>
  );
}

export default SendToWarehouseModal;
