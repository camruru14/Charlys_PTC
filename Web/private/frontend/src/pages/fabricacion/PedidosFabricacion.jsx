import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useUrlState } from "../../hooks/useUrlState";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import { replaceById } from "../../hooks/useFetch";
import { withCurrentLine } from "../../hooks/useProductionLines";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/ui/SearchInput";
import FilterChips from "../../components/ui/FilterChips";
import Stepper from "../../components/ui/Stepper";
import MiniStepper from "../../components/ui/MiniStepper";
import InlineResolveBox from "../../components/ui/InlineResolveBox";
import DisclosureChevron from "../../components/ui/DisclosureChevron";
import ColorSwatch from "../../components/ui/ColorSwatch";
import { SelectField } from "../../components/ui/Field";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { toastUndo } from "../../lib/toastUndo";
import { buttonClass } from "../../lib/buttonStyles";
import { blockNegativeKey } from "../../lib/numberInput";
import { fmtNumber, fmtDate, fmtTime, fmtDateTime, formatBatchNumber } from "../../lib/format";
import { IconAlert, IconBox, IconCheck, IconOrders, IconPlay } from "../../lib/icons";
import { batchStart, batchEnd } from "../../lib/batchFlow";
import {
  buildGroups,
  lotState,
  miniSegments,
  stepperDates,
  groupSearchText,
  STEP_LABELS,
} from "../../lib/orderManufacturing";

// Colores de los chips (mockup): Todos azul sólido al activarse, En proceso
// azul claro, Por empacar morado claro y Detenidos rojo claro.
const CHIPS = [
  { key: "all", label: "Todos", tone: "gray" },
  { key: "enProceso", label: "En proceso", tone: "blue" },
  { key: "porEmpacar", label: "Por empacar", tone: "purple" },
  { key: "detenidos", label: "Detenidos", tone: "rose" },
];

const CHIP_TEST = {
  all: () => true,
  enProceso: (g) => g.macro.startsWith("En proceso"),
  porEmpacar: (g) => g.macro === "Por empacar",
  detenidos: (g) => g.stopped.length > 0,
};

// Tabla de lotes: Lote · Producto · Color · Cantidad · Estado · Acción · ⌄.
// Se acomoda según el ancho del propio panel (container query): si no caben
// las siete columnas, Lote, Color y Cantidad pasan debajo del producto y el
// estado y la acción siguen a la derecha.
const LOT_COLS =
  "grid-cols-[minmax(0,1fr)_auto_18px] @[700px]:grid-cols-[108px_minmax(130px,1.5fr)_82px_66px_104px_172px_18px]";
const productLabel = (item) => `${item.product}${item.color ? ` · ${item.color}` : ""}`;
const plural = (n, one, many) => `${fmtNumber(n)} ${n === 1 ? one : many}`;
// Ejecuta las llamadas en orden y devuelve todas sus respuestas.
const runAll = (calls) => calls.reduce((p, fn) => p.then(async (results) => [...results, await fn()]), Promise.resolve([]));

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
      <span className="flex min-w-0 flex-col gap-1 px-3.5 py-2.5">
        <span className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          <StatusPill status={group.macro} domain="pedido-fabricacion" variant="dot" />
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[12px] text-ink-2">{order.customer?.name || "—"}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted">{plural(count, "producto", "productos")}</span>
        </span>
        <MiniStepper segments={miniSegments(group)} size="sm" className="mt-0.5" />
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
      <InlineResolveBox title={`Iniciar ${formatBatchNumber(batch.batchNumber)}`} className="mx-4 mb-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label="Línea" name="productionLine" size="sm" value={line} onChange={(e) => setLine(e.target.value)} options={withCurrentLine(lines, batch.productionLine)} />
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
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            actions.stop(lot, reason);
          }}
        >
          <span className="text-[12.5px] font-bold tabular-nums text-ink">Detener {formatBatchNumber(batch.batchNumber)}</span>
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo de la detención"
            autoFocus
            className="h-8 min-w-[200px] flex-1 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
          />
          <div className="ml-auto flex items-center gap-2">
            {cancel}
            <Button type="submit" variant="stop" size="row" disabled={busy}>
              Detener
            </Button>
          </div>
        </form>
      </InlineResolveBox>
    );
  }

  // «Completar»: una sola línea, con la cantidad producida y sin abrir el
  // formulario completo del lote.
  return (
    <InlineResolveBox className="mx-4 mb-3">
      <form
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          actions.complete(lot, Number(produced));
        }}
      >
        <span className="text-[12.5px] font-bold tabular-nums text-ink">Completar {formatBatchNumber(batch.batchNumber)}</span>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          Producidas
          <input
            name="producedQuantity"
            type="number"
            min="0"
            step="1"
            required
            onKeyDown={blockNegativeKey}
            value={produced}
            onChange={(e) => setProduced(e.target.value)}
            className="h-8 w-[88px] rounded-[8px] border border-line bg-surface px-2.5 text-[13px] font-semibold tabular-nums text-ink outline-none transition focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
          />
        </label>
        <span className="text-[12px] tabular-nums text-muted">meta {batch.targetQuantity != null ? fmtNumber(batch.targetQuantity) : "—"}</span>
        <div className="ml-auto flex items-center gap-3">
          <Button type="submit" size="row" disabled={busy || produced === ""}>
            Confirmar
          </Button>
          <button type="button" onClick={onClose} className="text-[12.5px] font-semibold text-primary hover:underline">
            Cancelar
          </button>
        </div>
      </form>
    </InlineResolveBox>
  );
}

