import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import TransactionCard from "../components/transactions/TransactionCard";
import BarChart from "../components/transactions/BarChart";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";
import { formatCurrency } from "../lib/format";
import {
  defaultTransactionFilters,
  transactionFilterOptions,
  filterTransactions,
  txDateParts,
} from "../lib/transactionFilters";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TRANSACTIONS_PREVIEW_LIMIT = 8;

// Meses (año/mes) entre dos fechas, ambos inclusive — igual que
// monthsInRange() en Web/private/frontend/src/pages/Finanzas.jsx.
function monthsInRange(from, to) {
  const res = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end) {
    res.push({ y: d.getFullYear(), m: d.getMonth() });
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

// 4 KPIs + gráfica de barras (Ingresos vs. Gastos por mes) + lista de
// transacciones con buscador/filtros compactos — mismo criterio que
// Web/private/frontend/src/pages/Finanzas.jsx. Sin selector de rango de
// fechas todavía (fase aparte, transversal): esto equivale al caso "Todo"
// del panel web, agrupando TODAS las transacciones por mes desde la más
// antigua hasta la más reciente.
export default function FinanzasScreen({ navigation }) {
  const { transactions, loading, refreshing, error, refresh } = useTransactions();
  const [filters, setFilters] = useState(defaultTransactionFilters);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const options = useMemo(() => transactionFilterOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const hasActiveFilters = Boolean(filters.q || filters.type || filters.category || filters.status);

  // Sin selector de rango todavía: equivale al caso "Todo" del panel web.
  const kpis = useMemo(() => {
    const income = transactions.filter((t) => t.type === "Ingreso").reduce((s, t) => s + (t.amount || 0), 0);
    const expense = transactions.filter((t) => t.type === "Gasto").reduce((s, t) => s + (t.amount || 0), 0);
    const pending = transactions.filter((t) => t.status === "Pendiente").reduce((s, t) => s + (t.amount || 0), 0);
    return { income, expense, net: income - expense, pending };
  }, [transactions]);

  const chartData = useMemo(() => {
    const parts = transactions.map((t) => txDateParts(t)).filter(Boolean);
    if (parts.length === 0) return [];
    const latest = parts.reduce((a, b) => (b.time > a.time ? b : a));
    const earliest = parts.reduce((a, b) => (b.time < a.time ? b : a));
    const from = new Date(earliest.y, earliest.m, 1);
    const to = new Date(latest.y, latest.m, latest.day);
    const buckets = monthsInRange(from, to);
    const spansYears = new Set(buckets.map((b) => b.y)).size > 1;
    return buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const t of transactions) {
        const p = txDateParts(t);
        if (p && p.y === bucket.y && p.m === bucket.m) {
          if (t.type === "Ingreso") income += t.amount || 0;
          else expense += t.amount || 0;
        }
      }
      const label = spansYears ? `${MONTHS[bucket.m]} ${String(bucket.y).slice(-2)}` : MONTHS[bucket.m];
      return { label, values: [income, expense] };
    });
  }, [transactions]);

  if (loading) return <LoadingState />;
  if (error && transactions.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={filtered.slice(0, TRANSACTIONS_PREVIEW_LIMIT)}
        keyExtractor={(item, index) => item._id || item.reference || String(index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("TransaccionForm", { id: item._id })}
          >
            <TransactionCard transaction={item} />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState message="No se encontraron transacciones con esos criterios" />}
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text style={styles.footer}>{filtered.length} transacción(es) en los filtros seleccionados.</Text>
          ) : null
        }
        ListHeaderComponent={
          <View>
            <View style={styles.kpiGrid}>
              <KpiTile label="Ingresos" value={formatCurrency(kpis.income)} hint="en el rango" />
              <KpiTile label="Gastos" value={formatCurrency(kpis.expense)} hint="en el rango" />
              <KpiTile
                label="Rentabilidad neta"
                value={formatCurrency(kpis.net)}
                hint={kpis.net >= 0 ? "Positiva" : "Negativa"}
              />
              <KpiTile
                label="Pendiente por cobrar/pagar"
                value={formatCurrency(kpis.pending)}
                hint={kpis.pending ? "en el rango" : "Al día"}
              />
            </View>

            <Text style={styles.sectionTitle}>Ingresos vs. Gastos por mes</Text>
            {chartData.length === 0 ? (
              <Text style={styles.placeholder}>Sin movimientos todavía.</Text>
            ) : (
              <BarChart
                data={chartData}
                series={[
                  { name: "Ingresos", color: "#2563eb" },
                  { name: "Gastos", color: "#ef4444" },
                ]}
                formatValue={formatCurrency}
              />
            )}

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitleInRow}>Transacciones</Text>
              <TouchableOpacity onPress={() => navigation.navigate("HistorialTransacciones")}>
                <Text style={styles.sectionLink}>Ver todo</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.search}
              value={filters.q}
              onChangeText={(v) => setFilters((f) => ({ ...f, q: v }))}
              placeholder="Buscar concepto, referencia, categoría…"
              placeholderTextColor={colors.slate400}
            />
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <SelectField
                  title="Tipo"
                  value={filters.type}
                  onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
                  options={[{ label: "Tipo: todos", value: "" }, ...options.types.map((t) => ({ label: t, value: t }))]}
                />
              </View>
              <View style={styles.filterItem}>
                <SelectField
                  title="Categoría"
                  value={filters.category}
                  onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                  options={[{ label: "Categoría: todas", value: "" }, ...options.categories.map((c) => ({ label: c, value: c }))]}
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
              <TouchableOpacity style={styles.clearButton} onPress={() => setFilters(defaultTransactionFilters)}>
                <Text style={styles.clearButtonText}>Limpiar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
      <FloatingAddButton onPress={() => navigation.navigate("TransaccionForm")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 96, flexGrow: 1 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 20, marginBottom: 8 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitleInRow: { fontSize: 15, fontWeight: "800", color: colors.text },
  sectionLink: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
  placeholder: { fontSize: 13, color: colors.slate500, paddingVertical: 8 },
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
