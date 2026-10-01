import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useUrlState } from "../../hooks/useUrlState";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import { replaceById } from "../../hooks/useFetch";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import BulkBar from "../../components/ui/BulkBar";
import FilterChips from "../../components/ui/FilterChips";
import ColorSwatch from "../../components/ui/ColorSwatch";
import InlineResolveBox from "../../components/ui/InlineResolveBox";
import RadioCardList from "../../components/ui/RadioCardList";
import DisclosureChevron from "../../components/ui/DisclosureChevron";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { toastUndo } from "../../lib/toastUndo";
import { fmtNumber, fmtDate, formatBatchNumber } from "../../lib/format";
import { IconOrders } from "../../lib/icons";
import { statusTone, normalizeStatus } from "../../lib/statusDomains";
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
  isDispatched,
  routeLabel,
} from "../../lib/inventoryOrders";

/*
  Inventario > Pedidos. Los pedidos llegan solos desde Pedidos; cada línea
  trae su bodega sugerida (calculada aquí con /inventory). Verificar, empacar,
  enviar a fabricación y resolver faltantes son directos, con «Deshacer».
*/

const DISPATCHED_DAYS = 30;
// Producto · Color · Cant. · Existencia · Estado · Acción · caret.
// Producto acotado (96–130px) para que Color quede junto a él; el espacio que
// sobra se lo lleva Cant. (alineada a la derecha, junto a Existencia).
// Existencia llega a 200px para que «Bodega Central · 4,750 disp.» quepa
// completo (solo en pantallas angostas cede hasta 150px). La última columna
// (30px) deja el caret separado del borde.
const PRODUCTS_GRID = "minmax(96px,130px) 72px minmax(44px,1fr) minmax(150px,200px) 124px 178px 30px";

// [clave de lineCounts, singular, plural, estado de la píldora de la línea]
const COUNT_LABELS = [
  ["empacado", "empacado", "empacados", "Empacado"],
  ["verificado", "verificado", "verificados", "Verificado"],
  ["porVerificar", "por verificar", "por verificar", "Por verificar"],
  ["parcial", "parcial", "parciales", "Existencia parcial"],
  ["sinExistencia", "sin existencia", "sin existencia", "Sin existencia"],
  ["enFabricacion", "en fabricación", "en fabricación", "En fabricación"],
];

// Color de cada estado en la barra de avance: el mismo punto de color que
// usa su StatusPill (tono de statusDomains, dominio linea-inventario).
const TONE_DOT = {
  gray: "bg-tone-gray-dot",
  blue: "bg-tone-blue-dot",
  amber: "bg-tone-amber-dot",
  green: "bg-tone-green-dot",
  rose: "bg-tone-rose-dot",
  purple: "bg-tone-purple-dot",
  teal: "bg-tone-teal-dot",
};
const lineDot = (status) => TONE_DOT[statusTone(status, "linea-inventario")];

// «N PRODUCTOS», leyenda por estado y barra segmentada (un segmento por
// producto, agrupados por estado), como en el mockup R1.
function OrderProgress({ total, counts }) {
  const present = COUNT_LABELS.filter(([k]) => counts[k] > 0);
  const summary = present.map(([k, one, many]) => `${counts[k]} ${counts[k] === 1 ? one : many}`).join(", ");
  return (
    <div>
      <div className="mb-[7px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="t-label tabular-nums">
          {fmtNumber(total)} {total === 1 ? "producto" : "productos"}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] tabular-nums text-ink-2">
          {present.map(([k, one, many, status]) => (
            <span key={k} className="inline-flex items-center gap-[5px]">
              <span className={`h-[7px] w-[7px] shrink-0 rounded-[2px] ${lineDot(status)}`} />
              {counts[k]} {counts[k] === 1 ? one : many}
            </span>
          ))}
        </span>
      </div>
      {total > 0 ? (
        <div role="img" aria-label={`Avance del pedido: ${summary}`} className="flex h-2 gap-[3px] overflow-hidden rounded-[4px]">
          {present.flatMap(([k, , , status]) =>
            Array.from({ length: counts[k] }, (_, i) => <span key={`${k}-${i}`} className={`flex-1 ${lineDot(status)}`} />),
          )}
        </div>
      ) : null}
    </div>
  );
}


// Ejecuta las llamadas en orden y devuelve todas sus respuestas.
function runAll(calls) {
  return calls.reduce((p, fn) => p.then(async (results) => [...results, await fn()]), Promise.resolve([]));
}

