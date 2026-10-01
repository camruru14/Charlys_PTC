import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange } from "../context/dateRange";
import KpiCard from "../components/ui/KpiCard";
import DonutChart from "../components/ui/DonutChart";
import DataTable from "../components/ui/DataTable";
import SearchInput from "../components/ui/SearchInput";
import StatusPill from "../components/ui/StatusPill";
import ColorSwatch from "../components/ui/ColorSwatch";
import { FilterSelect } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import { filterBatches, defaultBatchFilters, batchFilterOptions } from "../lib/batchFilters";
import { batchState, batchStart } from "../lib/batchFlow";
import { dashboardAlerts } from "../lib/dashboardAlerts";
import { IconFactory, IconDollar, IconOrders } from "../lib/icons";
import { CHART_COLORS } from "../lib/tones";
import { fmtNumber, fmtMoney, fmtDateYear, fmtPercent } from "../lib/format";
import { getPageMeta } from "../lib/nav";

const filterSelectClass =
  "h-9 min-w-[132px] rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2";
const linkClass = "text-[12.5px] font-semibold text-primary hover:text-primary-hover";

const batchColumns = [
  { key: "batchNumber", label: "Lote", render: (b) => <span className="t-row-name tabular-nums">{b.batchNumber}</span> },
  {
    key: "date",
    label: "Fecha",
    render: (b) => <span className="whitespace-nowrap tabular-nums">{fmtDateYear(batchStart(b)?.date || b.createdAt)}</span>,
  },
  { key: "product", label: "Producto", render: (b) => b.product || "—" },
  {
    key: "color",
    label: "Color",
    render: (b) => (
      <span className="flex items-center gap-2">
        <ColorSwatch color={b.color} />
        {b.color || "—"}
      </span>
    ),
  },
  { key: "line", label: "Línea", render: (b) => <span className="whitespace-nowrap">{b.productionLine || "—"}</span> },
  { key: "produced", label: "Producido", align: "right", render: (b) => fmtNumber(b.producedQuantity) },
  { key: "status", label: "Estado", render: (b) => <StatusPill status={batchState(b)} domain="lote" /> },
];

// Variación de ingresos contra el rango anterior; solo si se puede calcular.
function IncomeChange({ income, previous }) {
  if (previous == null || !(previous > 0)) return null;
  const ratio = (income - previous) / previous;
  const tone = ratio > 0 ? "text-tone-green-text" : ratio < 0 ? "text-tone-rose-text" : "text-muted";
  return <span className={`font-semibold ${tone}`}>{fmtPercent(ratio)}</span>;
}

