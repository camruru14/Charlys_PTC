import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useDailyBatches } from "../hooks/useDailyBatches";
import { useOrders } from "../hooks/useOrders";
import { useDateRange } from "../context/DateRangeContext";
import BatchCard from "../components/batches/BatchCard";
import DailyBatchRow from "../components/batches/DailyBatchRow";
import ManufacturingOrderCard from "../components/batches/ManufacturingOrderCard";
import BottomSheet from "../components/ui/BottomSheet";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import KpiInline from "../components/ui/KpiInline";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import Segmented from "../components/ui/Segmented";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber, fromDateOnly } from "../lib/format";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import { batchSearchText, batchState } from "../lib/batchFlow";
import { batchApi } from "../lib/batchActions";
import { runAll } from "../lib/inventoryOrders";
import { buildGroups, groupSearchText } from "../lib/orderManufacturing";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

// Mismas vistas que Web/private/frontend/src/pages/Fabricacion.jsx.
const TABS = [
  { value: "lotes", label: "Lotes" },
  { value: "diaria", label: "Diaria" },
  { value: "pedidos", label: "Pedidos" },
];

// Chips de Lotes: filtran por el estado visible del lote (batchState).
const LOT_CHIPS = [
  { value: "all", label: "Todos" },
  { value: "En proceso", label: "En proceso" },
  { value: "Por enviar", label: "Por enviar" },
  { value: "Detenido", label: "Detenidos" },
];

