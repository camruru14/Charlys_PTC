import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import { useDateRange } from "../context/DateRangeContext";
import TransactionCard from "../components/transactions/TransactionCard";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { formatCurrency, formatNumber } from "../lib/format";
import { defaultTransactionFilters, transactionFilterOptions, filterTransactions } from "../lib/transactionFilters";

// Portada de Web/private/frontend/src/pages/HistorialTransacciones.jsx.
// Filtra por el rango de fechas global (Fase 11) igual que la web.
export default function HistorialTransaccionesScreen() {
  const range = useDateRange();
  const { transactions, loading, refreshing, error, refresh } = useTransactions();
  const [filters, setFilters] = useState(defaultTransactionFilters);

  const options = useMemo(() => transactionFilterOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters, range), [transactions, filters, range]);
  const hasActiveFilters = Boolean(
    filters.q || filters.type || filters.category || filters.status || filters.minAmount !== "" || filters.maxAmount !== "",
  );

  const stats = useMemo(() => {
    const income = filtered.filter((t) => t.type === "Ingreso").reduce((s, t) => s + (t.amount || 0), 0);
    const expense = filtered.filter((t) => t.type === "Gasto").reduce((s, t) => s + (t.amount || 0), 0);
    return { count: filtered.length, income, expense, net: income - expense };
  }, [filtered]);

  if (loading) return <LoadingState />;
  if (error && transactions.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item, index) => item._id || item.reference || String(index)}
      renderItem={({ item }) => <TransactionCard transaction={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={<EmptyState message="No se encontraron transacciones con esos criterios" />}
      ListHeaderComponent={
        <View>
          <View style={styles.statsRow}>
            <KpiTile label="Transacciones" value={formatNumber(stats.count)} />
            <KpiTile label="Ingresos" value={formatCurrency(stats.income)} />
            <KpiTile label="Gastos" value={formatCurrency(stats.expense)} />
            <KpiTile label="Neto" value={formatCurrency(stats.net)} hint={stats.net >= 0 ? "positivo" : "negativo"} />
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

          <View style={styles.filterRow}>
            <TextInput
              style={[styles.search, styles.amountInput]}
              value={filters.minAmount}
              onChangeText={(v) => setFilters((f) => ({ ...f, minAmount: v.replace(/[^0-9.]/g, "") }))}
              placeholder="Monto ≥"
              placeholderTextColor={colors.slate400}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.search, styles.amountInput]}
              value={filters.maxAmount}
              onChangeText={(v) => setFilters((f) => ({ ...f, maxAmount: v.replace(/[^0-9.]/g, "") }))}
              placeholder="Monto ≤"
              placeholderTextColor={colors.slate400}
              keyboardType="numeric"
            />
          </View>

          {hasActiveFilters ? (
            <TouchableOpacity style={styles.clearButton} onPress={() => setFilters(defaultTransactionFilters)}>
              <Text style={styles.clearButtonText}>Limpiar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
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
  amountInput: { flex: 1, marginBottom: 0 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  filterItem: { flexGrow: 1, minWidth: "45%" },
  clearButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
});
