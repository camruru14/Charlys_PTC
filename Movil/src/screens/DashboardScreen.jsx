import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDashboard } from "../hooks/useDashboard";
import { useProductNames } from "../hooks/useProductNames";
import { useDateRange } from "../context/DateRangeContext";
import { useAuth } from "../hooks/useAuth";
import ChartLegend from "../components/dashboard/ChartLegend";
import ColumnChart from "../components/dashboard/ColumnChart";
import Donut from "../components/dashboard/Donut";
import HBarList from "../components/dashboard/HBarList";
import KpiTile from "../components/dashboard/KpiTile";
import LineChart from "../components/dashboard/LineChart";
import Card from "../components/ui/Card";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import { colors, tones } from "../lib/theme";
import { SERIES_COLORS, TARGET_COLOR } from "../lib/chartColors";
import { productColors } from "../lib/productColors";
import { fonts, type } from "../lib/typography";
import { formatCompactMoney, formatMoney, formatNumber, formatWeekdayDate } from "../lib/format";
import {
  change,
  dayDate,
  monthDate,
  monthOfRange,
  money,
  MONTHS_LONG,
  MONTHS_SHORT,
  ORDER_STAGES,
  previousLabel,
  rangeOf,
  units,
} from "../lib/dashboard";
import { todayLabel } from "../navigation/navItems";
import { useBottomPad } from "../hooks/useBottomPad";

const TONE_COLOR = { up: tones.green.text, down: tones.rose.text, flat: colors.muted };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Serie acumulada: cada punto es la suma hasta ese casillero (igual que cumulative() de la web).
function cumulative(values = []) {
  let total = 0;
  return values.map((v) => (total += Number(v) || 0));
}

// «+8%» en verde o rosa seguido del texto de comparación (igual que ChangeNote de la web).
function ChangeNote({ value, previous, label }) {
  const c = change(value, previous);
  if (!c) return label || "sin período anterior";
  return (
    <Text>
      <Text style={[styles.noteStrong, { color: TONE_COLOR[c.tone] }]}>{c.text}</Text> {label}
    </Text>
  );
}

// Tarjeta de sección: título (con subtítulo y un enlace opcional) y el cuerpo, o «Sin datos en este rango».
function Section({ title, subtitle, legend, link, onLink, empty, emptyText = "Sin datos en este rango", children }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitles}>
          <Text style={type.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardAux}>{subtitle}</Text> : null}
        </View>
        {legend ? <ChartLegend items={legend} /> : null}
        {link ? (
          <Pressable onPress={onLink} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>{link}</Text>
          </Pressable>
        ) : null}
      </View>
      {empty ? <Text style={styles.placeholder}>{emptyText}</Text> : children}
    </Card>
  );
}

