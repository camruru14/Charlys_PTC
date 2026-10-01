import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDashboard } from "../hooks/useDashboard";
import { useBatches } from "../hooks/useBatches";
import { useInventory } from "../hooks/useInventory";
import { useOrders } from "../hooks/useOrders";
import { useDateRange } from "../context/DateRangeContext";
import { useAuth } from "../hooks/useAuth";
import BatchRow from "../components/batches/BatchRow";
import DonutChart from "../components/dashboard/DonutChart";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import SearchField from "../components/ui/SearchField";
import SelectField from "../components/ui/SelectField";
import StatTile from "../components/ui/StatTile";
import { chartColors, colors, getTone, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatMoney, formatNumber, formatPercent } from "../lib/format";
import { defaultBatchFilters, batchFilterOptions, filterBatches } from "../lib/batchFilters";
import { dashboardAlerts } from "../lib/dashboardAlerts";
import { todayLabel } from "../navigation/navItems";

// Lotes que se muestran en la tarjeta antes de "Ver historial completo".
const BATCHES_PREVIEW_LIMIT = 8;

// Ícono de cada tipo de alerta (lib/dashboardAlerts.js).
const ALERT_ICON = { stopped: "alert", lowStock: "box", incomplete: "truck" };

// Variación de ingresos contra el rango anterior; solo si se puede calcular
// (igual que IncomeChange en la web).
function incomeNote(income, previous) {
  if (previous == null || !(previous > 0)) return { text: "en el rango" };
  const ratio = (income - previous) / previous;
  const color = ratio > 0 ? tones.green.text : ratio < 0 ? tones.rose.text : colors.muted;
  return { change: formatPercent(ratio), color, text: "vs. rango anterior" };
}

