import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import DataTable from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ColorSwatch from "../../components/ui/ColorSwatch";
import { SectionCard } from "../../components/ui/SectionCard";
import { FilterSelect } from "../../components/ui/Field";
import { filterSelectClass } from "../../components/inventory/InventoryItemsCard";
import { buttonClass } from "../../lib/buttonStyles";
import { fmtNumber, fmtDateYear } from "../../lib/format";
import { batchStart } from "../../lib/batchFlow";
import {
  getManufacturingCounts,
  manufacturingMacroStatus,
  manufacturingProgressSegments,
  manufacturingProgressCaption,
  MANUFACTURING_STATUS_LABELS,
  getPedidoBatchCounts,
  pedidoBatchMacroStatus,
  pedidoBatchProgressSegments,
  pedidoBatchProgressCaption,
  PEDIDO_BATCH_STATUS_LABELS,
} from "../../lib/manufacturingProgress";

const MANUFACTURING_STATUS_FILTERS = ["enCola", "enFabricacion", "parcial"];
const PEDIDO_BATCH_STATUS_FILTERS = ["programado", "enProceso", "completado", "detenido", "parcial"];

// Barra segmentada + texto corto (progreso de un pedido).
function SegmentBar({ segments, caption, emptyCaption }) {
  return (
    <div className="min-w-[180px] py-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-line-soft">
        {segments.map((seg) => (
          <div key={seg.key} className={seg.colorClass} style={{ width: `${seg.pct}%` }} title={`${seg.count} ${seg.label}`} />
        ))}
      </div>
      <p className="t-aux mt-1 leading-tight">{caption || emptyCaption}</p>
    </div>
  );
}