// Dashboard: resumen ejecutivo del rango (GET /dashboard), lo mismo que
// Web/private/frontend/src/pages/Dashboard.jsx en una sola columna: 4 tarjetas KPI en 2×2, ventas y
// gastos de 12 meses, ventas por producto, producción diaria, pedidos activos y gastos por categoría.
export default function DashboardScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const range = useDateRange();
  const { user } = useAuth();
  const { dashboard, kpis, sparks, monthly, salesByProduct, dailyProduction, activeOrders, expensesByCategory, loading, refreshing, error, refresh } =
    useDashboard(range);

  // Globo de las gráficas: una sola activa a la vez ({ chart, index }). Tocar fuera de ella (o
  // desplazar la pantalla) lo quita: cada gráfica marca `touchedChart` al recibir el toque y el
  // contenedor raíz, que lo ve después (los toques suben de hijo a padre), cierra el resto.
  const [active, setActive] = useState(null);
  const touchedChart = useRef(null);
  const select = (chart) => (index) => setActive(index == null ? null : { chart, index });
  const selectedOf = (chart) => (active?.chart === chart ? active.index : null);
  const chartProps = (chart) => ({ selected: selectedOf(chart), onSelect: select(chart) });
  const onChartTouch = (chart) => () => {
    touchedChart.current = chart;
  };
  const onRootTouch = () => {
    if (touchedChart.current !== active?.chart) setActive(null);
    touchedChart.current = null;
  };

  const firstName = (user?.name || "").trim().split(/\s+/)[0];
  useLayoutEffect(() => {
    navigation.setOptions({
      title: firstName ? `Hola, ${firstName}` : "Dashboard",
      subtitle: todayLabel(),
    });
  }, [navigation, firstName]);

  const { products: catalog } = useProductNames();
  const colorOf = useMemo(() => productColors(catalog), [catalog]);

  if (loading) return <LoadingState />;
  if (error && !dashboard) return <ErrorState message={error} onRetry={refresh} />;

  const isMonth = Boolean(monthOfRange(range));
  const compareTo = previousLabel(dashboard?.range);
  const now = new Date();

  // ---- KPIs ----
  const netColor = kpis.net > 0 ? tones.green.text : kpis.net < 0 ? tones.rose.text : colors.ink;
  const unitsPct = kpis.unitsTarget > 0 ? Math.round((kpis.unitsProduced / kpis.unitsTarget) * 100) : null;
  const onTimePct = kpis.delivered > 0 ? Math.round((kpis.deliveredOnTime / kpis.delivered) * 100) : null;

  // ---- Ventas y gastos por mes ----
  const lastMonth = monthly[monthly.length - 1];
  // «Oct», «Nov»…; el primero lleva el año («Oct 25») si es de otro año que el último mes.
  const lastYear = lastMonth ? monthDate(lastMonth.month).getFullYear() : null;
  const monthLabels = monthly.map((m, i) => {
    const d = monthDate(m.month);
    const name = capitalize(MONTHS_SHORT[d.getMonth()]);
    return i === 0 && d.getFullYear() !== lastYear ? `${name} ${String(d.getFullYear()).slice(2)}` : name;
  });
  const monthlyEmpty = monthly.every((m) => m.income === 0 && m.expense === 0);

  // ---- Ventas por producto ----
  const productTotal = salesByProduct.reduce((s, p) => s + p.amount, 0);
  const donutData = salesByProduct.map((p) => ({ key: p.product, label: p.product, value: p.amount, color: colorOf(p.product) }));
  const orderCount = dashboard?.salesOrders || 0;

  // ---- Producción diaria ----
  const productionData = dailyProduction.map((p, i) => {
    const d = dayDate(p.date);
    const monthChanged = i === 0 || dayDate(dailyProduction[i - 1].date).getMonth() !== d.getMonth();
    return { key: p.date, label: monthChanged ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : String(d.getDate()), value: p.produced, target: p.target };
  });

  // ---- Pedidos activos ----
  const stagesTotal = activeOrders.reduce((s, r) => s + r.count, 0);
  const stageRows = activeOrders.map((s) => ({
    key: s.status,
    label: ORDER_STAGES[s.status]?.label || s.status,
    value: s.count,
    display: formatNumber(s.count),
    onPress: () => navigation.navigate("Pedidos", { estado: ORDER_STAGES[s.status]?.key || "", at: Date.now() }),
  }));
  const stagesSubtitle = stagesTotal || kpis.delivered ? `${formatNumber(stagesTotal)} sin entregar · ${formatNumber(kpis.delivered || 0)} entregados` : undefined;

  // ---- Gastos por categoría ----
  const expensesTotal = expensesByCategory.reduce((s, e) => s + e.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, bottomPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onScrollBeginDrag={() => setActive(null)}
    >
      <View onTouchStart={onRootTouch}>
        <View style={styles.kpiRow}>
          <KpiTile
            style={styles.kpiHalf}
            label={isMonth ? "Ventas del mes" : "Ventas"}
            value={money(kpis.sales || 0)}
            note={<ChangeNote value={kpis.sales || 0} previous={kpis.salesPrevious} label={compareTo} />}
            spark={cumulative(sparks.sales)}
            color={SERIES_COLORS.sales}
            sparkLabel="Ventas acumuladas en el rango"
          />
          <KpiTile
            style={styles.kpiHalf}
            label="Utilidad"
            value={`${kpis.net > 0 ? "+" : ""}${money(kpis.net || 0)}`}
            valueColor={netColor}
            note={kpis.margin == null ? "sin ingresos en el rango" : `${Math.round(kpis.margin * 100)}% de las ventas`}
            spark={cumulative(sparks.net)}
            color={SERIES_COLORS.positive}
            sparkLabel="Utilidad neta acumulada en el rango"
          />
        </View>
        <View style={[styles.kpiRow, styles.kpiRowGap]}>
          <KpiTile
            style={styles.kpiHalf}
            label="Producidas"
            value={units(kpis.unitsProduced)}
            note={
              unitsPct == null ? (
                "sin meta en el rango"
              ) : (
                <Text style={[styles.noteStrong, { color: unitsPct < 100 ? tones.amber.text : tones.green.text }]}>{unitsPct}% de la meta</Text>
              )
            }
            spark={sparks.units}
            color={SERIES_COLORS.sales}
            sparkLabel="Unidades producidas por día del rango"
          />
          <KpiTile
            style={styles.kpiHalf}
            label="A tiempo"
            value={onTimePct == null ? "—" : `${onTimePct}%`}
            note={kpis.delivered > 0 ? `${formatNumber(kpis.deliveredOnTime)} de ${formatNumber(kpis.delivered)} entregas` : "sin entregas en el rango"}
            spark={sparks.onTime}
            color={SERIES_COLORS.positive}
            sparkLabel="Porcentaje de entregas a tiempo por semana del rango"
          />
        </View>

        <Section
          title="Ventas y gastos"
          subtitle={lastMonth?.partial ? "Últimos 12 meses · el mes actual va incompleto" : "Últimos 12 meses"}
          legend={[
            { key: "income", label: "Ventas", color: SERIES_COLORS.sales },
            { key: "expense", label: "Gastos", color: SERIES_COLORS.expense },
          ]}
          empty={monthlyEmpty}
        >
          <View onTouchStart={onChartTouch("monthly")}>
            <LineChart
              {...chartProps("monthly")}
              legend={false}
              labels={monthLabels}
              series={[
                { key: "income", label: "Ventas", color: SERIES_COLORS.sales, values: monthly.map((m) => m.income), fill: true },
                { key: "expense", label: "Gastos", color: SERIES_COLORS.expense, values: monthly.map((m) => m.expense) },
              ]}
              partialLast={Boolean(lastMonth?.partial)}
              formatAxis={formatCompactMoney}
              accessibilityLabel={`Ventas y gastos de los últimos 12 meses. ${
                lastMonth ? `${MONTHS_LONG[monthDate(lastMonth.month).getMonth()]}: ventas ${money(lastMonth.income)}, gastos ${money(lastMonth.expense)}.` : ""
              }`}
              tooltip={(i) => {
                const m = monthly[i];
                const d = monthDate(m.month);
                const net = m.income - m.expense;
                return {
                  title: `${capitalize(MONTHS_LONG[d.getMonth()])} ${d.getFullYear()}${m.partial ? " · en curso" : ""}`,
                  rows: [
                    { color: SERIES_COLORS.sales, label: "Ventas", value: money(m.income) },
                    { color: SERIES_COLORS.expense, label: "Gastos", value: money(m.expense) },
                    { label: "Neto", value: `${net > 0 ? "+" : ""}${money(net)}`, valueColor: net > 0 ? tones.green.text : net < 0 ? tones.rose.text : colors.ink },
                  ],
                };
              }}
            />
          </View>
        </Section>

        <Section title="Ventas por producto" subtitle={`Pedidos ${rangeOf(range, now)}`} empty={productTotal === 0}>
          <View style={styles.donutRow}>
            <Donut
              data={donutData}
              size={112}
              centerLabel={money(productTotal)}
              centerCaption={`${formatNumber(orderCount)} ${orderCount === 1 ? "pedido" : "pedidos"}`}
              accessibilityLabel={`Ventas por producto: ${salesByProduct.map((p) => `${p.product} ${money(p.amount)}`).join(", ")}`}
            />
            <View style={styles.legend}>
              {salesByProduct.map((p) => (
                <View key={p.product} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: colorOf(p.product) }]} />
                  <Text style={styles.legendName} numberOfLines={1}>
                    {p.product}
                  </Text>
                  <Text style={styles.legendPct}>{Math.round((p.amount / productTotal) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Section>

        <Section
          title="Producción diaria"
          subtitle={kpis.unitsProduced > 0 ? `${formatNumber(kpis.unitsProduced)} unidades${unitsPct == null ? "" : ` · ${unitsPct}% de la meta`}` : undefined}
          legend={[
            { key: "produced", label: "Producido", color: SERIES_COLORS.sales, shape: "square" },
            { key: "target", label: "Meta", color: TARGET_COLOR, shape: "square" },
          ]}
          empty={dailyProduction.length === 0}
        >
          <View onTouchStart={onChartTouch("production")}>
            <ColumnChart
              {...chartProps("production")}
              data={productionData}
              color={SERIES_COLORS.sales}
              accessibilityLabel={`Producción diaria: ${dailyProduction.length} días con lotes, ${formatNumber(kpis.unitsProduced)} unidades en total.`}
              tooltip={(i) => {
                const p = dailyProduction[i];
                return {
                  title: capitalize(formatWeekdayDate(dayDate(p.date))),
                  rows: [
                    { color: SERIES_COLORS.sales, label: "Producido", value: formatNumber(p.produced) },
                    ...(p.target > 0
                      ? [
                          { color: TARGET_COLOR, label: "Meta", value: formatNumber(p.target) },
                          { label: "De la meta", value: `${Math.round((p.produced / p.target) * 100)}%` },
                        ]
                      : []),
                  ],
                };
              }}
            />
          </View>
        </Section>

        <Section
          title="Pedidos activos"
          subtitle={stagesSubtitle}
          link="Pedidos ›"
          onLink={() => navigation.navigate("Pedidos")}
          empty={stagesTotal === 0}
          emptyText="No hay pedidos activos"
        >
          <HBarList
            rows={stageRows}
            color={SERIES_COLORS.sales}
            accessibilityLabel={`Pedidos activos por etapa: ${activeOrders.map((s) => `${ORDER_STAGES[s.status]?.label || s.status} ${s.count}`).join(", ")}`}
          />
        </Section>

        <Section
          title="Gastos por categoría"
          subtitle={expensesByCategory.length ? `${formatMoney(expensesTotal, 0)} pagados` : undefined}
          link="Finanzas ›"
          onLink={() => navigation.navigate("Finanzas")}
          empty={expensesByCategory.length === 0}
        >
          <HBarList
            rows={expensesByCategory.map((e) => ({ key: e.category, label: e.category, value: e.amount, display: formatMoney(e.amount, 0) }))}
            color={SERIES_COLORS.expense}
            accessibilityLabel={`Gastos por categoría: ${expensesByCategory.map((e) => `${e.category} ${formatMoney(e.amount, 0)}`).join(", ")}`}
          />
        </Section>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiRowGap: { marginTop: 10 },
  kpiHalf: { flex: 1 },
  noteStrong: { fontFamily: fonts.semibold },
  card: { marginTop: 12, marginBottom: 0 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  cardTitles: { flex: 1 },
  cardAux: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  placeholder: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 14, textAlign: "center" },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  legendPct: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
});
