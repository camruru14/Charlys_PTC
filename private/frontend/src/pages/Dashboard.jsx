import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange } from "../context/DateRangeContext";
import KpiCard from "../components/ui/KpiCard";
import DonutChart from "../components/ui/DonutChart";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import BatchToolbar from "../components/batches/BatchToolbar";
import BatchTable from "../components/batches/BatchTable";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import { IconFactory, IconFinance, IconOrders, IconAlert } from "../lib/icons";

const DONUT_COLORS = ["#2563eb", "#38bdf8", "#c7d2fe", "#818cf8", "#0ea5e9"];

function Dashboard() {
  const navigate = useNavigate();
  const range = useDateRange();

  // Resumen (KPIs, dona, alertas) filtrado por rango en el backend
  const dashPath = `/dashboard?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
  const { data, loading, error } = useFetch(dashPath);

  // Lotes completos para la card de historial (búsqueda/filtros en cliente)
  const { data: batchesData, loading: batchesLoading } = useFetch("/productionBatches");
  const [filters, setFilters] = useState(defaultBatchFilters);

  const kpis = data?.kpis || {};
  const productionMix = (data?.productionMix || []).map((d, i) => ({
    ...d,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const alerts = data?.alerts || [];

  const allBatches = Array.isArray(batchesData) ? batchesData : [];
  const filteredBatches = useMemo(
    () => filterBatches(allBatches, filters, range),
    [allBatches, filters, range],
  );

  const fmt = (v) => Number(v || 0).toLocaleString("es-SV");

  return (
    <div className="space-y-6">
      <AsyncState loading={loading} error={error}>
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Producción total" value={fmt(kpis.producedTotal)} icon={IconFactory} trend={{ tone: "blue", label: "unidades" }} />
            <KpiCard label="Ingresos" value={`$${fmt(kpis.income)}`} icon={IconFinance} trend={{ tone: "green", label: "en el rango" }} />
            <KpiCard label="Pedidos en curso" value={kpis.ordersInProgress ?? 0} icon={IconOrders} trend={{ tone: "blue", label: `${kpis.ordersReadyToShip ?? 0} listos` }} />
            <KpiCard label="Índice de residuos" value={`${kpis.wasteIndex ?? 0}%`} icon={IconAlert} trend={{ tone: (kpis.wasteIndex ?? 0) > 2.5 ? "yellow" : "green", label: (kpis.wasteIndex ?? 0) > 2.5 ? "Acción requerida" : "Estable" }} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Historial de lotes con búsqueda, filtros y "Ver todo" */}
            <SectionCard
              title="Historial de lotes"
              className="xl:col-span-2"
              action={
                <button
                  onClick={() => navigate("/historial-lotes")}
                  className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  Ver todo
                </button>
              }
            >
              <BatchToolbar list={allBatches} filters={filters} setFilters={setFilters} compact />
              {batchesLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">Cargando…</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <BatchTable batches={filteredBatches} />
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {filteredBatches.length} lote(s) en el rango y filtros seleccionados.
              </p>
            </SectionCard>

            {/* Widgets */}
            <div className="space-y-6">
              <SectionCard title="Producción por producto">
                {productionMix.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Sin datos en el rango.</p>
                ) : (
                  <DonutChart data={productionMix} centerLabel="100%" />
                )}
              </SectionCard>

              <SectionCard title="Alertas">
                {alerts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Sin alertas activas.</p>
                ) : (
                  <ul className="space-y-3">
                    {alerts.map((a, i) => (
                      <li key={i} className={`flex gap-3 rounded-xl p-3 ${a.tone === "red" ? "bg-red-50" : "bg-amber-50"}`}>
                        <IconAlert width={18} height={18} className={a.tone === "red" ? "mt-0.5 shrink-0 text-red-500" : "mt-0.5 shrink-0 text-amber-500"} />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{a.text}</p>
                          <p className="text-xs text-slate-400">{a.meta}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      </AsyncState>
    </div>
  );
}

export default Dashboard;