function AlertRow({ alert }) {
  return (
    <li>
      <Link to={alert.to} className="flex gap-3 rounded-[10px] px-2.5 py-2 transition hover:bg-surface-2">
        <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${alert.tone === "amber" ? "bg-tone-amber-dot" : "bg-tone-rose-dot"}`} />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink">{alert.title}</span>
          {alert.detail ? <span className="block text-[11.5px] text-muted">{alert.detail}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/*
  Dashboard: KPIs del rango (GET /dashboard), historial de lotes con filtros,
  producción por producto y alertas que enlazan a la pantalla donde se
  resuelven (ver lib/dashboardAlerts.js).
*/
function Dashboard() {
  const range = useDateRange();

  const dashPath =
    range.from && range.to
      ? `/dashboard?from=${range.from.toISOString()}&to=${range.to.toISOString()}`
      : "/dashboard";
  const { data, loading, error } = useFetch(dashPath);
  const { data: batchesData, loading: batchesLoading, error: batchesError } = useFetch("/productionBatches");
  const { data: inventoryData } = useFetch("/inventory");
  const { data: ordersData } = useFetch("/orders");

  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [line, setLine] = useState("");

  const kpis = data?.kpis || {};
  const productionMix = (data?.productionMix || []).map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const producedInMix = productionMix.reduce((s, d) => s + d.value, 0);

  const allBatches = useMemo(() => (Array.isArray(batchesData) ? batchesData : []), [batchesData]);
  const inRange = useMemo(() => filterBatches(allBatches, defaultBatchFilters, range), [allBatches, range]);
  const options = useMemo(() => batchFilterOptions(inRange), [inRange]);
  const visible = useMemo(
    () => filterBatches(inRange, { ...defaultBatchFilters, q: query.trim(), product, line }),
    [inRange, query, product, line],
  );

  const alerts = useMemo(
    () =>
      dashboardAlerts({
        batches: allBatches,
        inventory: Array.isArray(inventoryData) ? inventoryData : [],
        orders: Array.isArray(ordersData) ? ordersData : [],
      }),
    [allBatches, inventoryData, ordersData],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta("/")} actions={<DateRangePicker />} />

      <AsyncState loading={loading} error={error}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="Producción total" value={fmtNumber(kpis.producedTotal)} note="unidades" icon={IconFactory} iconTone="blue" />
          <KpiCard
            label="Ingresos"
            value={fmtMoney(kpis.income, 0)}
            note={kpis.incomePrevious > 0 ? "vs. rango anterior" : "en el rango"}
            extra={<IncomeChange income={kpis.income || 0} previous={kpis.incomePrevious} />}
            icon={IconDollar}
            iconTone="green"
          />
          <KpiCard
            label="Pedidos en curso"
            value={fmtNumber(kpis.ordersInProgress)}
            note={`${fmtNumber(kpis.ordersReadyToShip)} listos`}
            icon={IconOrders}
            iconTone="teal"
          />
        </div>
      </AsyncState>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <SectionCard
          title="Historial de lotes"
          className="self-start xl:col-span-2"
          action={<Link to="/historial-lotes" className={linkClass}>Ver todo</Link>}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar lote" className="w-full sm:w-[220px]" />
            <FilterSelect
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className={filterSelectClass}
              options={[{ value: "", label: "Producto: todos" }, ...options.products.map((p) => ({ value: p, label: p }))]}
            />
            <FilterSelect
              value={line}
              onChange={(e) => setLine(e.target.value)}
              className={filterSelectClass}
              options={[{ value: "", label: "Línea: todas" }, ...options.lines.map((l) => ({ value: l, label: l }))]}
            />
          </div>
          <AsyncState loading={batchesLoading} error={batchesError}>
            <div className="-mx-5 max-h-[396px] overflow-y-auto border-t border-line-soft">
              <DataTable columns={batchColumns} rows={visible} empty="No hay lotes con esos criterios." />
            </div>
          </AsyncState>
          <div className="-mx-5 -mb-5 mt-0 flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
            <span className="t-aux">
              {fmtNumber(visible.length)} de {fmtNumber(inRange.length)} lotes en el rango
            </span>
            <Link to="/historial-lotes" className={linkClass}>Ver historial completo</Link>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3.5">
          <SectionCard
            title="Producción por producto"
            action={producedInMix > 0 ? <span className="t-aux">{fmtNumber(producedInMix)} unidades en el rango</span> : null}
          >
            {productionMix.length === 0 || producedInMix === 0 ? (
              <p className="py-6 text-center text-[13px] text-subtle">Sin producción en el rango.</p>
            ) : (
              <DonutChart data={productionMix} centerLabel={fmtNumber(producedInMix)} centerCaption="unidades" />
            )}
          </SectionCard>

          <SectionCard
            title="Alertas"
            action={alerts.length ? <span className="t-aux font-semibold">{fmtNumber(alerts.length)} activas</span> : null}
          >
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-subtle">Sin alertas activas.</p>
            ) : (
              <ul className="-mx-2.5 -my-1 flex max-h-[360px] flex-col gap-0.5 overflow-y-auto">
                {alerts.map((a) => (
                  <AlertRow key={a.key} alert={a} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