// Filtros de estado + «Solo con pendientes» + «Limpiar filtros».
function Filters({ status, setStatus, options, onlyPending, setOnlyPending }) {
  const active = Boolean(status || onlyPending);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)} className={filterSelectClass} options={options} />
      <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
        <input
          type="checkbox"
          checked={onlyPending}
          onChange={(e) => setOnlyPending(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded-[4px] accent-primary"
        />
        Solo con pendientes
      </label>
      {active ? (
        <Button
          variant="soft"
          size="row"
          onClick={() => {
            setStatus("");
            setOnlyPending(false);
          }}
        >
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}

const productName = (item) => `${item.product}${item.color ? ` · ${item.color}` : ""}`;

/*
  Fabricación > Pedidos: «Por fabricar» (líneas de pedidos enviadas a
  fabricación) y «Fabricación de pedidos» (lotes de categoría «Pedido»),
  una debajo de otra. Se rediseña en la Fase 6; aquí solo cambia el estilo.
*/
function PedidosFabricacion({ pedidoBatches, batchesLoading, batchesError, orders, ordersLoading, ordersError, refetchAll, onEditBatch, onDeleteBatch }) {
  const { confirm, confirmProps } = useConfirm();
  const [manufacturingInfoOrderId, setManufacturingInfoOrderId] = useState(null);
  const [manufacturingStatus, setManufacturingStatus] = useState("");
  const [manufacturingOnlyPending, setManufacturingOnlyPending] = useState(false);
  const [pedidoBatchInfoOrderId, setPedidoBatchInfoOrderId] = useState(null);
  const [pedidoStatus, setPedidoStatus] = useState("");
  const [pedidoOnlyPending, setPedidoOnlyPending] = useState(false);

  // Líneas enviadas a fabricación, agrupadas por pedido (más reciente primero).
  const manufacturingGroups = useMemo(() => {
    const groups = [];
    orders.forEach((o) => {
      const lines = [];
      (o.items || []).forEach((item, index) => {
        if (item.sentToManufacturing) lines.push({ item, index });
      });
      if (lines.length) groups.push({ order: o, lines });
    });
    const latest = (group) => Math.max(...group.lines.map((l) => new Date(l.item.sentToManufacturingAt).getTime()));
    return groups.sort((a, b) => latest(b) - latest(a));
  }, [orders]);

  const manufacturingInfoGroup = manufacturingGroups.find((g) => g.order._id === manufacturingInfoOrderId) || null;

  const filteredManufacturingGroups = useMemo(
    () =>
      manufacturingGroups.filter((g) => {
        if (manufacturingStatus && manufacturingMacroStatus(g) !== manufacturingStatus) return false;
        if (manufacturingOnlyPending && getManufacturingCounts(g).enCola === 0) return false;
        return true;
      }),
    [manufacturingGroups, manufacturingStatus, manufacturingOnlyPending],
  );

  // Pedido y línea de cada lote «Pedido» (manufacturingBatch puede venir poblado o como id).
  const pedidoLineByBatchId = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      (o.items || []).forEach((item, index) => {
        const batchId = item.manufacturingBatch?._id || item.manufacturingBatch;
        if (batchId) map.set(String(batchId), { order: o, item, index });
      });
    });
    return map;
  }, [orders]);

  // Lotes «Pedido» agrupados por pedido; los sueltos van en «Sin pedido vinculado».
  const pedidoGroups = useMemo(() => {
    const map = new Map();
    const unlinked = [];
    pedidoBatches.forEach((batch) => {
      const pedidoLine = pedidoLineByBatchId.get(String(batch._id));
      if (!pedidoLine) {
        unlinked.push({ batch, item: null, index: null });
        return;
      }
      const { order, item, index } = pedidoLine;
      if (!map.has(order._id)) map.set(order._id, { order, batches: [] });
      map.get(order._id).batches.push({ batch, item, index });
    });
    const latest = (group) => Math.max(...group.batches.map(({ batch }) => new Date(batch.startDate || batch.createdAt).getTime()));
    const groups = Array.from(map.values()).sort((a, b) => latest(b) - latest(a));
    if (unlinked.length) groups.push({ order: { _id: "__unlinked__", orderNumber: "Sin pedido vinculado" }, batches: unlinked });
    return groups;
  }, [pedidoBatches, pedidoLineByBatchId]);

  const pedidoBatchInfoGroup = pedidoGroups.find((g) => g.order._id === pedidoBatchInfoOrderId) || null;

  const filteredPedidoGroups = useMemo(
    () =>
      pedidoGroups.filter((g) => {
        if (pedidoStatus && pedidoBatchMacroStatus(g) !== pedidoStatus) return false;
        if (pedidoOnlyPending && getPedidoBatchCounts(g).completado === g.batches.length) return false;
        return true;
      }),
    [pedidoGroups, pedidoStatus, pedidoOnlyPending],
  );

  async function handleManufacture(row) {
    const ok = await confirm(
      `¿Fabricar ${row.item.quantity} ${productName(row.item)} para el pedido ${row.order.orderNumber}? Se creará un lote de fabricación.`,
      { confirmLabel: "Fabricar" },
    );
    if (!ok) return;
    try {
      const res = await api.patch(`/orders/${row.order._id}/items/${row.index}/manufacture`);
      toast.success(res?.batchNumber ? `Lote ${res.batchNumber} creado` : "Lote creado");
      refetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handlePackManufactured(pedidoLine) {
    if (!pedidoLine) return;
    const { order, item, index } = pedidoLine;
    if (!(await confirm(`¿Marcar ${item.product} como empacado? Quedará listo para que Logística lo recoja en Fabricación.`, { confirmLabel: "Empacar" }))) return;
    try {
      await api.patch(`/orders/${order._id}/items/${index}/pack-manufactured`);
      toast.success(`${item.product} empacado`);
      refetchAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleRemoveManufacturingLine(row) {
    const msg = row.item.manufacturingBatch
      ? `¿Quitar ${row.item.product} de Fabricación? Su lote ${row.item.manufacturingBatch.batchNumber || ""} se elimina si sigue Programado.`
      : `¿Quitar ${row.item.product} de Fabricación? Podrá volver a solicitarse desde Inventario.`;
    if (!(await confirm(msg, { danger: true }))) return;
    try {
      await api.del(`/orders/${row.order._id}/items/${row.index}/send-manufacturing`);
      toast.success(`${row.item.product} quitado de Fabricación`);
      refetchAll();
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    }
  }

  const manufacturingColumns = [
    { key: "order", label: "Pedido", render: ({ order }) => <span className="t-row-name tabular-nums">{order.orderNumber}</span> },
    { key: "customer", label: "Cliente", render: ({ order }) => order.customer?.name || "—" },
    { key: "count", label: "Productos", align: "right", render: ({ lines }) => fmtNumber(lines.length) },
    {
      key: "progress",
      label: "Proceso",
      render: (g) => <SegmentBar segments={manufacturingProgressSegments(g)} caption={manufacturingProgressCaption(g)} emptyCaption="Sin productos" />,
    },
    {
      key: "sent",
      label: "Enviado",
      render: ({ lines }) =>
        fmtDateYear(lines.reduce((latest, l) => (new Date(l.item.sentToManufacturingAt) > new Date(latest) ? l.item.sentToManufacturingAt : latest), lines[0].item.sentToManufacturingAt)),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: ({ order }) => (
        <Button variant="secondary" size="row" onClick={() => setManufacturingInfoOrderId(order._id)}>
          Ver
        </Button>
      ),
    },
  ];

  const pedidoColumns = [
    { key: "order", label: "Pedido", render: ({ order }) => <span className="t-row-name tabular-nums">{order.orderNumber}</span> },
    { key: "customer", label: "Cliente", render: ({ order }) => order.customer?.name || "—" },
    { key: "count", label: "Lotes", align: "right", render: ({ batches }) => fmtNumber(batches.length) },
    {
      key: "progress",
      label: "Proceso",
      render: (g) => <SegmentBar segments={pedidoBatchProgressSegments(g)} caption={pedidoBatchProgressCaption(g)} emptyCaption="Sin lotes" />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: ({ order }) => (
        <Button variant="secondary" size="row" onClick={() => setPedidoBatchInfoOrderId(order._id)}>
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <SectionCard title="Por fabricar">
        <Filters
          status={manufacturingStatus}
          setStatus={setManufacturingStatus}
          onlyPending={manufacturingOnlyPending}
          setOnlyPending={setManufacturingOnlyPending}
          options={[{ value: "", label: "Estado: Todos" }, ...MANUFACTURING_STATUS_FILTERS.map((key) => ({ value: key, label: MANUFACTURING_STATUS_LABELS[key] }))]}
        />
        <div className="-mx-5 border-t border-line-soft">
          {ordersLoading && !orders.length ? (
            <EmptyState title="Cargando pedidos…" />
          ) : ordersError ? (
            <EmptyState title="No se pudieron cargar los pedidos" description={ordersError} />
          ) : (
            <DataTable
              columns={manufacturingColumns}
              rows={filteredManufacturingGroups}
              rowKey={(g) => g.order._id}
              empty={manufacturingGroups.length ? "Ningún pedido coincide con los filtros." : "Aún no hay pedidos enviados a fabricación."}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard title="Fabricación de pedidos">
        <Filters
          status={pedidoStatus}
          setStatus={setPedidoStatus}
          onlyPending={pedidoOnlyPending}
          setOnlyPending={setPedidoOnlyPending}
          options={[{ value: "", label: "Estado: Todos" }, ...PEDIDO_BATCH_STATUS_FILTERS.map((key) => ({ value: key, label: PEDIDO_BATCH_STATUS_LABELS[key] }))]}
        />
        <div className="-mx-5 border-t border-line-soft">
          {batchesLoading && !pedidoBatches.length ? (
            <EmptyState title="Cargando lotes…" />
          ) : batchesError ? (
            <EmptyState title="No se pudieron cargar los lotes" description={batchesError} />
          ) : (
            <DataTable
              columns={pedidoColumns}
              rows={filteredPedidoGroups}
              rowKey={(g) => g.order._id}
              empty={pedidoGroups.length ? "Ningún pedido coincide con los filtros." : "No hay pedidos enviados a fabricar en el rango seleccionado."}
            />
          )}
        </div>
      </SectionCard>

      <Modal
        open={!!manufacturingInfoGroup}
        onClose={() => setManufacturingInfoOrderId(null)}
        title={`Productos enviados a fabricar · ${manufacturingInfoGroup?.order?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setManufacturingInfoOrderId(null)} className={buttonClass("secondary", "modal")}>
            Cerrar
          </button>
        }
      >
        {manufacturingInfoGroup?.lines?.length ? (
          <div className="flex flex-col gap-2">
            {manufacturingInfoGroup.lines.map(({ item, index }) => {
              const order = manufacturingInfoGroup.order;
              return (
                <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line-soft bg-surface-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <ColorSwatch color={item.color} />
                      {productName(item)}
                    </p>
                    <p className="t-aux tabular-nums">
                      {fmtNumber(item.quantity)} unidades · Enviado {fmtDateYear(item.sentToManufacturingAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.manufacturingBatch ? (
                      <StatusPill status={item.manufacturingBatch.status || "Programado"} domain="lote" />
                    ) : (
                      <Button variant="soft" size="row" onClick={() => handleManufacture({ order, item, index })}>
                        Fabricar
                      </Button>
                    )}
                    {item.manufacturingBatch?.batchNumber ? <span className="t-aux tabular-nums">{item.manufacturingBatch.batchNumber}</span> : null}
                    <ActionsLink onClick={() => handleRemoveManufacturingLine({ order, item, index })}>Eliminar</ActionsLink>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Este pedido no tiene productos enviados a fabricar." />
        )}
      </Modal>

      <Modal
        open={!!pedidoBatchInfoGroup}
        onClose={() => setPedidoBatchInfoOrderId(null)}
        title={`Lotes del pedido ${pedidoBatchInfoGroup?.order?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setPedidoBatchInfoOrderId(null)} className={buttonClass("secondary", "modal")}>
            Cerrar
          </button>
        }
      >
        {pedidoBatchInfoGroup?.batches?.length ? (
          <div className="flex flex-col gap-2">
            {pedidoBatchInfoGroup.batches.map(({ batch: b, item, index }) => {
              const pedidoLine = item ? { order: pedidoBatchInfoGroup.order, item, index } : null;
              const target = b.targetQuantity ?? pedidoLine?.item?.quantity;
              const start = batchStart(b);
              return (
                <div key={b._id} className="flex flex-col gap-2.5 rounded-[12px] border border-line-soft bg-surface-2 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold tabular-nums text-ink">{b.batchNumber}</p>
                      <p className="t-aux flex items-center gap-1.5">
                        <ColorSwatch color={b.color} />
                        {b.product} · {b.color || "—"} · {b.productionLine || "—"}
                      </p>
                    </div>
                    <StatusPill status={b.status} domain="lote" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="t-aux tabular-nums">
                      Meta {target != null ? fmtNumber(target) : "—"} · Producido {fmtNumber(b.producedQuantity)} · {start ? fmtDateYear(start.date) : "—"}
                    </p>
                    <div className="flex items-center gap-2">
                      {!pedidoLine ? (
                        <span className="t-aux">Sin pedido vinculado</span>
                      ) : pedidoLine.item.packed || pedidoLine.item.manufacturePackedAt ? (
                        <StatusPill status="Empacado" domain="lote" />
                      ) : b.status === "Completado" ? (
                        <Button variant="pack" size="row" onClick={() => handlePackManufactured(pedidoLine)}>
                          Empacar
                        </Button>
                      ) : (
                        <span className="t-aux">Editar lote para avanzar</span>
                      )}
                      <Button
                        variant="secondary"
                        size="row"
                        onClick={() => {
                          setPedidoBatchInfoOrderId(null);
                          onEditBatch({ ...b, targetQuantity: target });
                        }}
                      >
                        Editar
                      </Button>
                      <ActionsLink onClick={() => onDeleteBatch(b)}>Eliminar</ActionsLink>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Este pedido no tiene lotes." />
        )}
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

// Acción destructiva en texto rosa dentro de una fila.
function ActionsLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="h-[29px] rounded-[8px] px-2.5 text-[12.5px] font-semibold text-tone-rose-text transition hover:bg-tone-rose">
      {children}
    </button>
  );
}

export default PedidosFabricacion;
