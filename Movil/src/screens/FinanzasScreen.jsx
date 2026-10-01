import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import { rangeLabel, useDateRange } from "../context/DateRangeContext";
import BarChart from "../components/transactions/BarChart";
import TransactionRow from "../components/transactions/TransactionRow";
import Card from "../components/ui/Card";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import Segmented from "../components/ui/Segmented";
import StatTile from "../components/ui/StatTile";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatMoney, formatNumber } from "../lib/format";
import { financeKpis, lastMonths } from "../lib/finance";
import { defaultTransactionFilters, filterTransactions, inRange } from "../lib/transactionFilters";
import { useBottomPad } from "../hooks/useBottomPad";

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "transacciones", label: "Transacciones" },
];

const TYPE_CHIPS = [
  { value: "", label: "Todos" },
  { value: "Ingreso", label: "Ingresos" },
  { value: "Gasto", label: "Gastos" },
];

// Finanzas (Web/private/frontend/src/pages/Finanzas.jsx): KPIs del rango de
// fechas y la gráfica de los últimos seis meses (Resumen), y la lista de
// transacciones del rango con buscador y tipo (Transacciones). «+» abre una
// transacción nueva; tocar una fila la edita y mantenerla presionada ofrece
// Editar / Eliminar, como el menú «…» de la web.
export default function FinanzasScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const range = useDateRange();
  const { transactions, loading, refreshing, error, refresh, eliminar } = useTransactions();

  const [tab, setTab] = useState("resumen");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle:
        tab === "resumen"
          ? "Ingresos, gastos y rentabilidad"
          : range.preset === "all"
            ? "Todas las transacciones"
            : `Transacciones · ${rangeLabel(range).toLowerCase()}`,
      headerRight: () => (
        <>
          <DateRangeButton />
          <IconButton
            icon="plus"
            variant="primary"
            onPress={() => navigation.navigate("TransaccionForm")}
            accessibilityLabel="Nueva transacción"
          />
        </>
      ),
    });
  }, [navigation, tab, range]);

  // KPIs: transacciones del rango («Todo» = sin rango).
  const kpis = useMemo(() => financeKpis(transactions.filter((t) => inRange(t, range))), [transactions, range]);
  // Gráfica: últimos seis meses, sin importar el rango.
  const months = useMemo(() => lastMonths(transactions), [transactions]);

  // Lista: rango + buscador; el tipo se aplica después para contar los chips.
  const searched = useMemo(
    () => filterTransactions(transactions, { ...defaultTransactionFilters, q: query.trim() }, range),
    [transactions, query, range],
  );
  const counts = useMemo(
    () => ({
      "": searched.length,
      Ingreso: searched.filter((t) => t.type === "Ingreso").length,
      Gasto: searched.filter((t) => t.type === "Gasto").length,
    }),
    [searched],
  );
  const visible = useMemo(() => (type ? searched.filter((t) => t.type === type) : searched), [searched, type]);

  const openEdit = (t) => navigation.navigate("TransaccionForm", { id: t._id });

  const confirmDelete = (t) =>
    Alert.alert("Eliminar transacción", `¿Eliminar la transacción ${t.reference}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(t._id);
            toast.show("Transacción eliminada");
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);

  const openMenu = (t) =>
    Alert.alert(t.reference || "Transacción", t.concept, [
      { text: "Editar", onPress: () => openEdit(t) },
      { text: "Eliminar", style: "destructive", onPress: () => confirmDelete(t) },
      { text: "Cancelar", style: "cancel" },
    ]);

  const header = (
    <View style={styles.tabs}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  if (loading && !transactions.length) {
    return (
      <View style={styles.screen}>
        {header}
        <LoadingState />
      </View>
    );
  }
  if (error && !transactions.length) {
    return (
      <View style={styles.screen}>
        {header}
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  const netPositive = kpis.net > 0;
  const netNegative = kpis.net < 0;
  const netTone = netPositive ? "green" : netNegative ? "rose" : "gray";

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, bottomPad]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {tab === "resumen" ? (
          <>
            <View style={styles.grid}>
              <StatTile
                style={styles.tile}
                size="small"
                tone="green"
                label="Ingresos"
                value={formatMoney(kpis.income, 0)}
                note="en el rango"
              />
              <StatTile
                style={styles.tile}
                size="small"
                tone="amber"
                label="Gastos"
                value={formatMoney(kpis.expense, 0)}
                note="en el rango"
              />
            </View>
            <View style={styles.grid}>
              <StatTile
                style={styles.tile}
                size="small"
                tone={netTone}
                label="Rentabilidad neta"
                value={`${netPositive ? "+" : netNegative ? "−" : ""}${formatMoney(Math.abs(kpis.net), 0)}`}
                valueColor={netTone === "gray" ? undefined : tones[netTone].text}
                note={netPositive ? "positiva" : netNegative ? "negativa" : "en el rango"}
              />
              <StatTile
                style={styles.tile}
                size="small"
                tone="amber"
                label="Por cobrar / pagar"
                value={formatMoney(kpis.pending, 0)}
                valueColor={tones.amber.text}
                note={`${formatNumber(kpis.pendingOrders)} ${kpis.pendingOrders === 1 ? "pedido" : "pedidos"}`}
              />
            </View>

            <Card style={styles.chartCard}>
              <BarChart months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
            </Card>
          </>
        ) : (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder="Concepto o referencia" style={styles.search} />
            <FilterChips
              options={TYPE_CHIPS.map((c) => ({ ...c, count: counts[c.value] }))}
              value={type}
              onChange={setType}
              style={styles.chips}
            />
            {visible.length ? (
              <ListGroup>
                {visible.map((t) => (
                  <TransactionRow key={t._id} transaction={t} onPress={() => openEdit(t)} onLongPress={() => openMenu(t)} />
                ))}
              </ListGroup>
            ) : (
              <EmptyState icon="finance" message="No hay transacciones con esos criterios." />
            )}
            <Pressable
              onPress={() => navigation.navigate("HistorialTransacciones")}
              hitSlop={8}
              accessibilityRole="link"
              style={styles.historyLink}
            >
              <Text style={styles.historyText}>Ver historial completo</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  chartCard: { marginTop: 2 },
  search: { marginBottom: 12 },
  chips: { marginBottom: 12 },
  historyLink: { alignSelf: "center", paddingVertical: 12 },
  historyText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
});
