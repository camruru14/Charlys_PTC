import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useUrlState } from "../../hooks/useUrlState";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/ui/SearchInput";
import FilterChips from "../../components/ui/FilterChips";
import Stepper from "../../components/ui/Stepper";
import MiniStepper from "../../components/ui/MiniStepper";
import InlineResolveBox from "../../components/ui/InlineResolveBox";
import DisclosureChevron from "../../components/ui/DisclosureChevron";
import { Field, SelectField } from "../../components/ui/Field";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { toastUndo } from "../../lib/toastUndo";
import { blockNegativeKey } from "../../lib/numberInput";
import { fmtNumber, fmtDate, fmtTime, fmtDateTime } from "../../lib/format";
import { IconBox, IconOrders } from "../../lib/icons";
import { batchStart, batchEnd } from "../../lib/batchFlow";
import {
  buildGroups,
  lotState,
  miniSegments,
  stepperDates,
  groupSearchText,
  STEP_LABELS,
} from "../../lib/orderManufacturing";

const CHIPS = [
  { key: "all", label: "Todos", tone: "gray" },
  { key: "enProceso", label: "En proceso", tone: "blue" },
  { key: "porEmpacar", label: "Por empacar", tone: "green" },
  { key: "detenidos", label: "Detenidos", tone: "rose" },
];

const CHIP_TEST = {
  all: () => true,
  enProceso: (g) => g.macro.startsWith("En proceso"),
  porEmpacar: (g) => g.macro === "Por empacar",
  detenidos: (g) => g.stopped.length > 0,
};

const LOT_GRID = "84px minmax(0,1fr) 60px 112px 168px 18px";
const productLabel = (item) => `${item.product}${item.color ? ` · ${item.color}` : ""}`;
const plural = (n, one, many) => `${fmtNumber(n)} ${n === 1 ? one : many}`;
const runAll = (calls) => calls.reduce((p, fn) => p.then(fn), Promise.resolve());

function OrderListRow({ group, selected, onSelect }) {
  const { order } = group;
  const count = (order.items || []).length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={`grid w-full grid-cols-[5px_1fr] border-b border-line-soft text-left transition ${selected ? "bg-select-bg" : "hover:bg-surface-2"}`}
    >
      <span className={selected ? "bg-select-bar" : ""} />
      <span className="flex min-w-0 flex-col gap-1.5 px-3.5 py-3">
        <span className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          <StatusPill status={group.macro} domain="pedido-fabricacion" variant="dot" />
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{plural(count, "producto", "productos")}</span>
        </span>
        <MiniStepper segments={miniSegments(group)} className="mt-0.5" />
      </span>
    </button>
  );
}

function when(point) {
  if (!point) return "—";
  return point.withTime ? fmtDateTime(point.date) : fmtDate(point.date);
}

