import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTransactions } from "../hooks/useTransactions";
import { useExpenseCategories } from "../hooks/useExpenseCategories";
import { rangeLabel, useDateRange } from "../context/DateRangeContext";
import BudgetBar from "../components/finance/BudgetBar";
import CategoryAvatar from "../components/finance/CategoryAvatar";
import SalesRow from "../components/transactions/SalesRow";
import TransactionRow from "../components/transactions/TransactionRow";
import BottomBar from "../components/ui/BottomBar";
import BottomSheet from "../components/ui/BottomSheet";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import GroupHeader from "../components/ui/GroupHeader";
import Icon from "../components/ui/Icon";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import Segmented from "../components/ui/Segmented";
import StatTile from "../components/ui/StatTile";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatMonth } from "../lib/format";
import {
  LEDGER_TABS,
  buildLedger,
  budgetNote,
  capitalize,
  categoryRows,
  currentMonthRange,
  dayLabel,
  daysInMonth,
  filterLedger,
  ledgerSummary,
  money,
  plural,
} from "../lib/finance";
import { categoryIconName, categoryTone } from "../lib/expenseCategories";
import MarkAllSeen from "../components/ui/MarkAllSeen";
import { useActivity } from "../hooks/useActivity";

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "movimientos", label: "Movimientos" },
];

const NOTE_COLOR = { rose: tones.rose.text, amber: tones.amber.text, gray: colors.muted };