function AlertRow({ alert, onPress }) {
  const tone = getTone(alert.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.alertRow, pressed && styles.pressed]}
    >
      <View style={[styles.alertIcon, { backgroundColor: tone.bg }]}>
        <Icon name={ALERT_ICON[alert.kind] || "alert"} size={17} color={tone.text} />
      </View>
      <View style={styles.alertTexts}>
        <Text style={styles.alertTitle} numberOfLines={2}>
          {alert.title}
        </Text>
        {alert.detail ? (
          <Text style={styles.alertDetail} numberOfLines={2}>
            {alert.detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={16} color={colors.chevron} />
    </Pressable>
  );
}

// Dashboard: KPIs del rango (GET /dashboard), alertas que llevan a la
// pantalla donde se resuelven, producción por producto e historial de lotes
// con filtros — lo mismo que Web/private/frontend/src/pages/Dashboard.jsx,
// filtrado por el rango de fechas global (chip del encabezado).
export default function DashboardScreen({ navigation }) {
  const range = useDateRange();
  const { user } = useAuth();
  const { dashboard, kpis, productionMix, loading, refreshing, error, refresh } = useDashboard(range);
  const { batches, loading: batchesLoading, refreshing: batchesRefreshing, error: batchesError, refresh: refreshBatches } =
    useBatches();
  const { items: inventory, refresh: refreshInventory } = useInventory();
  const { orders, refresh: refreshOrders } = useOrders();

  const [query, setQuery] = useState("");
  const [product, setProduct] = useState("");
  const [line, setLine] = useState("");

  const firstName = (user?.name || "").trim().split(/\s+/)[0];
  useLayoutEffect(() => {
    navigation.setOptions({
      title: firstName ? `Hola, ${firstName}` : "Dashboard",
      subtitle: todayLabel(),
    });
  }, [navigation, firstName]);

  const mix = productionMix.map((d, i) => ({ ...d, color: chartColors[i % chartColors.length] }));
  const producedInMix = mix.reduce((s, d) => s + d.value, 0);

  const inRange = useMemo(() => filterBatches(batches, defaultBatchFilters, range), [batches, range]);
  const options = useMemo(() => batchFilterOptions(inRange), [inRange]);
  const visible = useMemo(
    () => filterBatches(inRange, { ...defaultBatchFilters, q: query.trim(), product, line }),
    [inRange, query, product, line],
  );

  const alerts = useMemo(() => dashboardAlerts({ batches, inventory, orders }), [batches, inventory, orders]);
  const income = incomeNote(kpis.income || 0, kpis.incomePrevious);

  const onRefresh = () => {
    refresh();
    refreshBatches();
    refreshInventory();
    refreshOrders();
  };

  if (loading) return <LoadingState />;
  if (error && !dashboard) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing || batchesRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.kpiRow}>
        <StatTile
          style={styles.kpiHalf}
          size="small"
          tone="green"
          label="Ingresos"
          value={formatMoney(kpis.income, 0)}
          note={
            income.change ? (
              <Text>
                <Text style={[styles.noteStrong, { color: income.color }]}>{income.change}</Text> {income.text}
              </Text>
            ) : (
              income.text
            )
          }
        />
        <StatTile
          style={styles.kpiHalf}
          size="small"
          tone="teal"
          label="Pedidos en curso"
          value={formatNumber(kpis.ordersInProgress)}
          note={`${formatNumber(kpis.ordersReadyToShip)} listos`}
        />
      </View>
      <StatTile
        style={styles.kpiFull}
        size="small"
        tone="blue"
        label="Producción total"
        value={formatNumber(kpis.producedTotal)}
        note="unidades"
      />

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={type.cardTitle}>Alertas</Text>
          {alerts.length ? <Pill label={`${alerts.length} activas`} tone="rose" /> : null}
        </View>
        {alerts.length === 0 ? (
          <Text style={styles.placeholder}>Sin alertas activas.</Text>
        ) : (
          alerts.map((a, i) => (
            <View key={a.key} style={i > 0 && styles.divider}>
              <AlertRow alert={a} onPress={() => navigation.navigate(a.screen)} />
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={type.cardTitle}>Producción por producto</Text>
          {producedInMix > 0 ? <Text style={styles.cardAux}>{formatNumber(producedInMix)} u en el rango</Text> : null}
        </View>
        {mix.length === 0 || producedInMix === 0 ? (
          <Text style={styles.placeholder}>Sin producción en el rango.</Text>
        ) : (
          <DonutChart data={mix} centerLabel={formatNumber(producedInMix)} centerCaption="unidades" />
        )}
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={type.cardTitle}>Historial de lotes</Text>
        <Pressable onPress={() => navigation.navigate("HistorialLotes")} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Ver todo</Text>
        </Pressable>
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar lote" style={styles.search} />
      <View style={styles.filterRow}>
        <SelectField
          style={styles.filterItem}
          title="Producto"
          value={product}
          onChange={setProduct}
          options={[{ label: "Producto: todos", value: "" }, ...options.products.map((p) => ({ label: p, value: p }))]}
        />
        <SelectField
          style={styles.filterItem}
          title="Línea"
          value={line}
          onChange={setLine}
          options={[{ label: "Línea: todas", value: "" }, ...options.lines.map((l) => ({ label: l, value: l }))]}
        />
      </View>

      {batchesLoading ? (
        <Text style={styles.placeholder}>Cargando lotes…</Text>
      ) : batchesError && visible.length === 0 ? (
        <View style={styles.inlineError}>
          <Text style={styles.placeholder}>{batchesError}</Text>
          <Pressable onPress={refreshBatches} hitSlop={8}>
            <Text style={styles.link}>Reintentar</Text>
          </Pressable>
        </View>
      ) : visible.length === 0 ? (
        <EmptyState message="No hay lotes con esos criterios." icon="factory" />
      ) : (
        <ListGroup>
          {visible.slice(0, BATCHES_PREVIEW_LIMIT).map((b) => (
            <BatchRow key={b._id} batch={b} />
          ))}
        </ListGroup>
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {formatNumber(visible.length)} de {formatNumber(inRange.length)} lotes en el rango
        </Text>
        <Pressable onPress={() => navigation.navigate("HistorialLotes")} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Ver historial completo</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiHalf: { flex: 1 },
  kpiFull: { marginTop: 10 },
  noteStrong: { fontFamily: fonts.semibold },
  card: { marginTop: 12, marginBottom: 0 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  cardAux: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  placeholder: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  pressed: { opacity: 0.6 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  alertIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  alertTexts: { flex: 1, gap: 2 },
  alertTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  alertDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
  },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  search: { marginBottom: 10 },
  filterRow: { flexDirection: "row", gap: 10 },
  filterItem: { flex: 1, marginBottom: 10 },
  inlineError: { paddingVertical: 8, gap: 4 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 4 },
  footerText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
