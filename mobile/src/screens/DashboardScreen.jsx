import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useDashboard } from "../hooks/useDashboard";
import { useBatches } from "../hooks/useBatches";
import { useDateRange } from "../context/DateRangeContext";
import KpiTile from "../components/dashboard/KpiTile";
import AlertCard from "../components/dashboard/AlertCard";
import DonutChart from "../components/dashboard/DonutChart";
import BatchCard from "../components/batches/BatchCard";
import SelectField from "../components/ui/SelectField";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { defaultBatchFilters, batchFilterOptions, filterBatches } from "../lib/batchFilters";

// Mismos colores que DONUT_COLORS en Web/private/frontend/src/pages/Dashboard.jsx
const DONUT_COLORS = ["#2563eb", "#38bdf8", "#c7d2fe", "#818cf8", "#0ea5e9"];
const BATCHES_PREVIEW_LIMIT = 8;

// Formato local del KPI de Ingresos, igual que el `fmt` local de
// Web/private/frontend/src/pages/Dashboard.jsx: sin forzar 2 decimales (a
// diferencia de formatCurrency(), que sí los fuerza y se usa en el resto de
// la app) — es un formateador exclusivo de esta pantalla, como en la web.
const formatIncomeLocal = (value) => `$${Number(value || 0).toLocaleString("es-SV")}`;

// KPIs (3) + Alertas + dona real de producción por producto + Historial de
// lotes con buscador y 3 filtros — todo filtrado por el rango de fechas
// global (Fase 11, botón en el header) igual que
// Web/private/frontend/src/pages/Dashboard.jsx.
export default function DashboardScreen({ navigation }) {
  const range = useDateRange();
  const { dashboard, kpis, productionMix, alerts, loading, refreshing, error, refresh } = useDashboard(range);
  const {
    batches,
    loading: batchesLoading,
    refreshing: batchesRefreshing,
    error: batchesError,
    refresh: refreshBatches,
  } = useBatches();
  const [filters, setFilters] = useState(defaultBatchFilters);

  const options = useMemo(() => batchFilterOptions(batches), [batches]);
  const filteredBatches = useMemo(() => filterBatches(batches, filters, range), [batches, filters, range]);
  const hasActiveFilters = Boolean(filters.q || filters.product || filters.line || filters.status);

  const mixWithColor = productionMix.map((d, i) => ({
    ...d,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const onRefresh = () => {
    refresh();
    refreshBatches();
  };

  if (loading) return <LoadingState />;
  if (error && !dashboard) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing || batchesRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.kpiGrid}>
        <KpiTile label="Producción total" value={formatNumber(kpis.producedTotal)} hint="unidades" />
        <KpiTile label="Ingresos" value={formatIncomeLocal(kpis.income)} hint="en el rango" />
        <KpiTile
          label="Pedidos en curso"
          value={kpis.ordersInProgress ?? 0}
          hint={`${kpis.ordersReadyToShip ?? 0} listos`}
        />
      </View>

      <Text style={styles.sectionTitle}>Alertas</Text>
      {alerts.length === 0 ? (
        <Text style={styles.placeholder}>Sin alertas activas.</Text>
      ) : (
        alerts.map((a, i) => <AlertCard key={i} alert={a} />)
      )}

      <Text style={styles.sectionTitle}>Producción por producto</Text>
      {mixWithColor.length === 0 ? (
        <Text style={styles.placeholder}>Sin datos en el rango.</Text>
      ) : (
        <DonutChart data={mixWithColor} centerLabel="100%" />
      )}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitleInRow}>Historial de lotes</Text>
        <TouchableOpacity onPress={() => navigation.navigate("HistorialLotes")}>
          <Text style={styles.sectionLink}>Ver todo</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.search}
        value={filters.q}
        onChangeText={(v) => setFilters((f) => ({ ...f, q: v }))}
        placeholder="Buscar lote, producto, línea, estado…"
        placeholderTextColor={colors.slate400}
      />
      <View style={styles.filterRow}>
        <View style={styles.filterItem}>
          <SelectField
            title="Producto"
            value={filters.product}
            onChange={(v) => setFilters((f) => ({ ...f, product: v }))}
            options={[{ label: "Producto: todos", value: "" }, ...options.products.map((p) => ({ label: p, value: p }))]}
          />
        </View>
        <View style={styles.filterItem}>
          <SelectField
            title="Línea"
            value={filters.line}
            onChange={(v) => setFilters((f) => ({ ...f, line: v }))}
            options={[{ label: "Línea: todas", value: "" }, ...options.lines.map((l) => ({ label: l, value: l }))]}
          />
        </View>
        <View style={styles.filterItem}>
          <SelectField
            title="Estado"
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[{ label: "Estado: todos", value: "" }, ...options.statuses.map((s) => ({ label: s, value: s }))]}
          />
        </View>
      </View>
      {hasActiveFilters ? (
        <TouchableOpacity style={styles.clearButton} onPress={() => setFilters(defaultBatchFilters)}>
          <Text style={styles.clearButtonText}>Limpiar</Text>
        </TouchableOpacity>
      ) : null}

      {batchesLoading ? (
        <Text style={styles.placeholder}>Cargando…</Text>
      ) : batchesError && filteredBatches.length === 0 ? (
        <View style={styles.inlineError}>
          <Text style={styles.placeholder}>{batchesError}</Text>
          <TouchableOpacity onPress={refreshBatches}>
            <Text style={styles.sectionLink}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : filteredBatches.length === 0 ? (
        <EmptyState message="No se encontraron lotes con esos criterios." />
      ) : (
        filteredBatches.slice(0, BATCHES_PREVIEW_LIMIT).map((b) => <BatchCard key={b._id} batch={b} compact />)
      )}
      <Text style={styles.footer}>
        {filteredBatches.length > BATCHES_PREVIEW_LIMIT
          ? `Mostrando ${BATCHES_PREVIEW_LIMIT} de ${filteredBatches.length} lotes en el rango y filtros seleccionados.`
          : `${filteredBatches.length} lote(s) en el rango y filtros seleccionados.`}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 16, marginBottom: 8 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitleInRow: { fontSize: 15, fontWeight: "800", color: colors.text },
  sectionLink: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
  placeholder: { fontSize: 13, color: colors.slate500, paddingVertical: 8 },
  inlineError: { paddingVertical: 8, gap: 4 },
  search: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filterItem: { flexGrow: 1, minWidth: "45%" },
  clearButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
  footer: { marginTop: 8, fontSize: 12, color: colors.slate400 },
});
