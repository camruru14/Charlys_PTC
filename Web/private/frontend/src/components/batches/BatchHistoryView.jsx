import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useBatchForm } from "../../hooks/useBatchForm";
import { useDateRange, rangeLabel } from "../../context/dateRange";
import { SectionCard, AsyncState } from "../ui/SectionCard";
import BatchToolbar from "./BatchToolbar";
import BatchTable from "./BatchTable";
import BatchFormModal from "./BatchFormModal";
import ConfirmModal from "../ui/ConfirmModal";
import { defaultBatchFilters, filterBatches } from "../../lib/batchFilters";
import { IconPlus } from "../../lib/icons";
import PageHeader from "../ui/PageHeader";
import DateRangePicker from "../ui/DateRangePicker";
import Button from "../ui/Button";
import { getPageMeta } from "../../lib/nav";

/*
  Vista a pantalla completa del historial de lotes.
  Reutilizada por cada apartado que tiene su propio botón "Ver todo"
  (Dashboard y Fabricación), cada uno con su propio botón de "volver".
  Incluye: filtro por fechas (en las acciones del PageHeader), búsqueda y todos los filtros
  (producto, línea, estado, operario y cantidad producida).
  Cuando editable=true (Fabricación) permite editar y eliminar lotes.
*/
function BatchHistoryView({ backTo, backLabel, editable = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const range = useDateRange();
  const { data, loading, error, refetch } = useFetch("/productionBatches");
  const [filters, setFilters] = useState(defaultBatchFilters);

  const all = Array.isArray(data) ? data : [];
  const { modalOpen, setModalOpen, editingId, form, saving, operators, openCreate, openEdit, handleChange, handleSubmit, handleDelete, confirmProps } =
    useBatchForm(all, refetch);
  const filtered = useMemo(() => filterBatches(all, filters, range), [all, filters, range]);

  const stats = useMemo(() => {
    const produced = filtered.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    return { count: filtered.length, produced };
  }, [filtered]);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta(pathname)} actions={<DateRangePicker />} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-ink"
        >
          ← {backLabel}
        </button>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary-soft-text">
          Rango: {rangeLabel(range)}
        </span>
      </div>

      {/* Resumen del subconjunto filtrado */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Lotes encontrados</p>
          <p className="t-kpi mt-2">{stats.count}</p>
        </div>
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Producción total</p>
          <p className="t-kpi mt-2">{stats.produced.toLocaleString("es-SV")}</p>
        </div>
      </div>

      <SectionCard
        title="Todos los lotes"
        action={
          editable ? (
            <Button size="row" icon={IconPlus} onClick={openCreate}>
              Nuevo Lote
            </Button>
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

      {editable ? <ConfirmModal {...confirmProps} /> : null}
    </div>
  );
}

export default BatchHistoryView;
