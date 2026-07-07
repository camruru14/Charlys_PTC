import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange, rangeLabel } from "../context/DateRangeContext";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import BatchToolbar from "../components/batches/BatchToolbar";
import BatchTable from "../components/batches/BatchTable";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";

/*
  Vista a pantalla completa del historial de lotes.
  Se accede desde el botón "Ver todo" de la card del Dashboard.
  Incluye: filtro por fechas (en el TopBar), búsqueda y todos los filtros
  (producto, línea, estado, cantidad producida y % de residuos).
*/
function HistorialLotes() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data, loading, error } = useFetch("/productionBatches");
  const [filters, setFilters] = useState(defaultBatchFilters);

  const all = Array.isArray(data) ? data : [];
  const filtered = useMemo(() => filterBatches(all, filters, range), [all, filters, range]);

  const stats = useMemo(() => {
    const produced = filtered.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    const waste = filtered.reduce((s, b) => s + (b.wastePercentage || 0), 0);
    const avgWaste = filtered.length ? (waste / filtered.length).toFixed(1) : "0.0";
    return { count: filtered.length, produced, avgWaste };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
        >
          ← Volver al Dashboard
        </button>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Rango: {rangeLabel(range)}
        </span>
      </div>

      {/* Resumen del subconjunto filtrado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Lotes encontrados</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Producción total</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.produced.toLocaleString("es-SV")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Residuos (promedio)</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.avgWaste}%</p>
        </div>
      </div>

      <SectionCard title="Todos los lotes">
        <BatchToolbar list={all} filters={filters} setFilters={setFilters} />
        <AsyncState loading={loading} error={error}>
          <BatchTable batches={filtered} />
        </AsyncState>
      </SectionCard>
    </div>
  );
}

export default HistorialLotes;
