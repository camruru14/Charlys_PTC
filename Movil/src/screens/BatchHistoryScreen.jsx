import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useDateRange } from "../context/DateRangeContext";
import BatchRow from "../components/batches/BatchRow";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import FormField from "../components/ui/FormField";
import IconButton from "../components/ui/IconButton";
import KpiInline from "../components/ui/KpiInline";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { defaultBatchFilters, batchFilterOptions, filterBatches } from "../lib/batchFilters";
import { useBottomPad } from "../hooks/useBottomPad";

// Historial de lotes (BatchHistoryView.jsx de la web): todos los lotes del
// rango de fechas con búsqueda y todos los filtros (producto, línea, estado,
// operario y producido mínimo). Con `route.params.editable` (el «Ver
// historial» de Fabricación) permite crear, editar y eliminar lotes.
export default function BatchHistoryScreen({ navigation, route }) {
  const bottomPad = useBottomPad(32);
  const editable = Boolean(route.params?.editable);
  const toast = useToast();
  const range = useDateRange();
  const { batches, loading, refreshing, error, refresh, eliminar } = useBatches();
  const [filters, setFilters] = useState(defaultBatchFilters);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <>
          <DateRangeButton />
          {editable ? (
            <IconButton
              icon="plus"
              variant="primary"
              onPress={() => navigation.navigate("LoteFabricacionForm")}
              accessibilityLabel="Nuevo lote"
            />
          ) : null}
        </>
      ),
    });
  }, [navigation, editable]);

  const options = useMemo(() => batchFilterOptions(batches), [batches]);
  const filtered = useMemo(() => filterBatches(batches, filters, range), [batches, filters, range]);
  // Conteo por estado con los demás filtros puestos (para los chips).
  const withoutStatus = useMemo(() => filterBatches(batches, { ...filters, status: "" }, range), [batches, filters, range]);
  const hasActiveFilters = Boolean(
    filters.q || filters.product || filters.line || filters.status || filters.operator || filters.minProduced !== "",
  );
  const produced = filtered.reduce((s, b) => s + (b.producedQuantity || 0), 0);

  const openMenu = (batch) =>
    Alert.alert(batch.batchNumber, undefined, [
      { text: "Editar", onPress: () => navigation.navigate("LoteFabricacionForm", { id: batch._id }) },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Eliminar lote", `¿Eliminar el lote ${batch.batchNumber}?`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Eliminar",
              style: "destructive",
              onPress: async () => {
                try {
                  await eliminar(batch._id);
                  toast.show("Lote eliminado");
                } catch (err) {
                  Alert.alert("No se pudo eliminar", err.message);
                }
              },
            },
          ]),
      },
      { text: "Cancelar", style: "cancel" },
    ]);

  if (loading) return <LoadingState />;
  if (error && batches.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, bottomPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <KpiInline
        style={styles.kpis}
        items={[
          { label: "Lotes encontrados", value: formatNumber(filtered.length), tone: "blue" },
          { label: "Producción total", value: `${formatNumber(produced)} u`, tone: "green" },
        ]}
      />

      <SearchField value={filters.q} onChangeText={(v) => set("q", v)} placeholder="Buscar lote, producto, línea, estado…" />
      <FilterChips
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}
        value={filters.status}
        onChange={(v) => set("status", v)}
        options={[
          { value: "", label: "Todos", count: withoutStatus.length },
          ...options.statuses.map((s) => ({ value: s, label: s, count: withoutStatus.filter((b) => b.status === s).length })),
        ]}
      />
      <View style={styles.pair}>
        <SelectField
          style={styles.pairItem}
          title="Producto"
          value={filters.product}
          onChange={(v) => set("product", v)}
          options={[{ label: "Producto: todos", value: "" }, ...options.products.map((p) => ({ label: p, value: p }))]}
        />
        <SelectField
          style={styles.pairItem}
          title="Línea"
          value={filters.line}
          onChange={(v) => set("line", v)}
          options={[{ label: "Línea: todas", value: "" }, ...options.lines.map((l) => ({ label: l, value: l }))]}
        />
      </View>
      <View style={styles.pair}>
        <SelectField
          style={styles.pairItem}
          title="Operario"
          value={filters.operator}
          onChange={(v) => set("operator", v)}
          options={[{ label: "Operario: todos", value: "" }, ...options.operators]}
        />
        <FormField
          style={styles.pairItem}
          value={filters.minProduced}
          onChangeText={(v) => set("minProduced", v.replace(/\D/g, ""))}
          placeholder="Producido ≥"
          keyboardType="number-pad"
          suffix="u"
        />
      </View>
      {hasActiveFilters ? (
        <Pressable onPress={() => setFilters(defaultBatchFilters)} hitSlop={8} accessibilityRole="button" style={styles.clear}>
          <Text style={styles.link}>Limpiar filtros</Text>
        </Pressable>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState icon="factory" message="No se encontraron lotes con esos criterios." />
      ) : (
        <ListGroup>
          {filtered.map((b) => (
            <BatchRow
              key={b._id}
              batch={b}
              showOperator
              onPress={editable ? () => navigation.navigate("LoteFabricacionForm", { id: b._id }) : undefined}
              onLongPress={editable ? () => openMenu(b) : undefined}
            />
          ))}
        </ListGroup>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  kpis: { marginBottom: 12 },
  chips: { marginTop: 10, marginBottom: 12, marginHorizontal: -20 },
  chipsContent: { paddingHorizontal: 20 },
  pair: { flexDirection: "row", gap: 10 },
  pairItem: { flex: 1, marginBottom: 10 },
  clear: { alignSelf: "flex-start", marginBottom: 12 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
