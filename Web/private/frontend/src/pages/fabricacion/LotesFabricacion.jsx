import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useFetch, replaceById } from "../../hooks/useFetch";
import { useUrlState } from "../../hooks/useUrlState";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import ColorSwatch from "../../components/ui/ColorSwatch";
import SearchInput from "../../components/ui/SearchInput";
import FilterChips from "../../components/ui/FilterChips";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import BatchDetail from "../../components/batches/BatchDetail";
import SendToWarehouseModal from "../../components/batches/SendToWarehouseModal";
import { toastUndo } from "../../lib/toastUndo";
import { statusTone } from "../../lib/statusDomains";
import { fmtNumber, formatBatchNumber } from "../../lib/format";
import { IconFactory } from "../../lib/icons";
import { batchState, productLabel, batchSearchText, pendingUnits } from "../../lib/batchFlow";
import { useProductionLines } from "../../hooks/useProductionLines";

// El tono de cada chip es el de su estado (dominio lote).
const CHIPS = [
  { key: "all", label: "Todos", tone: "gray" },
  { key: "En proceso", label: "En proceso", tone: statusTone("En proceso", "lote") },
  { key: "Por enviar", label: "Por enviar", tone: statusTone("Por enviar", "lote") },
  { key: "Detenido", label: "Detenidos", tone: statusTone("Detenido", "lote") },
];

function BatchListRow({ batch, selected, onSelect }) {
  const done = batch.status === "Completado";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={`grid h-[58px] w-full grid-cols-[5px_1fr] border-b border-line-soft text-left transition ${
        selected ? "bg-select-bg" : "hover:bg-surface-2"
      }`}
    >
      <span className={selected ? "bg-select-bar" : ""} />
      <span className="flex min-w-0 flex-col justify-center gap-1 px-3.5">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[11.5px] font-medium tabular-nums text-muted">
            {formatBatchNumber(batch.batchNumber)} · {batch.productionLine || "Sin línea"}
          </span>
          <StatusPill status={batchState(batch)} domain="lote" variant="dot" />
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <ColorSwatch color={batch.color} />
            <span className="truncate text-[13.5px] font-semibold text-ink">{productLabel(batch) || "—"}</span>
          </span>
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">
            {done || batch.producedQuantity ? fmtNumber(batch.producedQuantity) : "—"}
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
  con «Deshacer» donde hay reversa.
*/
function LotesFabricacion({ batches, list, loading, error, refetch, mutateBatches, operators, onEdit, onDelete }) {
  const [selectedId, setSelectedId] = useUrlState("id");
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
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

  const counts = useMemo(() => {
    const c = { all: list.length };
    list.forEach((b) => {
      const s = batchState(b);
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [list]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((b) => (chip === "all" || batchState(b) === chip) && (!q || batchSearchText(b).includes(q)));
  }, [list, chip, query]);

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
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar lote, producto o color" />
            <FilterChips
              value={chip}
              onChange={setChip}
              options={CHIPS.map((c) => ({ ...c, count: counts[c.key] || 0 }))}
            />
          </>
        }
      >
        {loading && !batches.length ? (
          <EmptyState title="Cargando lotes…" />
        ) : error ? (
          <EmptyState title="No se pudieron cargar los lotes" description={error} />
        ) : visible.length === 0 ? (
          <EmptyState title={list.length ? "Ningún lote coincide con la búsqueda." : "No hay lotes en el rango seleccionado."} />
        ) : (
          visible.map((b) => <BatchListRow key={b._id} batch={b} selected={b._id === selectedId} onSelect={() => select(b._id)} />)
        )}
      </ListPanel>

      {selected ? (
        <BatchDetail
          key={selected._id}
          batch={selected}
          batches={batches}
          operators={operators}
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
