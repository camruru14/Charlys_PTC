import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useBatchForm } from "../../hooks/useBatchForm";
import { useDateRange, rangeLabel } from "../../context/dateRange";
import PagedSection from "../ui/PagedSection";
import BatchToolbar from "./BatchToolbar";
import BatchTable from "./BatchTable";
import BatchFormModal from "./BatchFormModal";
import ConfirmModal from "../ui/ConfirmModal";
import { defaultBatchFilters, filterBatches } from "../../lib/batchFilters";
import { IconPlus } from "../../lib/icons";
import PageHeader from "../ui/PageHeader";
import DateRangePicker from "../ui/DateRangePicker";
import Button from "../ui/Button";
import KpiCard from "../ui/KpiCard";
import { getPageMeta } from "../../lib/nav";
import { fmtNumber } from "../../lib/format";

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

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
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
        <KpiCard label="Lotes encontrados" value={fmtNumber(stats.count)} />
        <KpiCard label="Producción total" value={fmtNumber(stats.produced)} note="unidades" />
      </div>

      <PagedSection
        title="Todos los lotes"
        action={
          editable ? (
            <Button size="row" icon={IconPlus} onClick={openCreate}>
              Nuevo Lote
            </Button>
          ) : null
        }
        toolbar={<BatchToolbar list={all} filters={filters} setFilters={setFilters} />}
        items={filtered}
        rowHeight={44}
        resetKey={`${JSON.stringify(filters)}|${rangeLabel(range)}`}
        noun="lotes"
        loading={loading}
        error={error}
      >
        {(rows) => (
          <BatchTable
            batches={rows}
            showOperator
            onEdit={editable ? openEdit : undefined}
            onDelete={editable ? handleDelete : undefined}
          />
        )}
      </PagedSection>

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
