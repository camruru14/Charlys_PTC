import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange } from "../context/dateRange";
import KpiCard from "../components/ui/KpiCard";
import DonutChart from "../components/ui/DonutChart";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import BatchToolbar from "../components/batches/BatchToolbar";
import BatchTable from "../components/batches/BatchTable";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import Button from "../components/ui/Button";
import { IconFactory, IconFinance, IconOrders, IconAlert } from "../lib/icons";
import { CHART_COLORS } from "../lib/tones";
import { getPageMeta } from "../lib/nav";

function Dashboard() {
  const navigate = useNavigate();
  const range = useDateRange();

  // Resumen (KPIs, dona, alertas) filtrado por rango en el backend
  // ("Todo" = sin rango => sin filtrar por fecha)
  const dashPath =
    range.from && range.to
      ? `/dashboard?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      : "/dashboard";
  const { data, loading, error } = useFetch(dashPath);

  // Lotes completos para la card de historial (búsqueda/filtros en cliente)
  const { data: batchesData, loading: batchesLoading } = useFetch("/productionBatches");
  const [filters, setFilters] = useState(defaultBatchFilters);

  const kpis = data?.kpis || {};
  const productionMix = (data?.productionMix || []).map((d, i) => ({
    ...d,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const alerts = data?.alerts || [];

  const allBatches = Array.isArray(batchesData) ? batchesData : [];
  const filteredBatches = useMemo(
    () => filterBatches(allBatches, filters, range),
    [allBatches, filters, range],
  );

  const fmt = (v) => Number(v || 0).toLocaleString("es-SV");

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta("/")} actions={<DateRangePicker />} />
      <AsyncState loading={loading} error={error}>
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Producción total" value={fmt(kpis.producedTotal)} icon={IconFactory} trend={{ tone: "blue", label: "unidades" }} />
            <KpiCard label="Ingresos" value={`$${fmt(kpis.income)}`} icon={IconFinance} trend={{ tone: "green", label: "en el rango" }} />
            <KpiCard label="Pedidos en curso" value={kpis.ordersInProgress ?? 0} icon={IconOrders} trend={{ tone: "blue", label: `${kpis.ordersReadyToShip ?? 0} listos` }} />
          </div>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
            {/* Historial de lotes con búsqueda, filtros y "Ver todo" */}
            <SectionCard
              title="Historial de lotes"
              className="self-start xl:col-span-2"
              action={
                <Button variant="soft" size="row" onClick={() => navigate("/historial-lotes")}>
                  Ver todo
                </Button>
              }
            >
              <BatchToolbar list={allBatches} filters={filters} setFilters={setFilters} compact />
              {batchesLoading ? (
                <div className="rounded-[12px] border border-dashed border-line bg-surface-2 p-8 text-center text-[13px] text-muted">Cargando…</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <BatchTable batches={filteredBatches} />
                </div>
              )}
              <p className="t-aux mt-3">
                {filteredBatches.length} lote(s) en el rango y filtros seleccionados.
              </p>
            </SectionCard>

            {/* Widgets */}
            <div className="flex flex-col gap-3.5">
              <SectionCard title="Producción por producto">
                {productionMix.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-subtle">Sin datos en el rango.</p>
                ) : (
                  <DonutChart data={productionMix} centerLabel="100%" />
                )}
              </SectionCard>

              <SectionCard title="Alertas">
                {alerts.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-subtle">Sin alertas activas.</p>
                ) : (
                  <ul className="space-y-3">
                    {alerts.map((a, i) => (
                      <li key={i} className={`flex gap-3 rounded-[11px] p-3 ${a.tone === "red" ? "bg-tone-rose" : "bg-tone-amber"}`}>
                        <IconAlert width={18} height={18} className={a.tone === "red" ? "mt-0.5 shrink-0 text-tone-rose-dot" : "mt-0.5 shrink-0 text-tone-amber-dot"} />
                        <div>
                          <p className="text-[13px] font-medium text-ink">{a.text}</p>
                          <p className="t-aux">{a.meta}</p>
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