function OrderDetail({ group, operators, lines, busy, actions }) {
  const { order, lots, stopped } = group;
  // Las filas empiezan colapsadas; el chevron abre su detalle.
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
  // Subtítulo de cada paso: «30 sep · al llegar» (llegada), «desde 17 sep»
  // (paso actual), la fecha de los pasos ya cumplidos y «—» en los pendientes.
  const steps = STEP_LABELS.map((label, i) => {
    const state = i < stage || (i === 3 && stage === 3) ? "done" : i === stage ? "current" : "pending";
    const day = state !== "pending" && dates[i] ? fmtDate(dates[i]) : null;
    const caption = !day ? null : i === 0 ? `${day} · al llegar` : state === "current" ? `desde ${day}` : day;
    return { label, state, date: caption };
  });
  const summary = [
    plural(lots.length, "lote", "lotes"),
    completed.length ? plural(completed.length, "completado", "completados") : null,
    packedCount ? plural(packedCount, "empacado", "empacados") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const stopReasons = [...new Set(stopped.map((l) => l.batch.stopReason).filter(Boolean))];

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
            icon={IconPlay}
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
          <Button
            variant="resume"
            size="row"
            disabled={busy}
            className="!border-0 !bg-tone-rose !text-tone-rose-text hover:brightness-95"
            onClick={stop(() => actions.resume([lot]))}
          >
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
          <span className="inline-flex min-w-0 items-center gap-1 text-[11.5px] font-semibold tabular-nums text-tone-green-text">
            <IconCheck width={12} height={12} strokeWidth={2.6} className="shrink-0" />
            <span className="truncate">
              {order.delivery?.pickupFactoryAt ? `Recogido ${fmtTime(order.delivery.pickupFactoryAt)}` : "En recolección · Fabricación"}
            </span>
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <DetailPanel
      plainHeader
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
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
            {/* Este pedido no tiene más acciones: sin menú «⋯». */}
            <Link to={`/pedidos?id=${order._id}`} className={buttonClass("secondary", "detail")}>
              Ver productos completos
            </Link>
          </div>
          <div className="overflow-x-auto border-t border-line-soft px-5 py-4">
            <div className="min-w-[500px]">
              <Stepper steps={steps} variant="progress" />
            </div>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {stopped.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-tone-rose-dot/25 bg-tone-rose px-3.5 py-2.5">
            <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-tone-rose-text">
              <IconAlert width={16} height={16} className="shrink-0" />
              <span>
                {stopped.length === 1 ? "1 lote detenido" : `${fmtNumber(stopped.length)} lotes detenidos`}
                {stopReasons.length === 1 ? ` por ${stopReasons[0]}` : ""}
              </span>
            </p>
            <Button variant="danger" size="row" disabled={busy} onClick={() => actions.resume(stopped)}>
              Reanudar
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="t-label">Lotes de este pedido</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="t-aux tabular-nums">{summary}</span>
            {completed.length ? (
              <Button size="row" icon={IconBox} disabled={busy} onClick={() => actions.pack(completed)}>
                Empacar completados · {fmtNumber(completed.length)}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="@container overflow-hidden rounded-[12px] border border-line">
          <div className={`hidden min-h-[30px] items-center border-b border-line-soft bg-surface-2 pr-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-subtle @[700px]:grid ${LOT_COLS}`}>
            <span className="pl-4">Lote</span>
            <span>Producto</span>
            <span>Color</span>
            <span className="pr-3 text-right">Cantidad</span>
            <span className="pl-3">Estado</span>
            <span />
            <span />
          </div>
          {lots.map((lot) => {
            const id = lot.batch._id;
            const open = expanded.has(id);
            const boxHere = openBox?.id === id ? openBox.kind : null;
            const state = lotState(lot);
            const number = formatBatchNumber(lot.batch.batchNumber);
            const qty = lot.qty != null ? `${fmtNumber(lot.qty)} u` : "—";
            return (
              <div key={id} className="border-b border-line-soft last:border-0">
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(id)}
                  className={`grid min-h-[44px] cursor-pointer items-center py-1.5 pr-3 transition hover:bg-surface-2 ${LOT_COLS}`}
                >
                  <span className="hidden whitespace-nowrap pl-4 text-[12.5px] font-semibold tabular-nums text-ink-2 @[700px]:block">{number}</span>
                  <span className="min-w-0 pl-4 pr-3 @[700px]:pl-0">
                    <span className="flex items-center gap-2">
                      <ColorSwatch color={lot.item.color} />
                      <span className="truncate text-[13.5px] font-semibold text-ink">{lot.item.product}</span>
                    </span>
                    <span className="mt-0.5 block truncate pl-[19px] text-[11.5px] tabular-nums text-muted @[700px]:hidden">
                      {[number, lot.item.color, qty].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-1 block pl-[19px] @[700px]:hidden">
                      <StatusPill status={state} domain="lote" />
                    </span>
                  </span>
                  <span className="hidden truncate pr-3 text-[13px] text-ink-2 @[700px]:block">{lot.item.color || "—"}</span>
                  <span className="hidden pr-3 text-right text-[13px] tabular-nums text-ink @[700px]:block">{qty}</span>
                  <span className="hidden pl-3 @[700px]:block">
                    <StatusPill status={state} domain="lote" />
                  </span>
                  <span className="flex min-w-0 items-center justify-end pr-1">{rowAction(lot)}</span>
                  <DisclosureChevron open={open} />
                </div>
                {open ? <LotDetails lot={lot} /> : null}
                {boxHere && (boxHere !== "complete" || state === "En proceso") ? (
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
    </DetailPanel>
  );
}

/*
  Fabricación > Pedidos: los lotes de pedido llegan solos desde Inventario
  (Programado) y avanzan con acciones directas hasta el empaque, que queda
  para recoger en «Fabricación» en Logística.
*/
function PedidosFabricacion({ orders, batches, loading, error, refetchAll, refetchOrders, refetchBatches, mutateOrders, mutateBatches, operators, lines }) {
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
  useRememberedSelection("fabricacion/pedidos", { selectedId, setSelectedId, ids: visible.map((g) => g.order._id), ready: !loading });

  // Aplica la respuesta de una acción sin recargar todo:
  //  - lotes actualizados (transiciones): se reemplazan y se recargan solo
  //    los pedidos (traen el lote poblado);
  //  - pedido actualizado (empacar/desempacar una línea): se reemplaza y se
  //    recargan solo los lotes;
  //  - cualquier otra respuesta (empacar varios): se recargan ambos.
  function applyResult(result) {
    const list = Array.isArray(result) ? result : [result];
    const updatedBatches = list.filter((r) => r?.batchNumber);
    const updatedOrders = list.map((r) => r?.order).filter(Boolean);
    if (updatedBatches.length === list.length) {
      mutateBatches((prev) => replaceById(prev, updatedBatches));
      refetchOrders();
    } else if (updatedOrders.length === list.length) {
      mutateOrders((prev) => replaceById(prev, updatedOrders));
      refetchBatches();
    } else {
      refetchAll();
    }
  }

  // Acción directa con «Deshacer». Devuelve true si se aplicó.
  async function act(run, message, undo) {
    setBusy(true);
    try {
      applyResult(await run());
      if (undo) {
        toastUndo(message, async () => {
          try {
            applyResult(await undo());
            toast.success("Cambio deshecho");
          } catch (err) {
            toast.error(err.message, { duration: 6000 });
            refetchAll();
          }
        });
      } else {
        toast.success(message);
      }
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      // Lotes o pedidos pudieron cambiar en otra pantalla: se vuelven a leer.
      refetchAll();
      return false;
    } finally {
      setBusy(false);
    }
  }

  const batchUrl = (lot, action) => `/productionBatches/${lot.batch._id}/${action}`;
  const lineUrl = (lot, action) => `/orders/${selected.order._id}/items/${lot.index}/${action}`;
  const label = (lot) => formatBatchNumber(lot.batch.batchNumber);

  const actions = {
    start: (lot, body) => act(() => api.patch(batchUrl(lot, "start"), body), `Lote ${label(lot)} iniciado`),
    stop: (lot, reason) =>
      act(
        () => api.patch(batchUrl(lot, "stop"), { reason }),
        `Lote ${label(lot)} detenido`,
        () => api.patch(batchUrl(lot, "resume")),
      ),
    resume: (lots) =>
      act(
        () => runAll(lots.map((l) => () => api.patch(batchUrl(l, "resume")))),
        lots.length === 1 ? `Lote ${label(lots[0])} reanudado` : `${fmtNumber(lots.length)} lotes reanudados`,
        () => runAll(lots.map((l) => () => api.patch(batchUrl(l, "stop"), { reason: l.batch.stopReason }))),
      ),
    complete: (lot, producedQuantity) =>
      act(
        () => api.patch(batchUrl(lot, "complete"), { producedQuantity }),
        `Lote ${label(lot)} completado · ${fmtNumber(producedQuantity)} unidades`,
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
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar pedido o cliente" />
            <FilterChips compact value={chip} onChange={setChip} options={CHIPS.map((c) => ({ ...c, count: counts[c.key] }))} />
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
