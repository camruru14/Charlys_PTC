import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useProductNames } from "../hooks/useProductNames";
import { useFillHeight } from "../hooks/useFillHeight";
import { useWideLayout } from "../hooks/useWideLayout";
import { useElementSize } from "../hooks/useElementSize";
import { useDateRange } from "../context/dateRange";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import ChartCard from "../components/charts/ChartCard";
import ChartLegend from "../components/charts/ChartLegend";
import ColumnChart from "../components/charts/ColumnChart";
import Donut from "../components/charts/Donut";
import HBarList from "../components/charts/HBarList";
import LineChart from "../components/charts/LineChart";
import Sparkline from "../components/charts/Sparkline";
import { TooltipRow } from "../components/charts/ChartTooltip";
import { SERIES_COLORS, TARGET_COLOR } from "../lib/chartColors";
import { productColors } from "../lib/productColors";
import { change, dashboardRange, dayDate, monthDate, monthOfRange, money, ORDER_STAGES, previousLabel, rangeWhen } from "../lib/dashboard";
import { fmtCompactMoney, fmtMoney, fmtNumber, fmtWeekdayDate } from "../lib/format";
import { getPageMeta } from "../lib/nav";

// Alto mínimo del bloque con las tarjetas: más bajo que el predeterminado para que una ventana de
// 1366×768 siga sin scroll (las gráficas se miden y se ajustan a lo que quede).
const MIN_HEIGHT = 440;

// Serie acumulada: cada punto es la suma hasta ese casillero (la línea sube suave).
function cumulative(values = []) {
  let total = 0;
  return values.map((v) => (total += Number(v) || 0));
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const linkClass = "text-[12.5px] font-semibold text-primary hover:text-primary-hover";
const TONE_CLASS = { up: "text-tone-green-text", down: "text-tone-rose-text", flat: "text-muted" };

// Tarjeta KPI: etiqueta, valor grande con la mini gráfica a la derecha y, abajo, la línea de comparación.
function Kpi({ label, value, valueClass = "text-ink", note, spark, color, sparkLabel }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-line bg-surface px-5 py-3">
      <p className="t-label truncate">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <p className={`truncate text-[24px] font-bold leading-none tabular-nums ${valueClass}`}>{value}</p>
        <Sparkline data={spark} color={color} ariaLabel={sparkLabel} />
      </div>
      <p className="truncate text-[12px] text-muted">{note}</p>
    </div>
  );
}

// «+8%» en verde o rosa seguido del texto de comparación.
function ChangeNote({ value, previous, label }) {
  const c = change(value, previous);
  if (!c) return <span>{label || "sin período anterior"}</span>;
  return (
    <>
      <span className={`font-semibold ${TONE_CLASS[c.tone]}`}>{c.text}</span> {label}
    </>
  );
}

// Dona de ventas por producto + lista. Con alto de sobra, la lista va debajo de la dona; si el alto
// es corto (1366×768), la dona va a la izquierda y la lista a la derecha para que nada se corte.
const LIST_ROW = 22;
const STACK_MIN_HEIGHT = 120 + 8 + LIST_ROW * 6;