// Contenido de la flecha desplegable de un lote.
function LotDetails({ lot }) {
  const { batch } = lot;
  const rows = [
    ["Meta", batch.targetQuantity != null ? fmtNumber(batch.targetQuantity) : "—"],
    ["Producido", batch.status === "Completado" ? fmtNumber(batch.producedQuantity) : "—"],
    ["Línea", batch.productionLine || "—"],
    ["Operario", batch.operator?.name ? `${batch.operator.name} ${batch.operator.lastName || ""}`.trim() : "—"],
    ["Inicio", when(batchStart(batch))],
    ["Fin", when(batchEnd(batch))],
    ["Motivo de detención", batch.stopReason || "—"],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 bg-surface-2 px-4 py-2.5 pl-[18px] sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <p className="t-label">{label}</p>
          <p className="truncate text-[12.5px] font-semibold tabular-nums text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

// Cuadros en línea de un lote: iniciar (faltan línea u operario), detener y completar.
function LotBox({ kind, lot, operators, lines, busy, onClose, actions }) {
  const { batch } = lot;
  const [line, setLine] = useState(batch.productionLine || "");
  const [operator, setOperator] = useState(batch.operator?._id || batch.operator || "");
  const [reason, setReason] = useState("");
  const [produced, setProduced] = useState(batch.targetQuantity != null ? String(batch.targetQuantity) : "");
  const cancel = (
    <Button variant="secondary" size="row" onClick={onClose}>
      Cancelar
    </Button>
  );

  if (kind === "start") {
    const needsOperator = operators.length > 0;
    return (
      <InlineResolveBox title={`Iniciar ${batch.batchNumber}`} className="mx-4 mb-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label="Línea" name="productionLine" size="sm" value={line} onChange={(e) => setLine(e.target.value)} options={lines} />
          <SelectField
            label="Operario"
            name="operator"
            size="sm"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder={needsOperator ? "Selecciona…" : "Sin operarios en Fabricación"}
            options={operators.map((o) => ({ value: o._id, label: `${o.name} ${o.lastName}` }))}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-2">
          {cancel}
          <Button
            variant="start"
            size="row"
            disabled={busy || !line || (needsOperator && !operator)}
            onClick={() => actions.start(lot, { productionLine: line, operator: operator || undefined })}
          >
            Iniciar
          </Button>
        </div>
      </InlineResolveBox>
    );
  }

  if (kind === "stop") {
    return (
      <InlineResolveBox className="mx-4 mb-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            actions.stop(lot, reason);
          }}
        >
          <div className="min-w-[220px] flex-1">
            <Field label="Motivo (opcional)" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <div className="flex items-center gap-2 pb-[3px]">
            {cancel}
            <Button type="submit" variant="stop" size="row" disabled={busy}>
              Detener
            </Button>
          </div>
        </form>
      </InlineResolveBox>
    );
  }

  return (
    <InlineResolveBox title={`Completar ${batch.batchNumber}`} className="mx-4 mb-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          actions.complete(lot, Number(produced));
        }}
      >
        <div className="w-[150px]">
          <Field
            label="Producidas"
            name="producedQuantity"
            type="number"
            min="0"
            step="1"
            required
            onKeyDown={blockNegativeKey}
            value={produced}
            onChange={(e) => setProduced(e.target.value)}
          />
        </div>
        <span className="t-aux pb-2.5 tabular-nums">meta {batch.targetQuantity != null ? fmtNumber(batch.targetQuantity) : "—"}</span>
        <div className="ml-auto flex items-center gap-2 pb-[3px]">
          <Button type="submit" size="row" disabled={busy || produced === ""}>
            Confirmar
          </Button>
          {cancel}
        </div>
      </form>
    </InlineResolveBox>
  );
}

