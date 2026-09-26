import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useUrlState } from "../../hooks/useUrlState";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import BulkBar from "../../components/ui/BulkBar";
import ColorSwatch from "../../components/ui/ColorSwatch";
import InlineResolveBox from "../../components/ui/InlineResolveBox";
import RadioCardList from "../../components/ui/RadioCardList";
import DisclosureChevron from "../../components/ui/DisclosureChevron";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { toastUndo } from "../../lib/toastUndo";
import { fmtNumber, fmtDate } from "../../lib/format";
import { IconOrders } from "../../lib/icons";
import {
  buildStockMap,
  stockOptionsFor,
  suggestWarehouse,
  lineParts,
  inventoryMacroStatus,
  progressLabel,
  lineCounts,
  fullyVerifiableLines,
  unprocessedCount,
  packableLines,
  hasPackedLines,
  lastStatusAt,
} from "../../lib/inventoryOrders";

/*
  Inventario > Pedidos. Los pedidos llegan solos desde Pedidos; cada línea
  trae su bodega sugerida (calculada aquí con /inventory). Verificar, empacar,
  enviar a fabricación y resolver faltantes son directos, con «Deshacer».
*/

const DISPATCHED_DAYS = 30;
const PRODUCTS_GRID = "minmax(0,1fr) 44px 138px 124px 178px 18px";

const COUNT_LABELS = [
  ["empacado", "empacado", "empacados"],
  ["verificado", "verificado", "verificados"],
  ["porVerificar", "por verificar", "por verificar"],
  ["parcial", "parcial", "parciales"],
  ["sinExistencia", "sin existencia", "sin existencia"],
  ["enFabricacion", "en fabricación", "en fabricación"],
];

const productName = (item) => `${item.product}${item.color ? ` — ${item.color}` : ""}`;

function runAll(calls) {
  return calls.reduce((p, fn) => p.then(fn), Promise.resolve());
}

// Control segmentado Por preparar / Despachados.
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex gap-[3px] rounded-[10px] border border-line bg-surface-2 p-[3px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`h-7 whitespace-nowrap rounded-[7px] px-2.5 text-[12px] font-semibold tabular-nums transition ${
            value === o.key ? "bg-surface text-ink shadow-[0_1px_2px_rgb(22_32_58/0.08)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OrderListRow({ order, selected, checked, onToggle, onSelect, showCheckbox }) {
  return (
    <div className={`grid grid-cols-[30px_5px_1fr] border-b border-line-soft transition ${selected ? "bg-select-bg" : "hover:bg-surface-2"}`}>
      <div className="flex items-start pl-[11px] pt-[14px]">
        {showCheckbox ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Seleccionar ${order.orderNumber}`}
            className="h-4 w-4 cursor-pointer rounded-[4px] accent-primary"
          />
        ) : null}
      </div>
      <span className={selected ? "bg-select-bar" : ""} />
      <button type="button" onClick={onSelect} aria-current={selected || undefined} className="min-w-0 px-3.5 py-3 text-left">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          <StatusPill status={inventoryMacroStatus(order)} domain="pedido-inventario" variant="dot" />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{progressLabel(order)}</span>
        </div>
      </button>
    </div>
  );
}

// Texto de la columna Existencia para una parte de la línea.
function existenceText(item, part) {
  if (part.status === "Por verificar") return `${part.suggestion.warehouse} · ${fmtNumber(part.suggestion.available)} disp.`;
  if (part.status === "Existencia parcial") return `${part.suggestion.warehouse} · solo ${fmtNumber(part.suggestion.available)}`;
  if (part.status === "Sin existencia") return "Sin existencia";
  if (part.part === "manufacture") return "—";
  if (item.verifiedWarehouse && (part.status === "Verificado" || part.status === "Empacado")) {
    return `${item.verifiedWarehouse} · tomado`;
  }
  if (item.packedLocation === "Fabricación") return "Fabricación";
  return "—";
}

function batchText(item) {
  const batch = item.manufacturingBatch;
  if (!batch?.batchNumber) return "Lote —";
  return `Lote ${batch.batchNumber} · ${batch.status || "—"}`;
}