// Pedidos actualizados que vienen en la respuesta de una acción de línea
// ({ order }), de verify-bulk ({ orders }) o de varias acciones (runAll).
function ordersFrom(result) {
  if (Array.isArray(result)) return result.flatMap(ordersFrom);
  if (result?.orders) return result.orders;
  return result?.order ? [result.order] : [];
}

function OrderListRow({ order, selected, checked, onToggle, onSelect, showCheckbox }) {
  return (
    <div className={`grid grid-cols-[34px_5px_1fr] border-b border-line-soft transition ${selected ? "bg-select-bg" : "hover:bg-surface-2"}`}>
      <div className="flex items-start pl-[11px] pt-[15px]">
        {showCheckbox ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Seleccionar ${order.orderNumber}`}
            className="h-3.5 w-3.5 cursor-pointer rounded-[4px] accent-primary"
          />
        ) : null}
      </div>
      <span className={selected ? "bg-select-bar" : ""} />
      <button type="button" onClick={onSelect} aria-current={selected || undefined} className="min-w-0 py-3 pl-2.5 pr-3.5 text-left">
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

// Acción de una línea «En fabricación» (mockup R1): «Lote N · estado» y
// debajo una mini barra de 4 segmentos con lo producido del lote respecto a
// su meta. El texto puede pasar a dos líneas en vez de cortarse.
function LotProgress({ batch }) {
  if (!batch?.batchNumber) return <span className="text-[11.5px] text-muted">Lote —</span>;
  const target = Number(batch.targetQuantity) || 0;
  const produced = Number(batch.producedQuantity) || 0;
  const ratio = target > 0 ? Math.min(produced / target, 1) : 0;
  return (
    <span className="flex w-full min-w-0 flex-col items-end gap-1">
      <span className="max-w-full text-right text-[11px] font-semibold leading-[1.3] tabular-nums text-tone-blue-text">
        <span className="whitespace-nowrap">Lote {formatBatchNumber(batch.batchNumber)}</span>
        {batch.status ? (
          <>
            {" "}
            <span className="whitespace-nowrap">· {normalizeStatus(batch.status)}</span>
          </>
        ) : null}
      </span>
      <span
        data-lot-progress
        role="img"
        aria-label={`Producido ${fmtNumber(produced)} de ${fmtNumber(target)}`}
        className="flex w-[110px] gap-0.5"
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-[2px] bg-line-soft">
            <span className="block h-full bg-tone-blue-dot" style={{ width: `${Math.min(Math.max(ratio * 4 - i, 0), 1) * 100}%` }} />
          </span>
        ))}
      </span>
    </span>
  );
}

function OrderDetail({ order, stockMap, busy, openBox, setOpenBox, actions }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [boxWarehouse, setBoxWarehouse] = useState("");
  const macro = inventoryMacroStatus(order);
  const counts = lineCounts(order, stockMap);
  const verifiable = fullyVerifiableLines(order, stockMap);
  const packable = packableLines(order);
  const items = order.items || [];

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
        return <span className="truncate text-[11.5px] tabular-nums text-muted">{routeLabel(order) || "Esperando motorista"}</span>;
      case "Existencia parcial":
        return (
          <Button variant="start" size="row" disabled={busy} onClick={stop(() => setOpenBox({ orderId: order._id, index, kind: "resolve" }))}>
            Resolver faltante
          </Button>
        );
      case "Sin existencia":
        return (
          <Button size="row" disabled={busy} onClick={stop(() => actions.sendToManufacturing(order, index))}>
            Enviar a fabricación
          </Button>
        );
      case "En fabricación":
        return <LotProgress batch={item.manufacturingBatch} />;
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
          Lote {formatBatchNumber(b.batchNumber) || "—"} · meta {b.targetQuantity != null ? fmtNumber(b.targetQuantity) : "—"} · producido{" "}
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
      // Reserva el espacio de la barra de scroll: si expandir una fila la hace
      // aparecer, la tabla no se angosta ni salta de lugar.
      bodyClassName="[scrollbar-gutter:stable]"
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
        <OrderProgress total={items.length} counts={counts} />

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
            {/* Suma de los mínimos de PRODUCTS_GRID (96+72+44+150+124+178+30). */}
            <div className="min-w-[694px]">
              <div className="grid h-8 items-center border-b border-line-soft bg-surface-2" style={{ gridTemplateColumns: PRODUCTS_GRID }}>
                <span className="t-label pl-4">Producto</span>
                <span className="t-label">Color</span>
                <span className="t-label text-right">Cant.</span>
                <span className="t-label pl-3">Existencia</span>
                <span className="t-label">Estado</span>
                <span className="t-label pr-3 text-right">Acción</span>
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
                                <span className="truncate text-[13.5px] font-semibold text-ink">{item.product}</span>
                              </>
                            ) : (
                              <span className="t-aux pl-[19px]">↳ a fabricar</span>
                            )}
                          </span>
                          <span className="truncate pr-3 text-[13px] text-ink-2">{pi === 0 ? item.color || "—" : ""}</span>
                          <span className="text-right text-[13px] tabular-nums text-ink">{fmtNumber(part.qty)}</span>
                          <span className="truncate px-3 text-[12.5px] tabular-nums text-ink-2">{existenceText(item, part)}</span>
                          <span>
                            <StatusPill status={part.status} domain="linea-inventario" />
                          </span>
                          <span className="flex min-w-0 items-center justify-end pr-3">{renderAction(item, index, part)}</span>
                          {pi === 0 ? <DisclosureChevron open={open} /> : <span />}
                        </div>
                      ))}
                    </div>
                    {/* Se despliega animando la altura (0fr → 1fr), al mismo ritmo que el caret. */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      inert={!open}
                      aria-hidden={!open}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="bg-surface-2 px-4 py-2.5 pl-[35px]">{renderExpanded(item)}</div>
                      </div>
                    </div>
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

function PedidosInventario({ orders, ordersLoading, ordersError, refetchOrders, mutateOrders, finishedItems, refetchInventory }) {
  const [selectedId, setSelectedId] = useUrlState("id");
  const [segment, setSegment] = useState("preparar");
  const [checked, setChecked] = useState(() => new Set());
  const [openBox, setOpenBox] = useState(null);
  const [busy, setBusy] = useState(false);
  // Inicio de la ventana de «Despachados» (últimos 30 días), fijado al montar.
  const [dispatchedSince] = useState(() => Date.now() - DISPATCHED_DAYS * 86400000);

  const stockMap = useMemo(() => buildStockMap(finishedItems), [finishedItems]);

  const toPrepare = useMemo(() => orders.filter((o) => !isDispatched(o)), [orders]);
  const dispatched = useMemo(
    () => orders.filter((o) => isDispatched(o) && new Date(lastStatusAt(o)).getTime() >= dispatchedSince),
    [orders, dispatchedSince],
  );

  const list = segment === "preparar" ? toPrepare : dispatched;
  const selected = useMemo(() => orders.find((o) => o._id === selectedId) || null, [orders, selectedId]);
  useRememberedSelection("inventario/pedidos", { selectedId, setSelectedId, ids: list.map((o) => o._id), ready: !ordersLoading });

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

  // Aplica la respuesta de una acción: reemplaza los pedidos que vienen
  // actualizados (sin recargar la lista) y recarga el inventario solo si la
  // acción movió stock. Si la respuesta no trae pedidos, recarga la lista.
  function applyResult(result, { stock }) {
    const updated = ordersFrom(result);
    if (updated.length) mutateOrders((list) => replaceById(list, updated));
    else refetchOrders();
    if (stock) refetchInventory();
  }

  // Ejecuta una acción directa con «Deshacer»: `run` hace el cambio y `undo`
  // lo revierte (ambos llaman a la API). `stock`: la acción mueve existencia
  // (verificar, dividir), así que hay que recargar el inventario.
  async function act(run, message, undo, { stock = false } = {}) {
    setBusy(true);
    try {
      applyResult(await run(), { stock });
      setOpenBox(null);
      toastUndo(message, async () => {
        try {
          applyResult(await undo(), { stock });
          toast.success("Cambio deshecho");
        } catch (err) {
          toast.error(err.message);
          refetchOrders();
          if (stock) refetchInventory();
        }
      });
    } catch (err) {
      toast.error(err.message);
      // El pedido pudo cambiar en otra pantalla: se vuelve a leer.
      refetchOrders();
      if (stock) refetchInventory();
    } finally {
      setBusy(false);
    }
  }

  const base = (order, index) => `/orders/${order._id}/items/${index}`;

  const actions = {
    verify: (order, index, warehouse) =>
      act(
        () => api.patch(`${base(order, index)}/verify`, { warehouse }),
        `${order.items[index].product} verificado en ${warehouse}`,
        () => api.patch(`${base(order, index)}/unverify`),
        { stock: true },
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
        { stock: true },
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
        { stock: true },
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
            {/* Mismos chips que la lista de Pedidos: el seleccionado en azul. */}
            <FilterChips
              showEmpty
              value={segment}
              onChange={(key) => {
                setSegment(key);
                setChecked(new Set());
              }}
              options={[
                { key: "preparar", tone: "amber", label: "Por preparar", count: fmtNumber(toPrepare.length) },
                { key: "despachados", tone: "green", label: "Despachados", count: fmtNumber(dispatched.length) },
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