function ProductsDonut({ products, total, orders, colorOf }) {
  const [activeProduct, setActiveProduct] = useState(null);
  const [ref, { width, height }] = useElementSize();
  const stacked = height >= STACK_MIN_HEIGHT || !height;
  const listHeight = products.length * LIST_ROW;
  const size = stacked ? Math.max(80, Math.min(width, height - listHeight - 8, 150)) : Math.max(80, Math.min(height, Math.floor(width * 0.42), 128));
  const thickness = size < 100 ? 13 : size < 130 ? 16 : 20;
  const donutData = products.map((p) => ({ key: p.product, label: p.product, value: p.amount, color: colorOf(p.product) }));

  const donut = (
    <Donut
      data={donutData}
      size={size}
      thickness={thickness}
      centerLabel={money(total)}
      centerCaption={`${fmtNumber(orders)} ${orders === 1 ? "pedido" : "pedidos"}`}
      activeKey={activeProduct}
      onActiveChange={setActiveProduct}
      ariaLabel={`Ventas por producto: ${products.map((p) => `${p.product} ${money(p.amount)}`).join(", ")}`}
      renderTooltip={(seg) => <TooltipRow color={seg.color} label={seg.label} value={`${money(seg.value)} · ${Math.round((seg.value / total) * 100)}%`} />}
    />
  );
  const list = (
    <ul className={`text-[12px] ${stacked ? "w-full shrink-0" : "min-w-0 flex-1"}`}>
      {products.map((p) => (
        <li
          key={p.product}
          onPointerEnter={() => setActiveProduct(p.product)}
          onPointerLeave={() => setActiveProduct(null)}
          className={`flex items-center gap-2 rounded-[6px] px-1 ${activeProduct === p.product ? "bg-surface-2" : ""}`}
          style={{ height: LIST_ROW }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(p.product) }} />
          <span className="min-w-0 flex-1 truncate text-ink-2" title={p.product}>
            {p.product}
          </span>
          <span className="font-semibold tabular-nums text-ink">{money(p.amount)}</span>
          <span className="w-9 shrink-0 text-right tabular-nums text-muted">{Math.round((p.amount / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={ref} className={`flex min-h-[260px] min-w-0 flex-1 xl:min-h-0 ${stacked ? "flex-col items-center gap-2" : "items-center gap-4"}`}>
      {width > 0 ? (
        stacked ? (
          <>
            <div className="flex min-h-0 flex-1 items-center">{donut}</div>
            {list}
          </>
        ) : (
          <>
            {donut}
            {list}
          </>
        )
      ) : null}
    </div>
  );
}

function Dashboard() {
  const range = useDateRange();
  const wide = useWideLayout();
  const gridRef = useRef(null);
  const gridHeight = useFillHeight(gridRef, wide, MIN_HEIGHT);

  const query = dashboardRange(range);
  const path = query.from && query.to ? `/dashboard?from=${query.from.toISOString()}&to=${query.to.toISOString()}` : "/dashboard";
  const { data, loading, error } = useFetch(path);
  const initial = loading && !data;

  const kpis = data?.kpis || {};
  const sparks = data?.sparks || {};
  const monthly = data?.monthly || [];
  const products = data?.salesByProduct || [];
  const production = data?.dailyProduction || [];
  const stages = data?.activeOrders || [];
  const expenses = data?.expensesByCategory || [];
  const { products: catalog } = useProductNames();
  const colorOf = useMemo(() => productColors(catalog), [catalog]);

  const isMonth = Boolean(monthOfRange(range));
  const when = rangeWhen(range);
  const compareTo = previousLabel(data?.range);

  // ---- KPIs ----
  const netTone = kpis.net > 0 ? "text-tone-green-text" : kpis.net < 0 ? "text-tone-rose-text" : "text-ink";
  const unitsPct = kpis.unitsTarget > 0 ? Math.round((kpis.unitsProduced / kpis.unitsTarget) * 100) : null;
  const onTimePct = kpis.delivered > 0 ? Math.round((kpis.deliveredOnTime / kpis.delivered) * 100) : null;

  // ---- Ventas y gastos por mes ----
  const lastMonth = monthly[monthly.length - 1];
  // «Oct», «Nov»…; el primero lleva el año («Oct 25») si es de otro año que el último mes.
  const lastYear = lastMonth ? monthDate(lastMonth.month).getFullYear() : null;
  const monthLabels = monthly.map((m, i) => {
    const d = monthDate(m.month);
    const name = MONTHS[d.getMonth()][0].toUpperCase() + MONTHS[d.getMonth()].slice(1);
    return i === 0 && d.getFullYear() !== lastYear ? `${name} ${String(d.getFullYear()).slice(2)}` : name;
  });
  const monthlyEmpty = monthly.every((m) => m.income === 0 && m.expense === 0);

  // ---- Ventas por producto ----
  const productTotal = products.reduce((s, p) => s + p.amount, 0);

  // ---- Producción diaria ----
  const productionData = production.map((p, i) => {
    const d = dayDate(p.date);
    const monthChanged = i === 0 || dayDate(production[i - 1].date).getMonth() !== d.getMonth();
    return { key: p.date, label: monthChanged ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : String(d.getDate()), value: p.produced, target: p.target };
  });

  // ---- Pedidos activos ----
  const stageRows = stages.map((s) => ({
    key: s.status,
    label: ORDER_STAGES[s.status]?.label || s.status,
    value: s.count,
    display: fmtNumber(s.count),
    to: `/pedidos?estado=${ORDER_STAGES[s.status]?.key || "todos"}`,
  }));
  const stagesTotal = stages.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta("/")} actions={<DateRangePicker />} />

      <div ref={gridRef} style={{ height: wide ? (gridHeight ?? undefined) : undefined }} className="flex min-h-0 flex-col gap-3.5">
        {/* Fila 1 · KPIs */}
        <div className="grid shrink-0 grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label={isMonth ? "Ventas del mes" : "Ventas"}
            value={initial ? "—" : money(kpis.sales || 0)}
            note={<ChangeNote value={kpis.sales || 0} previous={kpis.salesPrevious} label={compareTo} />}
            spark={cumulative(sparks.sales)}
            color={SERIES_COLORS.sales}
            sparkLabel="Ventas acumuladas en el rango"
          />
          <Kpi
            label="Utilidad neta"
            value={initial ? "—" : `${kpis.net > 0 ? "+" : ""}${money(kpis.net || 0)}`}
            valueClass={netTone}
            note={kpis.margin == null ? "sin ingresos en el rango" : `${Math.round(kpis.margin * 100)}% de las ventas`}
            spark={cumulative(sparks.net)}
            color={SERIES_COLORS.positive}
            sparkLabel="Utilidad neta acumulada en el rango"
          />
          <Kpi
            label="Unidades producidas"
            value={initial ? "—" : fmtNumber(kpis.unitsProduced)}
            note={
              unitsPct == null ? (
                "sin meta en el rango"
              ) : (
                <span className={unitsPct < 100 ? "font-semibold text-tone-amber-text" : "font-semibold text-tone-green-text"}>{unitsPct}% de la meta</span>
              )
            }
            spark={sparks.units}
            color={SERIES_COLORS.sales}
            sparkLabel="Unidades producidas por día del rango"
          />
          <Kpi
            label="Entregas a tiempo"
            value={initial ? "—" : onTimePct == null ? "—" : `${onTimePct}%`}
            note={kpis.delivered > 0 ? `${fmtNumber(kpis.deliveredOnTime)} de ${fmtNumber(kpis.delivered)} entregas` : "sin entregas en el rango"}
            spark={sparks.onTime}
            color={SERIES_COLORS.positive}
            sparkLabel="Porcentaje de entregas a tiempo por semana del rango"
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 xl:grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Fila 2 · ventas y gastos por mes + ventas por producto */}
          <div className="grid min-h-0 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ChartCard
              title="Ventas y gastos por mes"
              subtitle={lastMonth?.partial ? "Últimos 12 meses · el mes actual va incompleto" : "Últimos 12 meses"}
              action={
                <ChartLegend
                  items={[
                    { key: "income", label: "Ventas", color: SERIES_COLORS.sales },
                    { key: "expense", label: "Gastos", color: SERIES_COLORS.expense },
                  ]}
                />
              }
              loading={initial}
              error={error}
              empty={monthlyEmpty}
            >
              <LineChart
                labels={monthLabels}
                legend={false}
                series={[
                  { key: "income", label: "Ventas", color: SERIES_COLORS.sales, values: monthly.map((m) => m.income), fill: true },
                  { key: "expense", label: "Gastos", color: SERIES_COLORS.expense, values: monthly.map((m) => m.expense) },
                ]}
                partialLast={Boolean(lastMonth?.partial)}
                formatAxis={fmtCompactMoney}
                ariaLabel={`Ventas y gastos de los últimos 12 meses. ${lastMonth ? `${MONTHS_LONG[monthDate(lastMonth.month).getMonth()]}: ventas ${money(lastMonth.income)}, gastos ${money(lastMonth.expense)}.` : ""}`}
                renderTooltip={(i) => {
                  const m = monthly[i];
                  const d = monthDate(m.month);
                  const net = m.income - m.expense;
                  return (
                    <>
                      <p className="mb-1 font-semibold text-ink">
                        {MONTHS_LONG[d.getMonth()][0].toUpperCase() + MONTHS_LONG[d.getMonth()].slice(1)} {d.getFullYear()}
                        {m.partial ? <span className="font-normal text-muted"> · en curso</span> : null}
                      </p>
                      <TooltipRow color={SERIES_COLORS.sales} label="Ventas" value={fmtMoney(m.income, 0)} />
                      <TooltipRow color={SERIES_COLORS.expense} label="Gastos" value={fmtMoney(m.expense, 0)} />
                      <TooltipRow label="Neto" value={`${net > 0 ? "+" : ""}${fmtMoney(net, 0)}`} valueClass={net > 0 ? "text-tone-green-text" : net < 0 ? "text-tone-rose-text" : "text-ink"} />
                    </>
                  );
                }}
              />
            </ChartCard>

            <ChartCard title="Ventas por producto" subtitle={`Pedidos ${when === "en el rango" ? "del rango" : when === "este mes" ? "de este mes" : when.replace("en ", "de ")}`} loading={initial} error={error} empty={productTotal === 0}>
              <ProductsDonut products={products} total={productTotal} orders={data?.salesOrders || 0} colorOf={colorOf} />
            </ChartCard>
          </div>

          {/* Fila 3 · producción diaria, pedidos activos y gastos por categoría */}
          <div className="grid min-h-0 grid-cols-1 gap-3.5 xl:grid-cols-3">
            <ChartCard
              title="Producción diaria"
              subtitle={kpis.unitsProduced > 0 ? `${fmtNumber(kpis.unitsProduced)} unidades${unitsPct == null ? "" : ` · ${unitsPct}% de la meta`}` : undefined}
              action={
                <ChartLegend
                  items={[
                    { key: "produced", label: "Producido", color: SERIES_COLORS.sales, shape: "square" },
                    { key: "target", label: "Meta", color: TARGET_COLOR, shape: "square" },
                  ]}
                />
              }
              loading={initial}
              error={error}
              empty={production.length === 0}
            >
              <ColumnChart
                data={productionData}
                color={SERIES_COLORS.sales}
                ariaLabel={`Producción diaria: ${production.length} días con lotes, ${fmtNumber(kpis.unitsProduced)} unidades en total.`}
                renderTooltip={(i) => {
                  const p = production[i];
                  return (
                    <>
                      <p className="mb-1 font-semibold text-ink first-letter:uppercase">{fmtWeekdayDate(dayDate(p.date))}</p>
                      <TooltipRow color={SERIES_COLORS.sales} label="Producido" value={fmtNumber(p.produced)} />
                      {p.target > 0 ? (
                        <>
                          <TooltipRow color={TARGET_COLOR} label="Meta" value={fmtNumber(p.target)} />
                          <TooltipRow label="De la meta" value={`${Math.round((p.produced / p.target) * 100)}%`} />
                        </>
                      ) : null}
                    </>
                  );
                }}
              />
            </ChartCard>

            <ChartCard title="Pedidos activos por etapa" subtitle={stagesTotal ? `${fmtNumber(stagesTotal)} sin entregar` : undefined} loading={initial} error={error} empty={stagesTotal === 0} emptyText="No hay pedidos activos">
              <HBarList
                rows={stageRows}
                color={SERIES_COLORS.sales}
                ariaLabel={`Pedidos activos por etapa: ${stages.map((s) => `${ORDER_STAGES[s.status]?.label || s.status} ${s.count}`).join(", ")}`}
              />
              <p className="mt-2 shrink-0 border-t border-line-soft pt-2 text-[12px] text-muted">
                Entregados {when}: <span className="font-semibold text-ink">{fmtNumber(kpis.delivered)}</span>
                {kpis.delivered > 0 ? ` · ${fmtNumber(kpis.avgDeliveryDays, 1)} días en promedio` : ""}
              </p>
            </ChartCard>

            <ChartCard
              title="Gastos por categoría"
              subtitle={expenses.length ? `${fmtMoney(expenses.reduce((s, e) => s + e.amount, 0), 0)} pagados` : undefined}
              action={
                <Link to="/finanzas" className={linkClass}>
                  Finanzas ›
                </Link>
              }
              loading={initial}
              error={error}
              empty={expenses.length === 0}
            >
              <HBarList
                rows={expenses.map((e) => ({ key: e.category, label: e.category, value: e.amount, display: fmtMoney(e.amount, 0) }))}
                color={SERIES_COLORS.expense}
                ariaLabel={`Gastos por categoría: ${expenses.map((e) => `${e.category} ${fmtMoney(e.amount, 0)}`).join(", ")}`}
              />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
