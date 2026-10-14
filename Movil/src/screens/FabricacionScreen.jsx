import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useDailyBatches } from "../hooks/useDailyBatches";
import { useOrders } from "../hooks/useOrders";
import { useDateRange, rangeLabel } from "../context/DateRangeContext";
import BatchCard from "../components/batches/BatchCard";
import DailyBatchRow from "../components/batches/DailyBatchRow";
import ManufacturingOrderCard from "../components/batches/ManufacturingOrderCard";
import BottomSheet from "../components/ui/BottomSheet";
import DateRangeButton from "../components/ui/DateRangeButton";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import FilterSelectChip from "../components/ui/FilterSelectChip";
import GroupHeader from "../components/ui/GroupHeader";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import KpiInline from "../components/ui/KpiInline";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import Segmented from "../components/ui/Segmented";
import { useToast } from "../components/ui/Toast";
import { colors, getTone } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber, fromDateOnly } from "../lib/format";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import { BATCH_GROUPS, batchSearchText, groupBatches, isStockBatch } from "../lib/batchFlow";
import { batchApi } from "../lib/batchActions";
import { runAll } from "../lib/inventoryOrders";
import { MFG_GROUPS, buildGroups, groupMfgOrders, groupSearchText, inMfgRange } from "../lib/orderManufacturing";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";
import MarkAllSeen from "../components/ui/MarkAllSeen";
import { useActivity } from "../hooks/useActivity";

