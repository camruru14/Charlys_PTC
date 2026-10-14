import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useFetch, replaceById } from "../../hooks/useFetch";
import { useUrlState } from "../../hooks/useUrlState";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import { useDateRange, rangeLabel } from "../../context/dateRange";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import ColorSwatch from "../../components/ui/ColorSwatch";
import SearchInput from "../../components/ui/SearchInput";
import ListGroupHeader from "../../components/ui/ListGroupHeader";
import { FilterSelect } from "../../components/ui/Field";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import BatchDetail from "../../components/batches/BatchDetail";
import SendToWarehouseModal from "../../components/batches/SendToWarehouseModal";
import { toastUndo } from "../../lib/toastUndo";
import { statusTone } from "../../lib/statusDomains";
import { TONE_DOT, NOTE_TEXT } from "../../lib/tones";
import { filterSelectClass } from "../../lib/filterStyles";
import { fmtNumber, formatBatchNumber } from "../../lib/format";
import { IconFactory, IconClock } from "../../lib/icons";
import { batchState, productLabel, batchSearchText, pendingUnits, BATCH_GROUPS, groupBatches, batchTimeNote } from "../../lib/batchFlow";
import { useProductionLines } from "../../hooks/useProductionLines";
import UnseenDot from "../../components/ui/UnseenDot";
import MarkAllSeen from "../../components/ui/MarkAllSeen";
import { UNSEEN_BG } from "../../lib/unseen";
import { useUnseen } from "../../hooks/useActivity";

// Valores de ?estadoLote=: «todos» o la clave de un grupo de BATCH_GROUPS.
const STATE_KEYS = ["todos", ...BATCH_GROUPS.map((g) => g.key)];

// Fila del lote (62px): número y nota de tiempo con el estado; producto, línea
// y «Producido / Meta».
function BatchListRow({ batch, selected, unseen, onSelect }) {
  const done = batch.status === "Completado";
  const note = batchTimeNote(batch);
  const target = batch.targetQuantity;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      data-unseen={unseen || undefined}
      className={`relative grid h-[62px] w-full grid-cols-[5px_1fr] border-b border-line-soft text-left transition ${
        selected ? "bg-select-bg" : unseen ? `${UNSEEN_BG} hover:bg-surface-2` : "hover:bg-surface-2"
      }`}
    >
      <UnseenDot show={unseen} className="left-[9px] top-[15px]" />
      <span className={selected ? "bg-select-bar" : ""} />
      <span className="flex min-w-0 flex-col justify-center gap-1 px-3.5">
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-ink">{formatBatchNumber(batch.batchNumber)}</span>
            {note ? (
              <span
                className={`inline-flex min-w-0 items-center gap-1 text-[11.5px] tabular-nums ${note.bold ? "font-bold" : ""} ${NOTE_TEXT[note.tone] || "text-muted"}`}
              >
                <IconClock width={11} height={11} className="shrink-0" />
                <span className="truncate">{note.text}</span>
              </span>
            ) : null}
          </span>
          <StatusPill status={batchState(batch)} domain="lote" variant="dot" />
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <ColorSwatch color={batch.color} />
            <span className="truncate text-[13px]">
              <span className="font-semibold text-ink">{productLabel(batch) || "—"}</span>
              <span className="text-muted"> · {batch.productionLine || "Sin línea"}</span>
            </span>
          </span>
          <span className="shrink-0 text-[12.5px] tabular-nums">
            <span className="font-semibold text-ink">{done || batch.producedQuantity ? fmtNumber(batch.producedQuantity) : "—"}</span>
            {target != null ? <span className="text-muted"> / {fmtNumber(target)}</span> : null}
          </span>
        </span>
      </span>
    </button>
  );
}