function OrderDetail({ order, stockMap, busy, openBox, setOpenBox, actions }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [boxWarehouse, setBoxWarehouse] = useState("");
  const macro = inventoryMacroStatus(order);
  const counts = lineCounts(order, stockMap);
  const verifiable = fullyVerifiableLines(order, stockMap);
  const packable = packableLines(order);
  const items = order.items || [];

  const countParts = COUNT_LABELS.filter(([k]) => counts[k] > 0).map(([k, one, many]) => `${counts[k]} ${counts[k] === 1 ? one : many}`);

  function toggleExpanded(index) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function openVerifyBox(index, suggestion) {
    setBoxWarehouse(suggestion.warehouse);
    setOpenBox({ orderId: order._id, index, kind: "verify" });
  }

  function renderAction(item, index, part) {
    const stop = (fn) => (e) => {
      e.stopPropagation();
      fn();
    };
    switch (part.status) {
      case "Por verificar":
        return (
          <Button variant="soft" size="row" disabled={busy} onClick={stop(() => openVerifyBox(index, part.suggestion))}>
            Verificar
          </Button>
        );
      case "Verificado":
        return (
          <Button variant="pack" size="row" disabled={busy} onClick={stop(() => actions.pack(order, index))}>
            Empacar
          </Button>
        );
      case "Empacado":
        return <span className="text-[11.5px] text-muted">Esperando motorista</span>;
      case "Existencia parcial":
        return (
          <Button variant="start" size="row" disabled={busy} onClick={stop(() => setOpenBox({ orderId: order._id, index, kind: "resolve" }))}>
            Resolver faltante
          </Button>
        );
      case "Sin existencia":
        return (
          <Button variant="secondary" size="row" disabled={busy} onClick={stop(() => actions.sendToManufacturing(order, index))}>
            Enviar a fabricación
          </Button>
        );
      case "En fabricación":
        return <span className="truncate text-[11.5px] tabular-nums text-muted">{batchText(item)}</span>;
      default:
        return null;
    }
  }

  function renderBox(item, index) {
    if (openBox?.orderId !== order._id || openBox.index !== index) return null;
    const options = stockOptionsFor(item, stockMap);
    if (openBox.kind === "verify") {
      return (
        <InlineResolveBox className="mx-4 mb-3">
          <RadioCardList
            name={`verify-${order._id}-${index}`}
            value={boxWarehouse}
            onChange={setBoxWarehouse}
            options={options.map((o) => ({
              value: o.warehouse,
              title: `${o.warehouse} · ${fmtNumber(o.stock)} disponibles`,
              disabled: o.stock < item.quantity,
              detail: o.stock < item.quantity ? `No alcanza para ${fmtNumber(item.quantity)}` : undefined,
            }))}
          />
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <Button variant="secondary" size="row" onClick={() => setOpenBox(null)}>
              Cancelar
            </Button>
            <Button size="row" disabled={busy || !boxWarehouse} onClick={() => actions.verify(order, index, boxWarehouse)}>
              Verificar en {boxWarehouse || "—"}
            </Button>
          </div>
        </InlineResolveBox>
      );
    }
    const s = suggestWarehouse(item, stockMap);
    const rest = item.quantity - s.available;
    return (
      <InlineResolveBox className="mx-4 mb-3">
        <p className="text-[12.5px] text-ink">
          Solo hay {fmtNumber(s.available)} en {s.warehouse} y ninguna otra tiene más.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="row" disabled={busy} onClick={() => actions.sendToManufacturing(order, index)}>
            Fabricar las {fmtNumber(item.quantity)}
          </Button>
          <Button size="row" disabled={busy} onClick={() => actions.split(order, index, s.warehouse, s.available)}>
            Tomar {fmtNumber(s.available)} y fabricar {fmtNumber(rest)}
          </Button>
        </div>
      </InlineResolveBox>
    );
  }

  function renderExpanded(item) {
    if (item.sentToManufacturing && item.manufacturingBatch) {
      const b = item.manufacturingBatch;
      return (
        <p className="t-aux tabular-nums">
          Lote {b.batchNumber || "—"} · meta {b.targetQuantity != null ? fmtNumber(b.targetQuantity) : "—"} · producido{" "}
          {b.producedQuantity != null ? fmtNumber(b.producedQuantity) : "—"} · {b.status || "—"}
        </p>
      );
    }
    const options = stockOptionsFor(item, stockMap);
    if (!options.length) return <p className="t-aux">Ninguna bodega tiene existencia de este producto.</p>;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <span key={o.warehouse} className="t-aux tabular-nums">
            {o.warehouse} · <span className="font-semibold text-ink-2">{fmtNumber(o.stock)}</span> disponibles
          </span>
        ))}
      </div>
    );
  }

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{order.orderNumber}</h2>
            <StatusPill status={macro} domain="pedido-inventario" size="lg" />
            <span className="text-[12.5px] text-muted">
              {order.customer?.name || "—"}
              {order.sentToInventoryAt ? ` · llegó solo el ${fmtDate(order.sentToInventoryAt)}` : ""}
            </span>
          </div>
          {packable.length > 0 ? (
            <Button size="detail" disabled={busy} onClick={() => actions.packVerified(order, packable)}>
              Empacar verificados · {packable.length}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[12px] tabular-nums text-muted">
          {[`${items.length} ${items.length === 1 ? "producto" : "productos"}`, ...countParts].join(" · ")}
        </p>

        {verifiable.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line-soft bg-primary-soft px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-primary-soft-text">
                {verifiable.length} {verifiable.length === 1 ? "producto tiene" : "productos tienen"} existencia completa en una bodega
              </p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                {verifiable.map((l) => `${l.item.product} → ${l.warehouse}`).join(" · ")}
              </p>
            </div>
            <Button size="row" disabled={busy} onClick={() => actions.verifyLines([{ order, lines: verifiable }])}>
              Verificar todo · {verifiable.length}
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[12px] border border-line">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid h-8 items-center border-b border-line-soft bg-surface-2" style={{ gridTemplateColumns: PRODUCTS_GRID }}>
                <span className="t-label pl-4">Producto</span>
                <span className="t-label text-right">Cant.</span>
                <span className="t-label pl-3">Existencia</span>
                <span className="t-label">Estado</span>
                <span className="t-label">Acción</span>
                <span />
              </div>
              {items.length === 0 ? <EmptyState title="Este pedido no tiene productos." /> : null}
              {items.map((item, index) => {
                const parts = lineParts(item, stockMap);
                const open = expanded.has(index);
                return (
                  <div key={index} className="border-b border-line-soft last:border-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpanded(index)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleExpanded(index)}
                      className="cursor-pointer transition hover:bg-surface-2"
                    >
                      {parts.map((part, pi) => (
                        <div key={part.part} className="grid min-h-[44px] items-center py-1.5" style={{ gridTemplateColumns: PRODUCTS_GRID }}>
                          <span className="flex min-w-0 items-center gap-2 pl-4">
                            {pi === 0 ? (
                              <>
                                <ColorSwatch color={item.color} />
                                <span className="truncate text-[13.5px] font-semibold text-ink">{productName(item)}</span>
                              </>
                            ) : (
                              <span className="t-aux pl-[19px]">↳ a fabricar</span>
                            )}
                          </span>
                          <span className="text-right text-[13px] tabular-nums text-ink">{fmtNumber(part.qty)}</span>
                          <span className="truncate pl-3 text-[12.5px] tabular-nums text-ink-2">{existenceText(item, part)}</span>
                          <span>
                            <StatusPill status={part.status} domain="linea-inventario" />
                          </span>
                          <span className="flex min-w-0 items-center">{renderAction(item, index, part)}</span>
                          {pi === 0 ? <DisclosureChevron open={open} /> : <span />}
                        </div>
                      ))}
                    </div>
                    {open ? <div className="bg-surface-2 px-4 py-2.5 pl-[35px]">{renderExpanded(item)}</div> : null}
                    {renderBox(item, index)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {hasPackedLines(order) ? (
          <div className="rounded-[12px] border border-line-soft bg-surface-2 px-4 py-3">
            <p className="t-label">Después de empacar, la fila sigue al pedido en Logística</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {[
                ["Empacado", "Esperando motorista"],
                ["Empacado", "Ruta N · motorista"],
                ["En Tránsito", "Recogido HH:MM"],
                ["Entregado", "Entregado"],
              ].map(([status, caption], i) => (
                <Fragment key={caption}>
                  {i > 0 ? <span className="text-faint" aria-hidden="true">→</span> : null}
                  <span className="flex items-center gap-1.5">
                    <StatusPill status={status} domain="pedido" />
                    <span className="text-[11.5px] text-muted">{caption}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </DetailPanel>
  );
}

function PedidosInventario({ orders, ordersLoading, ordersError, refetchOrders, finishedItems, refetchInventory }) {
  const [selectedId, setSelectedId] = useUrlState("id");
  const [segment, setSegment] = useState("preparar");
  const [checked, setChecked] = useState(() => new Set());
  const [openBox, setOpenBox] = useState(null);
  const [busy, setBusy] = useState(false);
  // Inicio de la ventana de «Despachados» (últimos 30 días), fijado al montar.
  const [dispatchedSince] = useState(() => Date.now() - DISPATCHED_DAYS * 86400000);

  const stockMap = useMemo(() => buildStockMap(finishedItems), [finishedItems]);

  const toPrepare = useMemo(() => orders.filter((o) => o.status !== "En Tránsito" && o.status !== "Entregado"), [orders]);
  const dispatched = useMemo(
    () =>
      orders.filter(
        (o) => (o.status === "En Tránsito" || o.status === "Entregado") && new Date(lastStatusAt(o)).getTime() >= dispatchedSince,
      ),
    [orders, dispatchedSince],
  );

  const list = segment === "preparar" ? toPrepare : dispatched;
  const selected = useMemo(() => orders.find((o) => o._id === selectedId) || null, [orders, selectedId]);

  // Pedidos marcados (solo los que siguen en Por preparar).
  const checkedOrders = useMemo(() => toPrepare.filter((o) => checked.has(o._id)), [toPrepare, checked]);
  const bulkSummary = useMemo(() => {
    let verifiable = 0;
    let pending = 0;
    for (const o of checkedOrders) {
      const v = fullyVerifiableLines(o, stockMap).length;
      verifiable += v;
      pending += unprocessedCount(o) - v;
    }
    return { verifiable, pending, total: verifiable + pending };
  }, [checkedOrders, stockMap]);

  function toggleChecked(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function refresh() {
    refetchOrders();
    refetchInventory();
  }

  // Ejecuta una acción directa con «Deshacer»: `run` hace el cambio y `undo`
  // lo revierte (ambos llaman a la API); después se recargan los datos.
  async function act(run, message, undo) {
    setBusy(true);
    try {
      await run();
      setOpenBox(null);
      toastUndo(message, async () => {
        try {
          await undo();
          toast.success("Cambio deshecho");
        } catch (err) {
          toast.error(err.message);
        } finally {
          refresh();
        }
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const base = (order, index) => `/orders/${order._id}/items/${index}`;

  const actions = {
    verify: (order, index, warehouse) =>
      act(
        () => api.patch(`${base(order, index)}/verify`, { warehouse }),
        `${order.items[index].product} verificado en ${warehouse}`,
        () => api.patch(`${base(order, index)}/unverify`),
      ),
    // groups = [{ order, lines: [{ index, warehouse }] }]
    verifyLines: (groups) => {
      const n = groups.reduce((s, g) => s + g.lines.length, 0);
      return act(
        () =>
          api.post("/orders/verify-bulk", {
            orders: groups.map((g) => ({ id: g.order._id, items: g.lines.map((l) => ({ index: l.index, warehouse: l.warehouse })) })),
          }),
        `${n} ${n === 1 ? "producto verificado" : "productos verificados"}`,
        () => runAll(groups.flatMap((g) => g.lines.map((l) => () => api.patch(`${base(g.order, l.index)}/unverify`)))),
      );
    },
    pack: (order, index) =>
      act(
        () => api.patch(`${base(order, index)}/pack`),
        `${order.items[index].product} empacado`,
        () => api.patch(`${base(order, index)}/unpack`),
      ),
    packVerified: (order, lines) =>
      act(
        () => runAll(lines.map((l) => () => api.patch(`${base(order, l.index)}/pack`))),
        `${lines.length} ${lines.length === 1 ? "producto empacado" : "productos empacados"}`,
        () => runAll(lines.map((l) => () => api.patch(`${base(order, l.index)}/unpack`))),
      ),
    sendToManufacturing: (order, index) =>
      act(
        () => api.patch(`${base(order, index)}/send-manufacturing`),
        `${order.items[index].product} enviado a fabricación`,
        () => api.del(`${base(order, index)}/send-manufacturing`),
      ),
    split: (order, index, warehouse, quantity) =>
      act(
        () => api.patch(`${base(order, index)}/split-partial`, { warehouse, quantity }),
        `Tomados ${fmtNumber(quantity)} de ${warehouse}; ${fmtNumber(order.items[index].quantity - quantity)} a fabricación`,
        () => api.del(`${base(order, index)}/split-partial`),
      ),
  };

  function verifySelected() {
    const groups = checkedOrders
      .map((order) => ({ order, lines: fullyVerifiableLines(order, stockMap) }))
      .filter((g) => g.lines.length > 0);
    if (!groups.length) {
      toast.error("Ningún producto seleccionado tiene existencia completa");
      return;
    }
    actions.verifyLines(groups);
    setChecked(new Set());
  }

  return (
    <MasterDetail listWidth={392}>
      <ListPanel
        header={
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Segmented
              value={segment}
              onChange={(key) => {
                setSegment(key);
                setChecked(new Set());
              }}
              options={[
                { key: "preparar", label: `Por preparar · ${fmtNumber(toPrepare.length)}` },
                { key: "despachados", label: `Despachados · ${fmtNumber(dispatched.length)}` },
              ]}
            />
            <span className="text-[11px] text-muted">salen al recogerse todo</span>
          </div>
        }
      >
        <BulkBar
          count={segment === "preparar" ? checkedOrders.length : 0}
          onClear={() => setChecked(new Set())}
          note={`${fmtNumber(bulkSummary.verifiable)} de ${fmtNumber(bulkSummary.total)} productos tienen existencia completa y se verificarán · ${fmtNumber(bulkSummary.pending)} quedarán pendientes por revisar`}
        >
          <Button size="row" disabled={busy || bulkSummary.verifiable === 0} onClick={verifySelected}>
            Verificar seleccionados
          </Button>
        </BulkBar>
        {ordersLoading && !orders.length ? (
          <EmptyState title="Cargando pedidos…" />
        ) : ordersError ? (
          <EmptyState title="No se pudieron cargar los pedidos" description={ordersError} />
        ) : list.length === 0 ? (
          <EmptyState title={segment === "preparar" ? "No hay pedidos por preparar." : "No hay pedidos despachados en los últimos 30 días."} />
        ) : (
          list.map((o) => (
            <OrderListRow
              key={o._id}
              order={o}
              selected={o._id === selectedId}
              checked={checked.has(o._id)}
              showCheckbox={segment === "preparar"}
              onToggle={() => toggleChecked(o._id)}
              onSelect={() => {
                setSelectedId(o._id);
                setOpenBox(null);
              }}
            />
          ))
        )}
      </ListPanel>

      {selected ? (
        <OrderDetail
          key={selected._id}
          order={selected}
          stockMap={stockMap}
          busy={busy}
          openBox={openBox}
          setOpenBox={setOpenBox}
          actions={actions}
        />
      ) : (
        <DetailPanel>
          <EmptyState
            icon={IconOrders}
            title={selectedId && !ordersLoading ? "Este pedido ya no existe" : "Selecciona un pedido"}
            description="Verifica sus productos, resuelve faltantes y empácalos desde aquí."
          />
        </DetailPanel>
      )}
    </MasterDetail>
  );
}

export default PedidosInventario;