function OrderDetail({ group, operators, lines, busy, actions }) {
  const { order, lots, stopped } = group;
  const [expanded, setExpanded] = useState(() => new Set());
  // Cuadro abierto: { id, kind }. «auto» abre «Completar» en el primer lote
  // en proceso; «none» es que el usuario lo cerró. Uno solo a la vez.
  const [box, setBox] = useState("auto");

  const firstInProcess = lots.find((l) => lotState(l) === "En proceso");
  const openBox =
    box === "auto" ? (firstInProcess ? { id: firstInProcess.batch._id, kind: "complete" } : null) : box === "none" ? null : box;

  const completed = lots.filter((l) => lotState(l) === "Completado");
  const packedCount = lots.filter((l) => l.packed).length;
  const { dates, stage } = stepperDates(group);
  const steps = STEP_LABELS.map((label, i) => ({
    label,
    date: dates[i] ? fmtDate(dates[i]) : null,
    state: i < stage || (i === 3 && stage === 3) ? "done" : i === stage ? "current" : "pending",
  }));
  const summary = [
    plural(lots.length, "lote", "lotes"),
    completed.length ? plural(completed.length, "completado", "completados") : null,
    packedCount ? plural(packedCount, "empacado", "empacados") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const closeBox = () => setBox("none");
  const run = (fn) => async (...args) => {
    if (await fn(...args)) setBox("auto");
  };
  const lotActions = {
    start: run(actions.start),
    stop: run(actions.stop),
    complete: run(actions.complete),
  };

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rowAction(lot) {
    const id = lot.batch._id;
    const stop = (fn) => (e) => {
      e.stopPropagation();
      fn();
    };
    switch (lotState(lot)) {
      case "Programado":
        return (
          <Button
            variant="start"
            size="row"
            disabled={busy}
            onClick={stop(() => {
              const hasOperator = lot.batch.operator || operators.length === 0;
              if (lot.batch.productionLine && hasOperator) lotActions.start(lot, {});
              else setBox({ id, kind: "start" });
            })}
          >
            Iniciar
          </Button>
        );
      case "En proceso": {
        const completeOpen = openBox?.id === id && openBox.kind === "complete";
        return (
          <span className="flex items-center gap-1.5">
            <Button variant="stop" size="row" disabled={busy} onClick={stop(() => setBox({ id, kind: "stop" }))}>
              Detener
            </Button>
            {completeOpen ? null : (
              <Button variant="secondary" size="row" disabled={busy} onClick={stop(() => setBox({ id, kind: "complete" }))}>
                Completar
              </Button>
            )}
          </span>
        );
      }
      case "Detenido":
        return (
          <Button variant="resume" size="row" disabled={busy} onClick={stop(() => actions.resume([lot]))}>
            Reanudar
          </Button>
        );
      case "Completado":
        return (
          <Button variant="pack" size="row" disabled={busy} onClick={stop(() => actions.pack([lot]))}>
            Empacar
          </Button>
        );
      case "Empacado":
        return (
          <span className="truncate text-[11.5px] tabular-nums text-muted">
            {order.delivery?.pickupFactoryAt ? `Recogido ${fmtTime(order.delivery.pickupFactoryAt)}` : "En recolección · Fabricación"}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <DetailPanel
      header={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{order.orderNumber}</h2>
              <StatusPill status={group.macro} domain="pedido-fabricacion" size="lg" />
              <span className="text-[12.5px] tabular-nums text-muted">
                {[
                  order.customer?.name || "—",
                  plural((order.items || []).length, "producto", "productos"),
                  group.arrivedAt ? `llegó de Inventario el ${fmtDate(group.arrivedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <Link to={`/pedidos?id=${order._id}`} className="text-[12.5px] font-semibold text-primary hover:underline">
              Ver productos completos
            </Link>
          </div>
          <Stepper steps={steps} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {stopped.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-tone-rose px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-tone-rose-text">
              {stopped.length === 1
                ? `1 lote detenido${stopped[0].batch.stopReason ? ` por ${stopped[0].batch.stopReason}` : ""}`
                : `${fmtNumber(stopped.length)} lotes detenidos`}
            </p>
            <Button variant="secondary" size="row" disabled={busy} onClick={() => actions.resume(stopped)}>
              Reanudar
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h3 className="t-card-title">Lotes de este pedido</h3>
            <span className="t-aux tabular-nums">{summary}</span>
          </div>
          {completed.length ? (
            <Button size="row" icon={IconBox} disabled={busy} onClick={() => actions.pack(completed)}>
              Empacar completados · {fmtNumber(completed.length)}
            </Button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[12px] border border-line">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {lots.map((lot) => {
                const id = lot.batch._id;
                const open = expanded.has(id);
                const boxHere = openBox?.id === id ? openBox.kind : null;
                return (
                  <div key={id} className="border-b border-line-soft last:border-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(id)}
                      className="grid min-h-[46px] cursor-pointer items-center py-1.5 pr-3 transition hover:bg-surface-2"
                      style={{ gridTemplateColumns: LOT_GRID }}
                    >
                      <span className="pl-4 text-[12.5px] font-semibold tabular-nums text-ink-2">{lot.batch.batchNumber}</span>
                      <span className="truncate pr-3 text-[13.5px] font-semibold text-ink">{productLabel(lot.item)}</span>
                      <span className="pr-3 text-right text-[13px] tabular-nums text-ink">{lot.qty != null ? `${fmtNumber(lot.qty)} u` : "—"}</span>
                      <span>
                        <StatusPill status={lotState(lot)} domain="lote" />
                      </span>
                      <span className="flex min-w-0 items-center">{rowAction(lot)}</span>
                      <DisclosureChevron open={open} />
                    </div>
                    {open ? <LotDetails lot={lot} /> : null}
                    {boxHere && (boxHere !== "complete" || lotState(lot) === "En proceso") ? (
                      <div className="pt-1">
                        <LotBox
                          key={`${id}-${boxHere}`}
                          kind={boxHere}
                          lot={lot}
                          operators={operators}
                          lines={lines}
                          busy={busy}
                          onClose={closeBox}
                          actions={lotActions}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DetailPanel>
  );
}

/*
  Fabricación > Pedidos: los lotes de pedido llegan solos desde Inventario
  (Programado) y avanzan con acciones directas hasta el empaque, que queda
  para recoger en «Fabricación» en Logística.
*/
function PedidosFabricacion({ orders, batches, loading, error, refetchAll, operators, lines }) {
  const [selectedId, setSelectedId] = useUrlState("id");
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => buildGroups(orders, batches), [orders, batches]);
  const counts = useMemo(
    () => Object.fromEntries(CHIPS.map((c) => [c.key, groups.filter(CHIP_TEST[c.key]).length])),
    [groups],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => CHIP_TEST[chip](g) && (!q || groupSearchText(g).includes(q)));
  }, [groups, chip, query]);
  const selected = groups.find((g) => g.order._id === selectedId) || null;

  // Acción directa con «Deshacer». Devuelve true si se aplicó.
  async function act(run, message, undo) {
    setBusy(true);
    try {
      await run();
      if (undo) {
        toastUndo(message, async () => {
          try {
            await undo();
            toast.success("Cambio deshecho");
          } catch (err) {
            toast.error(err.message, { duration: 6000 });
          } finally {
            refetchAll();
          }
        });
      } else {
        toast.success(message);
      }
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      return false;
    } finally {
      setBusy(false);
      refetchAll();
    }
  }

  const batchUrl = (lot, action) => `/productionBatches/${lot.batch._id}/${action}`;
  const lineUrl = (lot, action) => `/orders/${selected.order._id}/items/${lot.index}/${action}`;

  const actions = {
    start: (lot, body) => act(() => api.patch(batchUrl(lot, "start"), body), `Lote ${lot.batch.batchNumber} iniciado`),
    stop: (lot, reason) =>
      act(
        () => api.patch(batchUrl(lot, "stop"), { reason }),
        `Lote ${lot.batch.batchNumber} detenido`,
        () => api.patch(batchUrl(lot, "resume")),
      ),
    resume: (lots) =>
      act(
        () => runAll(lots.map((l) => () => api.patch(batchUrl(l, "resume")))),
        lots.length === 1 ? `Lote ${lots[0].batch.batchNumber} reanudado` : `${fmtNumber(lots.length)} lotes reanudados`,
        () => runAll(lots.map((l) => () => api.patch(batchUrl(l, "stop"), { reason: l.batch.stopReason }))),
      ),
    complete: (lot, producedQuantity) =>
      act(
        () => api.patch(batchUrl(lot, "complete"), { producedQuantity }),
        `Lote ${lot.batch.batchNumber} completado · ${fmtNumber(producedQuantity)} unidades`,
        () => api.patch(batchUrl(lot, "reopen")),
      ),
    pack: (lots) =>
      act(
        () =>
          lots.length === 1
            ? api.patch(lineUrl(lots[0], "pack-manufactured"))
            : api.post("/productionBatches/pack-completed", { batchIds: lots.map((l) => l.batch._id) }),
        lots.length === 1 ? `${productLabel(lots[0].item)} empacado` : `${fmtNumber(lots.length)} lotes empacados`,
        () => runAll(lots.map((l) => () => api.patch(lineUrl(l, "unpack-manufactured")))),
      ),
  };

  return (
    <MasterDetail listWidth={392}>
      <ListPanel
        header={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar pedido" />
            <FilterChips value={chip} onChange={setChip} options={CHIPS.map((c) => ({ ...c, count: counts[c.key] }))} />
          </>
        }
      >
        {loading && !groups.length ? (
          <EmptyState title="Cargando pedidos…" />
        ) : error ? (
          <EmptyState title="No se pudieron cargar los pedidos" description={error} />
        ) : visible.length === 0 ? (
          <EmptyState title={groups.length ? "Ningún pedido coincide con la búsqueda." : "No hay pedidos en fabricación."} />
        ) : (
          visible.map((g) => (
            <OrderListRow key={g.order._id} group={g} selected={g.order._id === selectedId} onSelect={() => setSelectedId(g.order._id)} />
          ))
        )}
      </ListPanel>

      {selected ? (
        <OrderDetail key={selected.order._id} group={selected} operators={operators} lines={lines} busy={busy} actions={actions} />
      ) : (
        <DetailPanel>
          <EmptyState
            icon={IconOrders}
            title={selectedId && !loading ? "Este pedido no tiene lotes en fabricación" : "Selecciona un pedido"}
            description="Inicia, completa y empaca sus lotes desde aquí."
          />
        </DetailPanel>
      )}
    </MasterDetail>
  );
}

export default PedidosFabricacion;
