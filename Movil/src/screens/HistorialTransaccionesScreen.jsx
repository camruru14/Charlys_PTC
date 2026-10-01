import { useLayoutEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import { rangeLabel, useDateRange } from "../context/DateRangeContext";
import TransactionRow from "../components/transactions/TransactionRow";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterSelectChip from "../components/ui/FilterSelectChip";
import FormField from "../components/ui/FormField";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import StatTile from "../components/ui/StatTile";
import { colors, tones } from "../lib/theme";
import { formatMoney, formatNumber } from "../lib/format";
import { useBottomPad } from "../hooks/useBottomPad";
import {
  defaultTransactionFilters,
  filterTransactions,
  sumByType,
  transactionFilterOptions,
} from "../lib/transactionFilters";

const cleanAmount = (v) => v.replace(",", ".").replace(/[^\d.]/g, "");

// Historial de transacciones (Web/private/frontend/src/pages/
// HistorialTransacciones.jsx): todas las transacciones del rango de fechas
// global con buscador, filtros de tipo, categoría, estado y monto, y sus
// totales. Solo lectura, como en la web.
export default function HistorialTransaccionesScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const range = useDateRange();
  const { transactions, loading, refreshing, error, refresh } = useTransactions();
  const [filters, setFilters] = useState(defaultTransactionFilters);

  useLayoutEffect(() => {
    navigation.setOptions({ headerSubtitle: `Rango: ${rangeLabel(range)}` });
  }, [navigation, range]);

  const options = useMemo(() => transactionFilterOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters, range), [transactions, filters, range]);
  const totals = useMemo(() => sumByType(filtered), [filtered]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasActive = Boolean(
    filters.q || filters.type || filters.category || filters.status || filters.minAmount !== "" || filters.maxAmount !== "",
  );

  if (loading && !transactions.length) return <LoadingState />;
  if (error && !transactions.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <SearchField
        value={filters.q}
        onChangeText={(v) => set("q", v)}
        placeholder="Concepto, referencia o categoría"
        style={styles.search}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSelectChip label="Tipo" value={filters.type} options={options.types} onChange={(v) => set("type", v)} />
        <FilterSelectChip
          label="Categoría"
          allLabel="todas"
          value={filters.category}
          options={options.categories}
          onChange={(v) => set("category", v)}
        />
        <FilterSelectChip
          label="Estado"
          value={filters.status}
          options={options.statuses}
          onChange={(v) => set("status", v)}
        />
      </ScrollView>
      <View style={styles.amounts}>
        <FormField
          label="Monto ≥"
          value={filters.minAmount}
          onChangeText={(v) => set("minAmount", cleanAmount(v))}
          keyboardType="decimal-pad"
          suffix="$"
          style={styles.amount}
        />
        <FormField
          label="Monto ≤"
          value={filters.maxAmount}
          onChangeText={(v) => set("maxAmount", cleanAmount(v))}
          keyboardType="decimal-pad"
          suffix="$"
          style={styles.amount}
        />
      </View>

      <View style={styles.tiles}>
        <StatTile style={styles.tile} size="small" label="Registros" value={formatNumber(filtered.length)} />
        <StatTile
          style={styles.tile}
          size="small"
          label="Ingresos"
          value={formatMoney(totals.income, 0)}
          valueColor={tones.green.text}
        />
        <StatTile style={styles.tile} size="small" label="Gastos" value={formatMoney(totals.expense, 0)} />
      </View>

      {filtered.length ? (
        <ListGroup>
          {filtered.map((t) => (
            <TransactionRow key={t._id} transaction={t} />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon="finance" message="No hay transacciones con esos criterios." />
      )}

      {hasActive ? (
        <Button
          title="Limpiar filtros"
          variant="secondary"
          size="small"
          onPress={() => setFilters(defaultTransactionFilters)}
          style={styles.clear}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  search: { marginBottom: 12 },
  chipsScroll: { flexGrow: 0, marginHorizontal: -20, marginBottom: 12 },
  chips: { gap: 8, paddingHorizontal: 20 },
  amounts: { flexDirection: "row", gap: 10 },
  amount: { flex: 1, marginBottom: 12 },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  clear: { alignSelf: "flex-start", marginTop: 4 },
});