/*
  Fabricación > Lotes de fabricación. Maestro-detalle de los lotes de stock
  (los de categoría «Pedido» van en la pestaña Pedidos). El lote avanza con
  acciones directas: Iniciar, Detener/Reanudar, Completar y Enviar a bodega,
  con «Deshacer» donde hay reversa. `list` son todos los lotes de stock: la
  lista va agrupada por estado y el rango de fechas solo filtra «En bodega».
*/
function LotesFabricacion({ batches, list, loading, error, refetch, mutateBatches, operators, operatorsLoading, onEdit, onDelete }) {
  // Novedades: los registros nuevos o que cambiaron se marcan hasta que se abren.
  const [selectedId, setSelectedId] = useUrlState("id");
  // El registro abierto en el detalle no se marca como nuevo y, si algo lo vuelve a marcar, se ve solo.
  const { isUnseen, markSeen } = useUnseen("fabricacion.lotes", { openId: selectedId });
  const [query, setQuery] = useState("");
  const range = useDateRange();
  const [estado, setEstado] = useUrlState("estadoLote", "todos", { allowed: STATE_KEYS });
  const [openBox, setOpenBox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);

  const { data: warehousesData } = useFetch("/warehouses");
  const { data: inventoryData, refetch: refetchInventory } = useFetch("/inventory");
  const warehouses = useMemo(() => (Array.isArray(warehousesData) ? warehousesData.map((w) => w.name) : []), [warehousesData]);
  const finishedItems = useMemo(
    () => (Array.isArray(inventoryData) ? inventoryData.filter((i) => i.category === "Producto Terminado") : []),
    [inventoryData],
  );
  // Líneas activas de Configuración > Líneas de producción (para iniciar lotes).
  const { options: lines } = useProductionLines();

  // Grupos con la búsqueda y el rango (los conteos del combobox salen de aquí);
  // no se muestran los vacíos ni los que no son el estado elegido.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((b) => batchSearchText(b).includes(q)) : list;
  }, [list, query]);
  const allGroups = useMemo(() => groupBatches(found, range), [found, range]);
  const groups = useMemo(() => allGroups.filter((g) => g.items.length > 0 && (estado === "todos" || g.key === estado)), [allGroups, estado]);
  const visible = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const stateOptions = useMemo(
    () => [
      { value: "todos", label: "Todos", meta: fmtNumber(allGroups.reduce((n, g) => n + g.items.length, 0)) },
      ...allGroups.map((g) => ({
        value: g.key,
        label: g.state,
        dot: TONE_DOT[statusTone(g.state, "lote")],
        meta: fmtNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    ],
    [allGroups],
  );
  const estadoGroup = BATCH_GROUPS.find((g) => g.key === estado);

  const selected = useMemo(() => batches.find((b) => b._id === selectedId) || null, [batches, selectedId]);
  useRememberedSelection("fabricacion/lotes", { selectedId, setSelectedId, ids: visible.map((b) => b._id), ready: !loading });

  function select(id) {
    setSelectedId(id);
    setOpenBox(null);
  }

  // Reemplaza el lote con la respuesta de la acción (las transiciones
  // responden el lote; enviar/deshacer envío, { batch }). Solo enviar a bodega
  // y deshacerlo mueven existencia: ahí se recarga el inventario.
  function applyResult(result, { stock }) {
    const batch = result?.batch || (result?._id ? result : null);
    if (batch) mutateBatches((prev) => replaceById(prev, batch));
    else refetch();
    if (stock) refetchInventory();
  }

  // Acción directa: `run` hace el cambio; si hay `undo`, el toast ofrece «Deshacer».
  async function act(run, message, undo, { stock = false } = {}) {
    setBusy(true);
    try {
      applyResult(await run(), { stock });
      setOpenBox(null);
      if (undo) {
        toastUndo(message, async () => {
          try {
            applyResult(await undo(), { stock });
            toast.success("Cambio deshecho");
          } catch (err) {
            toast.error(err.message, { duration: 6000 });
            refetch();
          }
        });
      } else {
        toast.success(message);
      }
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      // El lote pudo cambiar en otra pantalla: se vuelve a leer.
      refetch();
    } finally {
      setBusy(false);
    }
  }

  const url = (b, action) => `/productionBatches/${b._id}/${action}`;

  const actions = {
    start: (b, body) => act(() => api.patch(url(b, "start"), body), `Lote ${formatBatchNumber(b.batchNumber)} iniciado`),
    stop: (b, reason) =>
      act(
        () => api.patch(url(b, "stop"), { reason }),
        `Lote ${formatBatchNumber(b.batchNumber)} detenido`,
        () => api.patch(url(b, "resume")),
      ),
    resume: (b) =>
      act(
        () => api.patch(url(b, "resume")),
        `Lote ${formatBatchNumber(b.batchNumber)} reanudado`,
        () => api.patch(url(b, "stop"), { reason: b.stopReason }),
      ),
    complete: (b, producedQuantity) =>
      act(
        () => api.patch(url(b, "complete"), { producedQuantity }),
        `Lote ${formatBatchNumber(b.batchNumber)} completado · ${fmtNumber(producedQuantity)} unidades`,
        () => api.patch(url(b, "reopen")),
      ),
    openSend: (b) => setSendTarget(b),
    send: (b, warehouse) =>
      act(
        async () => {
          const res = await api.patch(url(b, "send-to-warehouse"), { warehouse });
          setSendTarget(null);
          return res;
        },
        `${fmtNumber(pendingUnits(b))} unidades de ${formatBatchNumber(b.batchNumber)} enviadas a ${warehouse}`,
        () => api.patch(url(b, "undo-send")),
        { stock: true },
      ),
    edit: (b) => onEdit(b),
    remove: async (b) => {
      if (await onDelete(b)) setSelectedId(null);
    },
  };

  return (
    <MasterDetail listWidth={424}>
      <ListPanel
        header={
          <>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-bold text-ink">Lotes</h2>
                <span className="flex items-baseline gap-3">
                  <MarkAllSeen activityKey="fabricacion.lotes" />
                  <span className="t-aux tabular-nums">
                    {fmtNumber(visible.length)} {visible.length === 1 ? "lote" : "lotes"}
                  </span>
                </span>
              </div>
              <p className="t-aux tabular-nums">{rangeLabel(range)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <SearchInput value={query} onChange={setQuery} placeholder="Buscar lote, producto o color" className="min-w-0 flex-1" />
              <FilterSelect
                label="Estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                options={stateOptions}
                panelMinWidth={208}
                className={`${filterSelectClass} w-[140px] !min-w-0 !gap-1 !px-2`}
              />
            </div>
          </>
        }
      >
        {loading && !batches.length ? (
          <EmptyState title="Cargando lotes…" />
        ) : error ? (
          <EmptyState title="No se pudieron cargar los lotes" description={error} />
        ) : groups.length === 0 ? (
          <EmptyState
            title={
              estadoGroup
                ? `No hay lotes «${estadoGroup.state}» ${estadoGroup.ranged ? "en este rango" : "con estos filtros"}.`
                : query.trim()
                  ? "No hay lotes con estos filtros."
                  : "No hay lotes."
            }
          />
        ) : (
          groups.map((g) => (
            <Fragment key={g.key}>
              <ListGroupHeader label={g.label} note={g.note} count={g.items.length} />
              {g.items.map((b) => (
                <BatchListRow
                  key={b._id}
                  batch={b}
                  selected={b._id === selectedId}
                  unseen={isUnseen(b._id)}
                  onSelect={() => {
                    select(b._id);
                    markSeen(b._id);
                  }}
                />
              ))}
            </Fragment>
          ))
        )}
      </ListPanel>

      {selected ? (
        <BatchDetail
          key={selected._id}
          batch={selected}
          batches={batches}
          operators={operators}
          operatorsLoading={operatorsLoading}
          lines={lines}
          busy={busy}
          openBox={openBox}
          setOpenBox={setOpenBox}
          actions={actions}
        />
      ) : (
        <DetailPanel>
          <EmptyState
            icon={IconFactory}
            title={selectedId && !loading ? "Este lote ya no existe" : "Selecciona un lote"}
            description="Inícialo, complétalo y envíalo a bodega desde aquí."
          />
        </DetailPanel>
      )}

      {sendTarget ? (
        <SendToWarehouseModal
          batch={sendTarget}
          warehouses={warehouses}
          finishedItems={finishedItems}
          busy={busy}
          onClose={() => setSendTarget(null)}
          onConfirm={(warehouse) => actions.send(sendTarget, warehouse)}
        />
      ) : null}
    </MasterDetail>
  );
}

export default LotesFabricacion;
