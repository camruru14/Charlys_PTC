import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useBatchForm } from "../../hooks/useBatchForm";
import { useDateRange, rangeLabel } from "../../context/DateRangeContext";
import { SectionCard, AsyncState } from "../ui/SectionCard";
import BatchToolbar from "./BatchToolbar";
import BatchTable from "./BatchTable";
import BatchFormModal from "./BatchFormModal";
import { defaultBatchFilters, filterBatches } from "../../lib/batchFilters";
import { IconPlus } from "../../lib/icons";

/*
  Vista a pantalla completa del historial de lotes.
  Reutilizada por cada apartado que tiene su propio botón "Ver todo"
  (Dashboard y Fabricación), cada uno con su propio botón de "volver".
  Incluye: filtro por fechas (en el TopBar), búsqueda y todos los filtros
  (producto, línea, estado, operario y cantidad producida).
  Cuando editable=true (Fabricación) permite editar y eliminar lotes.
*/
function BatchHistoryView({ backTo, backLabel, editable = false }) {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data, loading, error, refetch } = useFetch("/productionBatches");
  const [filters, setFilters] = useState(defaultBatchFilters);

  const all = Array.isArray(data) ? data : [];
  const { modalOpen, setModalOpen, editingId, form, saving, operators, openCreate, openEdit, handleChange, handleSubmit, handleDelete } =
    useBatchForm(all, refetch);
  const filtered = useMemo(() => filterBatches(all, filters, range), [all, filters, range]);

  const stats = useMemo(() => {
    const produced = filtered.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    return { count: filtered.length, produced };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
        >
          ← {backLabel}
        </button>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Rango: {rangeLabel(range)}
        </span>
      </div>

      {/* Resumen del subconjunto filtrado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Lotes encontrados</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Producción total</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.produced.toLocaleString("es-SV")}</p>
        </div>
      </div>

      <SectionCard
        title="Todos los lotes"
        action={
          editable ? (
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <IconPlus width={16} height={16} /> Nuevo Lote
            </button>
          ) : null
        }
      >
        <BatchToolbar list={all} filters={filters} setFilters={setFilters} />
        <AsyncState loading={loading} error={error}>
          <BatchTable
            batches={filtered}
            showOperator
            onEdit={editable ? openEdit : undefined}
            onDelete={editable ? handleDelete : undefined}
          />
        </AsyncState>
      </SectionCard>

      {editable ? (
        <BatchFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editingId={editingId}
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          saving={saving}
          operators={operators}
        />
      ) : null}
    </div>
  );
}

export default BatchHistoryView;
