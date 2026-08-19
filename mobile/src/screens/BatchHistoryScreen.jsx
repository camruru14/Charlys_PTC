import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useDateRange } from "../context/DateRangeContext";
import BatchCard from "../components/batches/BatchCard";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { defaultBatchFilters, batchFilterOptions, filterBatches } from "../lib/batchFilters";

// Portada de Web/private/frontend/src/components/batches/BatchHistoryView.jsx.
// `route.params.editable` (default false) habilita el FAB de "Nuevo lote" y
// navegar a editar al tocar una tarjeta. Filtra por el rango de fechas
// global (Fase 11) igual que la web.
export default function BatchHistoryScreen({ navigation, route }) {
  const editable = Boolean(route.params?.editable);
  const range = useDateRange();
  const { batches, loading, refreshing, error, refresh } = useBatches();
  const [filters, setFilters] = useState(defaultBatchFilters);

  const options = useMemo(() => batchFilterOptions(batches), [batches]);
  const filtered = useMemo(() => filterBatches(batches, filters, range), [batches, filters, range]);
  const hasActiveFilters = Boolean(
    filters.q || filters.product || filters.line || filters.status || filters.operator || filters.minProduced !== "",
  );

  const stats = useMemo(() => {
    const produced = filtered.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    return { count: filtered.length, produced };
  }, [filtered]);

  if (loading) return <LoadingState />;
  if (error && batches.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(item, index) => item._id || item.batchNumber || String(index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={editable ? 0.85 : 1}
            disabled={!editable}
            onPress={() => editable && navigation.navigate("LoteFabricacionForm", { id: item._id })}
          >
            <BatchCard batch={item} />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState message="No se encontraron lotes con esos criterios" />}
        ListHeaderComponent={
          <View>
            <View style={styles.statsRow}>
              <KpiTile label="Lotes encontrados" value={formatNumber(stats.count)} />
              <KpiTile label="Producción total" value={formatNumber(stats.produced)} />
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
              <View style={styles.filterItem}>
                <SelectField
                  title="Operario"
                  value={filters.operator}
                  onChange={(v) => setFilters((f) => ({ ...f, operator: v }))}
                  options={[{ label: "Operario: todos", value: "" }, ...options.operators]}
                />
              </View>
            </View>

            <TextInput
              style={styles.search}
              value={filters.minProduced}
              onChangeText={(v) => setFilters((f) => ({ ...f, minProduced: v.replace(/\D/g, "") }))}
              placeholder="Producido ≥"
              placeholderTextColor={colors.slate400}
              keyboardType="numeric"
            />

            {hasActiveFilters ? (
              <TouchableOpacity style={styles.clearButton} onPress={() => setFilters(defaultBatchFilters)}>
                <Text style={styles.clearButtonText}>Limpiar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
      {editable ? <FloatingAddButton onPress={() => navigation.navigate("LoteFabricacionForm")} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 96, flexGrow: 1 },
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