// Finanzas (Web/private/frontend/src/pages/Finanzas.jsx). Resumen: las cifras
// del rango elegido y los gastos por categoría del MES EN CURSO contra su
// presupuesto (la app no tiene la vista «Por mes» del selector de rango).
// Movimientos: el libro del rango agrupado por día; las ventas de la tienda
// entran solas, van en una fila por día y no se editan. «Registrar gasto» abre
// el formulario; tocar un movimiento lo edita y mantenerlo presionado ofrece
// Editar, Marcar pagado, Ver factura y Eliminar.
export default function FinanzasScreen({ navigation }) {
  const toast = useToast();
  const range = useDateRange();
  const { transactions, loading, refreshing, error, refresh, eliminar, pagar } = useTransactions();
  const { categories, refresh: refreshCategories } = useExpenseCategories();

  // Novedades: la burbuja va en Movimientos; los movimientos nuevos se marcan hasta que se abren.
  const { counts, isUnseen, markSeen, markSeenMany } = useActivity();
  const tabs = TABS.map((t) => (t.value === "movimientos" ? { ...t, badge: counts.finanzas } : t));

  const [tab, setTab] = useState("resumen");
  const [ledgerTab, setLedgerTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [menuFor, setMenuFor] = useState(null);

  const now = new Date();

  const reload = useCallback(() => {
    refresh();
    refreshCategories();
  }, [refresh, refreshCategories]);

  useFocusEffect(reload);

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle:
        tab === "resumen"
          ? "Ingresos, gastos y presupuestos"
          : range.preset === "all"
            ? "Todos los movimientos"
            : `Movimientos · ${rangeLabel(range).toLowerCase()}`,
      headerRight: () => <DateRangeButton />,
    });
  }, [navigation, tab, range]);

  const categoryByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories]);

  // Resumen: cifras del rango y gastos por categoría del mes en curso.
  const summary = useMemo(() => ledgerSummary(transactions, range), [transactions, range]);
  const monthRows = useMemo(
    () => categoryRows({ transactions, categories, range: currentMonthRange(new Date()) }),
    [transactions, categories],
  );

  // Movimientos: rango + pestaña + categoría + búsqueda, agrupados por día.
  const days = useMemo(
    () => buildLedger(filterLedger(transactions, { range, tab: ledgerTab, category, query })),
    [transactions, range, ledgerTab, category, query],
  );
  const pendingCount = useMemo(
    () => filterLedger(transactions, { range, tab: "porpagar" }).length,
    [transactions, range],
  );
  const ledgerTabs = LEDGER_TABS.map((t) => (t.value === "porpagar" ? { ...t, label: `Por pagar (${pendingCount})` } : t));

  const openEdit = (t) => navigation.navigate("TransaccionForm", { id: t._id });
  const openNew = () => navigation.navigate("TransaccionForm");

  const showCategory = (name) => {
    setCategory(name);
    setLedgerTab("todos");
    setTab("movimientos");
  };

  const markPaid = async (t) => {
    try {
      await pagar(t._id);
      toast.show(`${t.reference} marcado como pagado`);
    } catch (err) {
      Alert.alert("No se pudo marcar como pagado", err.message);
    }
  };

  const confirmDelete = (t) =>
    Alert.alert("Eliminar movimiento", `¿Eliminar «${t.concept}» (${t.reference})? Si tiene factura adjunta, también se borra.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(t._id);
            toast.show("Movimiento eliminado");
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);

  // Acciones del movimiento presionado: una hoja, porque son hasta cuatro.
  const act = (fn) => () => {
    const t = menuFor;
    setMenuFor(null);
    // La hoja se cierra con animación: la acción espera a que termine.
    setTimeout(() => fn(t), 280);
  };
  const viewInvoice = (t) =>
    Linking.openURL(t.attachment.url).catch(() => Alert.alert("No se pudo abrir la factura", t.attachment.name || t.attachment.url));

  const header = (
    <View style={styles.tabs}>
      <Segmented options={tabs} value={tab} onChange={setTab} />
    </View>
  );

  let body;
  if (loading && !transactions.length) {
    body = <LoadingState />;
  } else if (error && !transactions.length) {
    body = <ErrorState message={error} onRetry={reload} />;
  } else if (tab === "resumen") {
    const net = summary.net;
    const netTone = net > 0 ? "green" : net < 0 ? "rose" : "gray";
    const dayPct = (now.getDate() / daysInMonth(now)) * 100;
    body = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        <View style={styles.grid}>
          <StatTile
            style={styles.tile}
            size="small"
            tone="green"
            label="Ventas tienda"
            value={money(summary.sales)}
            valueColor={tones.green.text}
            note={`${plural(summary.salesCount, "pedido", "pedidos")}${summary.otherIncome > 0 ? ` · + ${money(summary.otherIncome)} otros` : ""}`}
          />
          <StatTile style={styles.tile} size="small" tone="amber" label="Gastos" value={money(summary.expensesPaid)} note="pagados" />
        </View>
        <View style={styles.grid}>
          <StatTile
            style={styles.tile}
            size="small"
            tone={netTone}
            label="Neto"
            value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${money(Math.abs(net))}`}
            valueColor={netTone === "gray" ? undefined : tones[netTone].text}
            note={summary.netPct == null ? "sin ingresos" : `${Math.round(summary.netPct)}% de los ingresos`}
          />
          <StatTile
            style={styles.tile}
            size="small"
            tone="amber"
            label="Por pagar"
            value={money(summary.pending)}
            valueColor={tones.amber.text}
            note={plural(summary.pendingCount, "factura", "facturas")}
          />
        </View>

        <Card style={styles.categoriesCard}>
          <Text style={styles.cardTitle}>Gastos por categoría</Text>
          <Text style={styles.cardSubtitle}>{capitalize(formatMonth(now))} · contra presupuesto</Text>
          {monthRows.length ? (
            <View style={styles.rows}>
              {monthRows.map((row) => {
                const note = budgetNote(row, { dayPct });
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => showCategory(row.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.name}, ${money(row.paid)} pagado. Ver sus movimientos`}
                    style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                  >
                    <View style={styles.categoryLine}>
                      <CategoryAvatar icon={row.icon} color={row.color} size={32} />
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <View style={styles.categoryAmounts}>
                        <Text style={styles.categoryPaid}>{money(row.paid)}</Text>
                        {row.pending > 0 ? <Text style={styles.categoryPending}>+ {money(row.pending)} por pagar</Text> : null}
                      </View>
                    </View>
                    {row.budget > 0 ? (
                      <>
                        <BudgetBar style={styles.bar} paid={row.paid} pending={row.pending} budget={row.budget} color={row.color} dayPct={dayPct} />
                        <View style={styles.noteLine}>
                          <Text style={[styles.note, { color: NOTE_COLOR[note.tone] }]} numberOfLines={1}>
                            {note.text}
                          </Text>
                          <Text style={styles.budget}>de {money(row.budget)}</Text>
                        </View>
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
              <Text style={styles.legend}>pagado · por pagar (rayado) · marca: día {now.getDate()} de {daysInMonth(now)}</Text>
            </View>
          ) : (
            <EmptyState icon="finance" message="Sin gastos ni presupuestos este mes." />
          )}
        </Card>
      </ScrollView>
    );
  } else {
    const selected = category ? categoryByName.get(category) : null;
    body = (
      <View style={styles.flex}>
        <View style={styles.controls}>
          <MarkAllSeen activityKey="finanzas" />
          <Segmented options={ledgerTabs} value={ledgerTab} onChange={setLedgerTab} scrollable />
          <SearchField value={query} onChangeText={setQuery} placeholder="Concepto o referencia" />
          {category ? (
            <Pressable
              onPress={() => setCategory("")}
              accessibilityRole="button"
              accessibilityLabel={`Quitar el filtro de ${category}`}
              style={[styles.chip, { backgroundColor: categoryTone(selected?.color).bg }]}
            >
              <Icon name={categoryIconName(selected?.icon)} size={14} color={categoryTone(selected?.color).text} />
              <Text style={[styles.chipText, { color: categoryTone(selected?.color).text }]} numberOfLines={1}>
                {category}
              </Text>
              <Icon name="close" size={14} color={categoryTone(selected?.color).text} />
            </Pressable>
          ) : null}
        </View>
        <FlatList
          data={days}
          keyExtractor={(day) => day.key}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          ListEmptyComponent={<EmptyState icon="finance" message="No hay movimientos con esos criterios." />}
          renderItem={({ item: day }) => (
            <View>
              <GroupHeader
                title={dayLabel(day.date, now)}
                note={plural(day.count, "movimiento", "movimientos")}
                count={`${day.net > 0 ? "+" : day.net < 0 ? "−" : ""}${money(Math.abs(day.net))}`}
                countColor={day.net > 0 ? tones.green.text : day.net < 0 ? tones.rose.text : undefined}
              />
              <ListGroup>
                {day.rows.map((row) =>
                  row.kind === "sales" ? (
                    <SalesRow
                      key={row.id}
                      sales={row.sales}
                      unseen={row.sales.some((t) => isUnseen("finanzas", t._id))}
                      onPress={() => {
                        // Al abrir las ventas del día, se marcan vistas todas las de ese día.
                        markSeenMany("finanzas", row.sales.map((t) => t._id));
                        navigation.navigate("VentasDia", { day: day.key });
                      }}
                    />
                  ) : (
                    <TransactionRow
                      key={row.id}
                      transaction={row.tx}
                      category={categoryByName.get(row.tx.category)}
                      now={now}
                      unseen={isUnseen("finanzas", row.tx._id)}
                      onPress={() => {
                        markSeen("finanzas", row.tx._id);
                        openEdit(row.tx);
                      }}
                      onLongPress={() => setMenuFor(row.tx)}
                    />
                  ),
                )}
              </ListGroup>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      {body}
      <BottomBar actions={[{ title: "Registrar gasto", icon: "plus", onPress: openNew }]} />

      <BottomSheet
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        title={menuFor?.concept || "Movimiento"}
        subtitle={menuFor?.reference}
        footer={
          menuFor ? (
            <>
              <Button title="Editar" variant="secondary" onPress={act(openEdit)} />
              {menuFor.status === "Pendiente" ? <Button title="Marcar pagado" variant="success" onPress={act(markPaid)} /> : null}
              {menuFor.attachment?.url ? <Button title="Ver factura" variant="secondary" onPress={act(viewInvoice)} /> : null}
              <Button title="Eliminar" variant="danger" onPress={act(confirmDelete)} />
            </>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  controls: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  categoriesCard: { marginTop: 2, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  cardSubtitle: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  rows: { marginTop: 8, gap: 2 },
  categoryRow: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4 },
  pressed: { backgroundColor: colors.surface2 },
  categoryLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  categoryAmounts: { alignItems: "flex-end" },
  categoryPaid: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  categoryPending: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
  bar: { marginTop: 8 },
  noteLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 },
  note: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11.5 },
  budget: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, fontVariant: ["tabular-nums"] },
  legend: { marginTop: 8, fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  chip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5 },
});