// Chips de Pedidos (PedidosFabricacion.jsx).
const ORDER_CHIPS = [
  { value: "all", label: "Todos", test: () => true },
  { value: "enProceso", label: "En proceso", test: (g) => g.macro.startsWith("En proceso") },
  { value: "porEmpacar", label: "Por empacar", test: (g) => g.macro === "Por empacar" },
  { value: "detenidos", label: "Detenidos", test: (g) => g.stopped.length > 0 },
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Lunes de esta semana a las 00:00.
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Chip del filtro de mes de Producción diaria («Fecha: septiembre» en la web).
function MonthChip({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Mes: ${selected.label}`}
        style={({ pressed }) => [styles.monthChip, pressed && styles.pressed]}
      >
        <Icon name="calendar" size={15} color={colors.faint} />
        <Text style={styles.monthText} numberOfLines={1}>
          {selected.label}
        </Text>
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Mes">
        <FilterChips
          options={options}
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

// Fabricación: Lotes de fabricación (de stock), Producción diaria y Pedidos
// en producción, como la web. Tocar un lote abre su detalle
// (LoteDetalleScreen), donde avanza: iniciar, detener, completar, enviar a
// bodega o empacar.
export default function FabricacionScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const range = useDateRange();
  const { batches, loading, refreshing, error, refresh } = useBatches();
  const {
    dailyBatches,
    loading: dailyLoading,
    refreshing: dailyRefreshing,
    error: dailyError,
    refresh: refreshDaily,
    programar,
    eliminar: eliminarDaily,
  } = useDailyBatches();
  const { orders, refreshing: ordersRefreshing, error: ordersError, refresh: refreshOrders } = useOrders();

  const [tab, setTab] = useState("lotes");
  const [lotQuery, setLotQuery] = useState("");
  const [lotChip, setLotChip] = useState("all");
  const [dailyQuery, setDailyQuery] = useState("");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [schedulingId, setSchedulingId] = useState(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderChip, setOrderChip] = useState("all");
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshDaily();
      refreshOrders();
    }, [refresh, refreshDaily, refreshOrders]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle:
        tab === "pedidos"
          ? "Pedidos — del lote programado al empaque"
          : tab === "diaria"
            ? "Lotes diarios de producción"
            : "Control de líneas de producción",
      headerRight: () => (
        <>
          {tab !== "diaria" ? <DateRangeButton /> : null}
          <IconButton
            icon="plus"
            variant="primary"
            onPress={() => navigation.navigate(tab === "diaria" ? "LoteDiarioForm" : "LoteFabricacionForm")}
            accessibilityLabel={tab === "diaria" ? "Nuevo lote diario" : "Nuevo lote"}
          />
        </>
      ),
    });
  }, [navigation, tab]);

  // Lotes del rango de fechas global; «Lotes» solo muestra los de stock (los
  // de pedido van en la pestaña Pedidos), como la web.
  const rangeList = useMemo(() => filterBatches(batches, defaultBatchFilters, range), [batches, range]);
  const stockList = useMemo(() => rangeList.filter((b) => b.category !== "Pedido"), [rangeList]);

  const lotCounts = useMemo(() => {
    const c = { all: stockList.length };
    stockList.forEach((b) => {
      const s = batchState(b);
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [stockList]);

  const visibleLots = useMemo(() => {
    const q = lotQuery.trim().toLowerCase();
    return stockList.filter((b) => (lotChip === "all" || batchState(b) === lotChip) && (!q || batchSearchText(b).includes(q)));
  }, [stockList, lotChip, lotQuery]);

  // Producción diaria: meses con lotes (más reciente primero) más el actual.
  const monthOptions = useMemo(() => {
    const keys = new Map([[monthKey(new Date()), new Date()]]);
    dailyBatches.forEach((b) => {
      const d = fromDateOnly(b.date);
      if (d) keys.set(monthKey(d), d);
    });
    const years = new Set([...keys.values()].map((d) => d.getFullYear()));
    const sameYear = years.size === 1 && years.has(new Date().getFullYear());
    return [
      { value: "", label: "Todas" },
      ...[...keys.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([value, d]) => ({
          value,
          label: `${capitalize(MONTHS[d.getMonth()])}${sameYear ? "" : ` ${d.getFullYear()}`}`,
        })),
    ];
  }, [dailyBatches]);

  const visibleDaily = useMemo(() => {
    const q = dailyQuery.trim().toLowerCase();
    return dailyBatches.filter((b) => {
      const d = fromDateOnly(b.date);
      if (month && (!d || monthKey(d) !== month)) return false;
      if (q && ![b.product, b.color, b.dailyBatchNumber].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dailyBatches, dailyQuery, month]);

  const groups = useMemo(() => buildGroups(orders, batches), [orders, batches]);
  const orderCounts = useMemo(
    () => Object.fromEntries(ORDER_CHIPS.map((c) => [c.value, groups.filter(c.test).length])),
    [groups],
  );
  const visibleGroups = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    const test = ORDER_CHIPS.find((c) => c.value === orderChip)?.test || (() => true);
    return groups.filter((g) => test(g) && (!q || groupSearchText(g).includes(q)));
  }, [groups, orderChip, orderQuery]);

  const kpis = useMemo(() => {
    if (tab === "diaria") {
      const today = new Date().toDateString();
      const weekStart = startOfWeek();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const dates = dailyBatches.map((b) => fromDateOnly(b.date)).filter(Boolean);
      return [
        { label: "Lotes hoy", value: formatNumber(dates.filter((d) => d.toDateString() === today).length), tone: "blue" },
        { label: "Esta semana", value: formatNumber(dates.filter((d) => d >= weekStart && d < weekEnd).length), tone: "green" },
      ];
    }
    return [
      { label: "Producción", value: formatNumber(rangeList.reduce((s, b) => s + (b.producedQuantity || 0), 0)), tone: "blue" },
      {
        label: "En proceso",
        value: formatNumber(rangeList.filter((b) => b.status === "En Proceso").length),
        tone: statusTone("En proceso", "lote"),
      },
      {
        label: "Detenidos",
        value: formatNumber(rangeList.filter((b) => b.status === "Detenido").length),
        tone: statusTone("Detenido", "lote"),
      },
    ];
  }, [tab, rangeList, dailyBatches]);

  // «Programar» es directo y no tiene reversa: el backend crea el lote de
  // fabricación y borra el lote diario (en la web tampoco hay «Deshacer»).
  const schedule = async (daily) => {
    setSchedulingId(daily._id);
    try {
      const res = await programar(daily._id);
      refresh();
      toast.show(
        res?.batchNumber ? `${daily.dailyBatchNumber} programado · ${res.batchNumber}` : `${daily.dailyBatchNumber} programado`,
      );
    } catch (err) {
      Alert.alert("No se pudo programar", err.message);
    } finally {
      setSchedulingId(null);
    }
  };

  const dailyMenu = (daily) =>
    Alert.alert(daily.dailyBatchNumber, undefined, [
      { text: "Editar", onPress: () => navigation.navigate("LoteDiarioForm", { id: daily._id }) },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Eliminar lote diario", `¿Eliminar el lote ${daily.dailyBatchNumber}?`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Eliminar",
              style: "destructive",
              onPress: async () => {
                try {
                  await eliminarDaily(daily._id);
                  toast.show("Lote diario eliminado");
                } catch (err) {
                  Alert.alert("No se pudo eliminar", err.message);
                }
              },
            },
          ]),
      },
      { text: "Cancelar", style: "cancel" },
    ]);

  // Acciones de todo un pedido (PedidosFabricacion.jsx), con «Deshacer».
  async function orderAct(run, message, undo) {
    const reload = () => Promise.all([refresh(), refreshOrders()]);
    setBusy(true);
    try {
      await run();
      await reload();
      toast.undo(message, async () => {
        try {
          await undo();
          toast.show("Cambio deshecho");
        } catch (err) {
          Alert.alert("No se pudo deshacer", err.message);
        } finally {
          reload();
        }
      });
    } catch (err) {
      Alert.alert("No se pudo completar", err.message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const resumeLots = (lots) =>
    orderAct(
      () => runAll(lots.map((l) => () => batchApi.resume(l.batch._id))),
      lots.length === 1 ? `Lote ${lots[0].batch.batchNumber} reanudado` : `${formatNumber(lots.length)} lotes reanudados`,
      () => runAll(lots.map((l) => () => batchApi.stop(l.batch._id, l.batch.stopReason))),
    );

  const packLots = (group, lots) =>
    orderAct(
      () =>
        lots.length === 1
          ? batchApi.packManufactured(group.order._id, lots[0].index)
          : batchApi.packCompleted(lots.map((l) => l.batch._id)),
      lots.length === 1
        ? `${[lots[0].item.product, lots[0].item.color].filter(Boolean).join(" · ")} empacado`
        : `${formatNumber(lots.length)} lotes empacados`,
      () => runAll(lots.map((l) => () => batchApi.unpackManufactured(group.order._id, l.index))),
    );

  if (loading || dailyLoading) return <LoadingState />;
  if (error && batches.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const refreshAll = () => {
    refresh();
    refreshDaily();
    refreshOrders();
  };
  const refreshControl = (
    <RefreshControl refreshing={refreshing || dailyRefreshing || ordersRefreshing} onRefresh={refreshAll} />
  );

  const header = (
    <View style={styles.listHeader}>
      <KpiInline items={kpis} style={styles.kpis} />
      {tab === "lotes" ? (
        <>
          <SearchField value={lotQuery} onChangeText={setLotQuery} placeholder="Buscar lote, producto o color" />
          <FilterChips
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
            value={lotChip}
            onChange={setLotChip}
            options={LOT_CHIPS.map((c) => ({ ...c, count: lotCounts[c.value] || 0 }))}
          />
        </>
      ) : tab === "diaria" ? (
        <View style={styles.searchRow}>
          <SearchField value={dailyQuery} onChangeText={setDailyQuery} placeholder="Buscar producto" style={styles.flex} />
          <MonthChip value={month} options={monthOptions} onChange={setMonth} />
        </View>
      ) : (
        <>
          <SearchField value={orderQuery} onChangeText={setOrderQuery} placeholder="Buscar pedido" />
          <FilterChips
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
            value={orderChip}
            onChange={setOrderChip}
            options={ORDER_CHIPS.map((c) => ({ value: c.value, label: c.label, count: orderCounts[c.value] }))}
          />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === "lotes" ? (
        <FlatList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          data={visibleLots}
          keyExtractor={(b) => b._id}
          renderItem={({ item }) => (
            <BatchCard batch={item} onPress={() => navigation.navigate("LoteDetalle", { id: item._id, backLabel: "Lotes" })} />
          )}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="factory"
              message={stockList.length ? "Ningún lote coincide con la búsqueda." : "No hay lotes en el rango seleccionado."}
            />
          }
          ListFooterComponent={
            <Pressable
              onPress={() => navigation.navigate("HistorialLotes", { editable: true })}
              hitSlop={8}
              accessibilityRole="link"
              style={styles.footerLink}
            >
              <Text style={styles.link}>Ver historial de lotes</Text>
            </Pressable>
          }
        />
      ) : tab === "diaria" ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
        >
          {header}
          {dailyError && dailyBatches.length === 0 ? (
            <ErrorState message={dailyError} onRetry={refreshDaily} />
          ) : visibleDaily.length === 0 ? (
            <EmptyState
              icon="calendar"
              message={dailyBatches.length ? "Ningún lote diario coincide con los filtros." : "No hay lotes diarios."}
            />
          ) : (
            <ListGroup>
              {visibleDaily.map((b) => (
                <DailyBatchRow
                  key={b._id}
                  batch={b}
                  busy={schedulingId === b._id}
                  onSchedule={() => schedule(b)}
                  onPress={() => navigation.navigate("LoteDiarioForm", { id: b._id })}
                  onLongPress={() => dailyMenu(b)}
                />
              ))}
            </ListGroup>
          )}
          <Text style={styles.summary}>
            {formatNumber(visibleDaily.length)} de {formatNumber(dailyBatches.length)} lotes diarios
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          data={visibleGroups}
          keyExtractor={(g) => g.order._id}
          renderItem={({ item: g }) => (
            <ManufacturingOrderCard
              group={g}
              busy={busy}
              onOpenLot={(lot) => navigation.navigate("LoteDetalle", { id: lot.batch._id, backLabel: "Pedidos" })}
              onOpenOrder={() => navigation.navigate("PedidoDetalle", { id: g.order._id })}
              onResume={resumeLots}
              onPackCompleted={(lots) => packLots(g, lots)}
            />
          )}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            ordersError && orders.length === 0 ? (
              <ErrorState message={ordersError} onRetry={refreshOrders} />
            ) : (
              <EmptyState
                icon="orders"
                message={groups.length ? "Ningún pedido coincide con la búsqueda." : "No hay pedidos en fabricación."}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  listHeader: { marginBottom: 12 },
  kpis: { marginBottom: 12 },
  chips: { marginTop: 10, marginHorizontal: -20 },
  chipsContent: { paddingHorizontal: 20 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthChip: {
    height: 42,
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surface2 },
  monthText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  summary: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  footerLink: { alignSelf: "center", marginTop: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