// Mismas vistas que Web/private/frontend/src/pages/Fabricacion.jsx.
const TABS = [
  { value: "lotes", label: "Lotes" },
  { value: "diaria", label: "Diaria" },
  { value: "pedidos", label: "Pedidos" },
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

  // Novedades: burbuja de cada pestaña y registros marcados hasta que se abren.
  const { counts, isUnseen, markSeen } = useActivity();
  const tabs = TABS.map((t) => ({ ...t, badge: counts[`fabricacion.${t.value}`] }));

  const [tab, setTab] = useState("lotes");
  const [lotQuery, setLotQuery] = useState("");
  const [lotEstado, setLotEstado] = useState("");
  const [dailyQuery, setDailyQuery] = useState("");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [schedulingId, setSchedulingId] = useState(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderEstado, setOrderEstado] = useState("");
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

  // Lotes del rango de fechas global (para el KPI de producción). «Lotes» solo
  // muestra los de stock (los de pedido van en la pestaña Pedidos, como la web)
  // y NO se filtran por el rango: la lista va agrupada por estado y el rango
  // solo afecta a «En bodega» (ver groupBatches).
  const rangeList = useMemo(() => filterBatches(batches, defaultBatchFilters, range), [batches, range]);
  const stockList = useMemo(() => batches.filter(isStockBatch), [batches]);

  // Grupos con la búsqueda y el rango (los conteos del filtro «Estado» salen de
  // aquí); no se muestran los vacíos ni los que no son el estado elegido.
  const foundLots = useMemo(() => {
    const q = lotQuery.trim().toLowerCase();
    return q ? stockList.filter((b) => batchSearchText(b).includes(q)) : stockList;
  }, [stockList, lotQuery]);
  const allLotGroups = useMemo(() => groupBatches(foundLots, range), [foundLots, range]);
  const lotSections = useMemo(
    () =>
      allLotGroups
        .filter((g) => g.items.length > 0 && (!lotEstado || g.key === lotEstado))
        .map((g) => ({ key: g.key, title: g.label, note: g.note, count: g.items.length, data: g.items })),
    [allLotGroups, lotEstado],
  );
  const visibleLotCount = useMemo(() => lotSections.reduce((n, s) => n + s.count, 0), [lotSections]);
  const lotStateOptions = useMemo(
    () =>
      allLotGroups.map((g) => ({
        value: g.key,
        label: g.state,
        dot: getTone(statusTone(g.state, "lote")).dot,
        meta: formatNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    [allLotGroups],
  );
  const lotTotalFound = useMemo(() => allLotGroups.reduce((n, g) => n + g.items.length, 0), [allLotGroups]);
  const lotEstadoGroup = BATCH_GROUPS.find((g) => g.key === lotEstado);

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

  // Pedidos con lotes de fabricación. La lista va agrupada por estado: con la
  // búsqueda y el rango (los conteos del filtro «Estado» salen de aquí) no se
  // muestran los grupos vacíos ni los que no son el estado elegido. El rango
  // solo filtra «Empacado».
  const groups = useMemo(() => buildGroups(orders, batches), [orders, batches]);
  const foundOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return q ? groups.filter((g) => groupSearchText(g).includes(q)) : groups;
  }, [groups, orderQuery]);
  const allOrderGroups = useMemo(() => groupMfgOrders(foundOrders, range), [foundOrders, range]);
  const orderSections = useMemo(
    () =>
      allOrderGroups
        .filter((g) => g.items.length > 0 && (!orderEstado || g.key === orderEstado))
        .map((g) => ({ key: g.key, title: g.label, note: g.note, count: g.items.length, data: g.items })),
    [allOrderGroups, orderEstado],
  );
  const visibleOrderCount = useMemo(() => orderSections.reduce((n, s) => n + s.count, 0), [orderSections]);
  const orderStateOptions = useMemo(
    () =>
      allOrderGroups.map((g) => ({
        value: g.key,
        label: g.state,
        dot: getTone(statusTone(g.macro, "pedido-fabricacion")).dot,
        meta: formatNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    [allOrderGroups],
  );
  const orderTotalFound = useMemo(() => allOrderGroups.reduce((n, g) => n + g.items.length, 0), [allOrderGroups]);
  const orderEstadoGroup = MFG_GROUPS.find((g) => g.key === orderEstado);

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
    if (tab === "pedidos") {
      const packed = MFG_GROUPS.find((g) => g.macro === "Empacado");
      const count = (test) => formatNumber(groups.filter(test).length);
      // Los tres primeros no dependen del rango; Empacados solo cuenta los del rango.
      return [
        { label: "Por empacar", value: count((g) => g.macro === "Por empacar"), tone: statusTone("Por empacar", "pedido-fabricacion") },
        { label: "En proceso", value: count((g) => g.macro.startsWith("En proceso")), tone: statusTone("En proceso", "pedido-fabricacion") },
        { label: "Detenidos", value: count((g) => g.macro === "En proceso · detenido"), tone: statusTone("En proceso · detenido", "pedido-fabricacion") },
        { label: "Empacados", value: count((g) => g.macro === "Empacado" && inMfgRange(g, packed, range)), tone: statusTone("Empacado", "pedido-fabricacion") },
      ];
    }
    return [
      { label: "Producción", value: formatNumber(rangeList.reduce((s, b) => s + (b.producedQuantity || 0), 0)), tone: "blue" },
      {
        label: "En proceso",
        // En proceso y Detenidos cuentan los lotes activos de la lista, sin importar el rango.
        value: formatNumber(stockList.filter((b) => b.status === "En Proceso").length),
        tone: statusTone("En proceso", "lote"),
      },
      {
        label: "Detenidos",
        value: formatNumber(stockList.filter((b) => b.status === "Detenido").length),
        tone: statusTone("Detenido", "lote"),
      },
    ];
  }, [tab, rangeList, stockList, dailyBatches, groups, range]);

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
      <MarkAllSeen activityKey={`fabricacion.${tab}`} />
      <KpiInline items={kpis} style={styles.kpis} />
      {tab === "lotes" ? (
        <>
          <SearchField value={lotQuery} onChangeText={setLotQuery} placeholder="Buscar lote, producto o color" style={styles.lotSearch} />
          <View style={styles.lotFilterRow}>
            <FilterSelectChip
              label="Estado"
              allLabel="todos"
              allMeta={formatNumber(lotTotalFound)}
              size="lg"
              value={lotEstado}
              options={lotStateOptions}
              onChange={setLotEstado}
            />
            <View style={styles.lotSummary}>
              <Text style={styles.lotSummaryCount}>
                {formatNumber(visibleLotCount)} {visibleLotCount === 1 ? "lote" : "lotes"}
              </Text>
              <Text style={styles.lotSummaryRange} numberOfLines={1}>
                {rangeLabel(range)}
              </Text>
            </View>
          </View>
        </>
      ) : tab === "diaria" ? (
        <View style={styles.searchRow}>
          <SearchField value={dailyQuery} onChangeText={setDailyQuery} placeholder="Buscar producto" style={styles.flex} />
          <MonthChip value={month} options={monthOptions} onChange={setMonth} />
        </View>
      ) : (
        <>
          <SearchField value={orderQuery} onChangeText={setOrderQuery} placeholder="Buscar pedido, cliente o lote" style={styles.lotSearch} />
          <View style={styles.lotFilterRow}>
            <FilterSelectChip
              label="Estado"
              allLabel="todos"
              allMeta={formatNumber(orderTotalFound)}
              size="lg"
              value={orderEstado}
              options={orderStateOptions}
              onChange={setOrderEstado}
            />
            <View style={styles.lotSummary}>
              <Text style={styles.lotSummaryCount}>
                {formatNumber(visibleOrderCount)} {visibleOrderCount === 1 ? "pedido" : "pedidos"}
              </Text>
              <Text style={styles.lotSummaryRange} numberOfLines={1}>
                {rangeLabel(range)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Segmented options={tabs} value={tab} onChange={setTab} />
      </View>

      {tab === "lotes" ? (
        <SectionList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          sections={lotSections}
          keyExtractor={(b) => b._id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <GroupHeader title={section.title} note={section.note} count={section.count} />}
          renderItem={({ item }) => (
            <BatchCard
              batch={item}
              unseen={isUnseen("fabricacion.lotes", item._id)}
              onPress={() => {
                markSeen("fabricacion.lotes", item._id);
                navigation.navigate("LoteDetalle", { id: item._id, backLabel: "Lotes", activityKey: "fabricacion.lotes" });
              }}
            />
          )}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="factory"
              message={
                lotEstadoGroup
                  ? `No hay lotes «${lotEstadoGroup.state}» ${lotEstadoGroup.ranged ? "en este rango" : "con estos filtros"}.`
                  : lotQuery.trim()
                    ? "No hay lotes con estos filtros."
                    : "No hay lotes."
              }
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
                  unseen={isUnseen("fabricacion.diaria", b._id)}
                  busy={schedulingId === b._id}
                  onSchedule={() => schedule(b)}
                  onPress={() => {
                    markSeen("fabricacion.diaria", b._id);
                    navigation.navigate("LoteDiarioForm", { id: b._id });
                  }}
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
        <SectionList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          sections={orderSections}
          keyExtractor={(g) => g.order._id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <GroupHeader title={section.title} note={section.note} count={section.count} />}
          renderItem={({ item: g }) => (
            <ManufacturingOrderCard
              group={g}
              unseen={isUnseen("fabricacion.pedidos", g.order._id)}
              busy={busy}
              onOpenLot={(lot) => {
                markSeen("fabricacion.pedidos", g.order._id);
                navigation.navigate("LoteDetalle", { id: lot.batch._id, backLabel: "Pedidos", activityKey: "fabricacion.pedidos", activityId: g.order._id });
              }}
              onOpenOrder={() => {
                markSeen("fabricacion.pedidos", g.order._id);
                navigation.navigate("PedidoDetalle", { id: g.order._id, activityKey: "fabricacion.pedidos" });
              }}
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
                message={
                  orderEstadoGroup
                    ? `No hay pedidos «${orderEstadoGroup.state}» ${orderEstadoGroup.ranged ? "en este rango" : "con estos filtros"}.`
                    : orderQuery.trim()
                      ? "No hay pedidos con estos filtros."
                      : "No hay pedidos en fabricación."
                }
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
  lotSearch: { marginBottom: 10 },
  lotFilterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  lotSummary: { flex: 1, alignItems: "flex-end" },
  lotSummaryCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  lotSummaryRange: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
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
