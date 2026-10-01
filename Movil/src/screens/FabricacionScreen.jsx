import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useDailyBatches } from "../hooks/useDailyBatches";
import { useWarehouses } from "../hooks/useWarehouses";
import { useOrders } from "../hooks/useOrders";
import { useDateRange } from "../context/DateRangeContext";
import BatchCard from "../components/batches/BatchCard";
import DailyBatchCard from "../components/batches/DailyBatchCard";
import OrderGroupRow from "../components/batches/OrderGroupRow";
import ManufacturingDetailModal from "../components/batches/ManufacturingDetailModal";
import PedidoBatchDetailModal from "../components/batches/PedidoBatchDetailModal";
import ReportBatchModal from "../components/batches/ReportBatchModal";
import KpiTile from "../components/dashboard/KpiTile";
import SelectField from "../components/ui/SelectField";
import SwitchField from "../components/ui/SwitchField";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import {
  manufacturingMacroStatus,
  manufacturingProgressSegments,
  manufacturingProgressCaption,
  MANUFACTURING_STATUS_LABELS,
  getManufacturingCounts,
  pedidoBatchMacroStatus,
  pedidoBatchProgressSegments,
  pedidoBatchProgressCaption,
  PEDIDO_BATCH_STATUS_LABELS,
  getPedidoBatchCounts,
} from "../lib/manufacturingProgress";

const TABS = [
  { key: "fabricacion", label: "Lotes de fabricación" },
  { key: "diario", label: "Lotes Diarios" },
  { key: "pedidos", label: "Por fabricar" },
  { key: "fabricacionPedidos", label: "Fabricación de pedidos" },
];

const MANUFACTURING_STATUS_FILTERS = ["enCola", "enFabricacion"];
const PEDIDO_BATCH_STATUS_FILTERS = ["programado", "enProceso", "completado", "detenido"];

// 4 pestañas, igual que Web/private/frontend/src/pages/Fabricacion.jsx:
// Lotes de fabricación / Lotes Diarios (ya existían, ahora en pestañas
// propias en vez de dos secciones de una misma lista) + Por fabricar /
// Fabricación de pedidos (nuevas, pero la lógica de backend ya vivía en
// useOrders.js — PedidoDetalleScreen sigue intacto, esto es una vista
// adicional sobre los mismos endpoints). "Lotes de fabricación" y
// "Fabricación de pedidos" filtran por el rango de fechas global (Fase 11);
// "Lotes Diarios" y "Por fabricar" NO — tampoco lo hacen en la web
// (dailyBatches es un fetch aparte sin filterBatches, y "Por fabricar" sale
// de `orders`, no de `batches`).
export default function FabricacionScreen({ navigation }) {
  const range = useDateRange();
  const {
    batches,
    loading: batchesLoading,
    refreshing: batchesRefreshing,
    error: batchesError,
    refresh: refreshBatches,
    eliminar: eliminarBatch,
    reportar,
    deshacerReporte,
  } = useBatches();
  const {
    dailyBatches,
    loading: dailyLoading,
    refreshing: dailyRefreshing,
    error: dailyError,
    refresh: refreshDaily,
    programar,
  } = useDailyBatches();
  const { warehouses } = useWarehouses();
  const {
    orders,
    loading: ordersLoading,
    refreshing: ordersRefreshing,
    error: ordersError,
    refresh: refreshOrders,
    manufactureItem,
    removeFromManufacturing,
    packManufacturedItem,
  } = useOrders();

  const [activeTab, setActiveTab] = useState("fabricacion");
  const [reportTarget, setReportTarget] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [undoingId, setUndoingId] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);

  const [manufacturingStatusFilter, setManufacturingStatusFilter] = useState("");
  const [manufacturingOnlyPending, setManufacturingOnlyPending] = useState(false);
  const [manufacturingInfoOrderId, setManufacturingInfoOrderId] = useState(null);
  const [manufacturingBusyIndex, setManufacturingBusyIndex] = useState(null);

  const [pedidoBatchStatusFilter, setPedidoBatchStatusFilter] = useState("");
  const [pedidoBatchOnlyPending, setPedidoBatchOnlyPending] = useState(false);
  const [pedidoBatchInfoOrderId, setPedidoBatchInfoOrderId] = useState(null);
  const [pedidoBatchBusyId, setPedidoBatchBusyId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refreshBatches();
      refreshDaily();
      refreshOrders();
    }, [refreshBatches, refreshDaily, refreshOrders]),
  );

  // Lista acotada al rango de fechas seleccionado (createdAt/startDate del
  // lote) — mismo criterio que rangeList en Fabricacion.jsx web.
  const rangeList = useMemo(() => filterBatches(batches, defaultBatchFilters, range), [batches, range]);

  // "Lotes de fabricación" excluye los lotes category "Pedido" (creados
  // desde "Fabricar" en Pedidos): esos se muestran aparte, en "Fabricación
  // de pedidos" — mismo criterio que Fabricacion.jsx del panel web.
  const diarioBatches = useMemo(() => rangeList.filter((b) => b.category !== "Pedido"), [rangeList]);
  const pedidoBatchesList = useMemo(() => rangeList.filter((b) => b.category === "Pedido"), [rangeList]);

  const kpis = useMemo(() => {
    const produced = rangeList.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    const inProcess = rangeList.filter((b) => b.status === "En Proceso").length;
    const stopped = rangeList.filter((b) => b.status === "Detenido").length;
    return { produced, inProcess, stopped };
  }, [rangeList]);

  const manufacturingGroups = useMemo(() => {
    const groups = [];
    orders.forEach((o) => {
      const lines = [];
      (o.items || []).forEach((item, index) => {
        if (item.sentToManufacturing) lines.push({ item, index });
      });
      if (lines.length) groups.push({ order: o, lines });
    });
    const latest = (g) => Math.max(...g.lines.map((l) => new Date(l.item.sentToManufacturingAt).getTime()));
    return groups.sort((a, b) => latest(b) - latest(a));
  }, [orders]);

  const manufacturingInfoGroup = useMemo(
    () => manufacturingGroups.find((g) => g.order._id === manufacturingInfoOrderId) || null,
    [manufacturingGroups, manufacturingInfoOrderId],
  );

  const filteredManufacturingGroups = useMemo(
    () =>
      manufacturingGroups.filter((g) => {
        if (manufacturingStatusFilter && manufacturingMacroStatus(g) !== manufacturingStatusFilter) return false;
        if (manufacturingOnlyPending && getManufacturingCounts(g).enCola === 0) return false;
        return true;
      }),
    [manufacturingGroups, manufacturingStatusFilter, manufacturingOnlyPending],
  );

  const hasActiveManufacturingFilters = Boolean(manufacturingStatusFilter || manufacturingOnlyPending);

  const pedidoLineByBatchId = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      (o.items || []).forEach((item, index) => {
        const batchId = item.manufacturingBatch?._id || item.manufacturingBatch;
        if (batchId) map.set(String(batchId), { order: o, item, index });
      });
    });
    return map;
  }, [orders]);

  const pedidoGroups = useMemo(() => {
    const map = new Map();
    const unlinked = [];
    pedidoBatchesList.forEach((batch) => {
      const pedidoLine = pedidoLineByBatchId.get(String(batch._id));
      if (!pedidoLine) {
        unlinked.push({ batch, item: null, index: null });
        return;
      }
      const { order, item, index } = pedidoLine;
      if (!map.has(order._id)) map.set(order._id, { order, batches: [] });
      map.get(order._id).batches.push({ batch, item, index });
    });
    const latest = (g) => Math.max(...g.batches.map(({ batch }) => new Date(batch.startDate || batch.createdAt).getTime()));
    const groups = Array.from(map.values()).sort((a, b) => latest(b) - latest(a));
    if (unlinked.length) groups.push({ order: { _id: "__unlinked__", orderNumber: "Sin pedido vinculado" }, batches: unlinked });
    return groups;
  }, [pedidoBatchesList, pedidoLineByBatchId]);

  const pedidoBatchInfoGroup = useMemo(
    () => pedidoGroups.find((g) => g.order._id === pedidoBatchInfoOrderId) || null,
    [pedidoGroups, pedidoBatchInfoOrderId],
  );

  const filteredPedidoGroups = useMemo(
    () =>
      pedidoGroups.filter((g) => {
        if (pedidoBatchStatusFilter && pedidoBatchMacroStatus(g) !== pedidoBatchStatusFilter) return false;
        if (pedidoBatchOnlyPending && getPedidoBatchCounts(g).completado === g.batches.length) return false;
        return true;
      }),
    [pedidoGroups, pedidoBatchStatusFilter, pedidoBatchOnlyPending],
  );

  const hasActivePedidoBatchFilters = Boolean(pedidoBatchStatusFilter || pedidoBatchOnlyPending);

  const handleSchedule = async (dailyBatch) => {
    setSchedulingId(dailyBatch._id);
    try {
      await programar(dailyBatch._id);
      refreshBatches();
    } catch (error) {
      Alert.alert("No se pudo programar", error.message || "Intentá de nuevo");
    } finally {
      setSchedulingId(null);
    }
  };

  const handleReportPress = (batch) => {
    if (batch.lastReportedAt) {
      Alert.alert("¿Deshacer reporte?", `Se revertirá el reporte del lote ${batch.batchNumber}.`, [
        { text: "Cancelar" },
        {
          text: "Deshacer",
          style: "destructive",
          onPress: async () => {
            setUndoingId(batch._id);
            try {
              await deshacerReporte(batch._id);
            } catch (error) {
              Alert.alert("No se pudo deshacer el reporte", error.message || "Intentá de nuevo");
            } finally {
              setUndoingId(null);
            }
          },
        },
      ]);
      return;
    }
    setReportTarget(batch);
  };

  const handleReportSave = async (payload) => {
    if (!payload.warehouse) {
      Alert.alert("Falta información", "Elegí una bodega");
      return;
    }
    setReporting(true);
    try {
      await reportar(reportTarget._id, payload);
      setReportTarget(null);
    } catch (error) {
      Alert.alert("No se pudo reportar", error.message || "Intentá de nuevo");
    } finally {
      setReporting(false);
    }
  };

  const handleFabricar = ({ order, item, index }) => {
    Alert.alert(
      "Fabricar",
      `¿Fabricar ${item.quantity} ${item.product}${item.color ? ` (${item.color})` : ""} para el pedido ${order.orderNumber}? Se creará un lote en Lotes de fabricación.`,
      [
        { text: "Cancelar" },
        {
          text: "Fabricar",
          onPress: async () => {
            setManufacturingBusyIndex(index);
            try {
              await manufactureItem(order._id, index);
              refreshBatches();
            } catch (error) {
              Alert.alert("No se pudo fabricar", error.message || "Intentá de nuevo");
            } finally {
              setManufacturingBusyIndex(null);
            }
          },
        },
      ],
    );
  };

  const handleEliminarManufacturingLine = ({ order, item, index }) => {
    const msg = item.manufacturingBatch
      ? `¿Eliminar ${item.product} de Fabricación > Pedidos? El lote ${item.manufacturingBatch.batchNumber || ""} ya fabricado se conserva en "Fabricación de pedidos", solo se desvincula de este pedido.`
      : `¿Eliminar ${item.product} de Fabricación > Pedidos? Podrá volver a solicitarse desde Inventario.`;
    Alert.alert("Eliminar", msg, [
      { text: "Cancelar" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setManufacturingBusyIndex(index);
          try {
            await removeFromManufacturing(order._id, index);
          } catch (error) {
            Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
          } finally {
            setManufacturingBusyIndex(null);
          }
        },
      },
    ]);
  };

  const handleEmpacar = (pedidoLine) => {
    const { order, item, index } = pedidoLine;
    const batchId = item.manufacturingBatch?._id || item.manufacturingBatch;
    Alert.alert(
      "Empacar",
      `¿Marcar ${item.product} como empacado? Quedará listo para que Logística lo recoja en Fabricación.`,
      [
        { text: "Cancelar" },
        {
          text: "Empacar",
          onPress: async () => {
            setPedidoBatchBusyId(batchId);
            try {
              await packManufacturedItem(order._id, index);
              refreshBatches();
            } catch (error) {
              Alert.alert("No se pudo empacar", error.message || "Intentá de nuevo");
            } finally {
              setPedidoBatchBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleEditarPedidoBatch = (batch) => {
    setPedidoBatchInfoOrderId(null);
    navigation.navigate("LoteFabricacionForm", { id: batch._id });
  };

  const handleEliminarPedidoBatch = (batch) => {
    Alert.alert("Eliminar lote", `¿Eliminar el lote ${batch.batchNumber}? Esta acción no se puede deshacer.`, [
      { text: "Cancelar" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarBatch(batch._id);
          } catch (error) {
            Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
          }
        },
      },
    ]);
  };

  if (batchesLoading || dailyLoading) return <LoadingState />;
  if ((batchesError && batches.length === 0) || (dailyError && dailyBatches.length === 0)) {
    return (
      <ErrorState
        message={batchesError || dailyError}
        onRetry={() => {
          refreshBatches();
          refreshDaily();
        }}
      />
    );
  }

  const refreshing = batchesRefreshing || dailyRefreshing || ordersRefreshing;
  const refreshAll = () => {
    refreshBatches();
    refreshDaily();
    refreshOrders();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.kpiGrid}>
          <KpiTile label="Producción total" value={`${formatNumber(kpis.produced)} u.`} hint={`${rangeList.length} lotes`} />
          <KpiTile label="Lotes en proceso" value={formatNumber(kpis.inProcess)} hint="activos" />
          <KpiTile label="Lotes detenidos" value={formatNumber(kpis.stopped)} hint={kpis.stopped ? "Alerta" : "OK"} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabButton, activeTab === t.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabButtonText, activeTab === t.key && styles.tabButtonTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeTab === "fabricacion" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={diarioBatches}
          keyExtractor={(item, index) => item._id || item.batchNumber || String(index)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("LoteFabricacionForm", { id: item._id })}
            >
              <BatchCard
                batch={item}
                onReport={() => handleReportPress(item)}
                onUndoReport={() => handleReportPress(item)}
                reporting={undoingId === item._id}
              />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
          ListEmptyComponent={<EmptyState message="No hay lotes de fabricación todavía" />}
          ListHeaderComponent={
            <View style={styles.sectionLinkRow}>
              <TouchableOpacity onPress={() => navigation.navigate("HistorialLotes", { editable: true })}>
                <Text style={styles.sectionLink}>Ver todo</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : activeTab === "diario" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={dailyBatches}
          keyExtractor={(item, index) => item._id || item.dailyBatchNumber || String(index)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("LoteDiarioForm", { id: item._id })}
            >
              <DailyBatchCard
                dailyBatch={item}
                onSchedule={() => handleSchedule(item)}
                scheduling={schedulingId === item._id}
              />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
          ListEmptyComponent={<EmptyState message="No hay lotes diarios todavía" />}
        />
      ) : activeTab === "pedidos" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={filteredManufacturingGroups}
          keyExtractor={(g) => g.order._id}
          renderItem={({ item: g }) => (
            <OrderGroupRow
              orderNumber={g.order.orderNumber}
              customerName={g.order.customer?.name}
              countLabel={`${g.lines.length} producto(s)`}
              segments={manufacturingProgressSegments(g)}
              caption={manufacturingProgressCaption(g) || "Sin productos"}
              onPress={() => setManufacturingInfoOrderId(g.order._id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
          ListEmptyComponent={
            ordersError && manufacturingGroups.length === 0 ? (
              <ErrorState message={ordersError} onRetry={refreshOrders} />
            ) : (
              <EmptyState
                message={
                  ordersLoading
                    ? "Cargando…"
                    : hasActiveManufacturingFilters && manufacturingGroups.length > 0
                      ? "Ningún pedido coincide con los filtros."
                      : "Aún no hay pedidos enviados a fabricación."
                }
              />
            )
          }
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <SelectField
                  title="Estado"
                  value={manufacturingStatusFilter}
                  onChange={setManufacturingStatusFilter}
                  options={[
                    { label: "Estado: todos", value: "" },
                    ...MANUFACTURING_STATUS_FILTERS.map((key) => ({ label: MANUFACTURING_STATUS_LABELS[key], value: key })),
                  ]}
                />
              </View>
              <SwitchField label="Solo con pendientes" value={manufacturingOnlyPending} onValueChange={setManufacturingOnlyPending} />
              {hasActiveManufacturingFilters ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setManufacturingStatusFilter("");
                    setManufacturingOnlyPending(false);
                  }}
                >
                  <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={filteredPedidoGroups}
          keyExtractor={(g) => g.order._id}
          renderItem={({ item: g }) => (
            <OrderGroupRow
              orderNumber={g.order.orderNumber}
              customerName={g.order.customer?.name}
              countLabel={`${g.batches.length} lote(s)`}
              segments={pedidoBatchProgressSegments(g)}
              caption={pedidoBatchProgressCaption(g) || "Sin lotes"}
              onPress={() => setPedidoBatchInfoOrderId(g.order._id)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
          ListEmptyComponent={
            <EmptyState
              message={
                batchesLoading
                  ? "Cargando…"
                  : hasActivePedidoBatchFilters && pedidoGroups.length > 0
                    ? "Ningún pedido coincide con los filtros."
                    : "No hay pedidos enviados a fabricar."
              }
            />
          }
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <SelectField
                  title="Estado"
                  value={pedidoBatchStatusFilter}
                  onChange={setPedidoBatchStatusFilter}
                  options={[
                    { label: "Estado: todos", value: "" },
                    ...PEDIDO_BATCH_STATUS_FILTERS.map((key) => ({ label: PEDIDO_BATCH_STATUS_LABELS[key], value: key })),
                  ]}
                />
              </View>
              <SwitchField label="Solo con pendientes" value={pedidoBatchOnlyPending} onValueChange={setPedidoBatchOnlyPending} />
              {hasActivePedidoBatchFilters ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setPedidoBatchStatusFilter("");
                    setPedidoBatchOnlyPending(false);
                  }}
                >
                  <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {activeTab === "fabricacion" ? (
        <FloatingAddButton onPress={() => navigation.navigate("LoteFabricacionForm")} />
      ) : activeTab === "diario" ? (
        <FloatingAddButton onPress={() => navigation.navigate("LoteDiarioForm")} />
      ) : null}

      <ReportBatchModal
        visible={Boolean(reportTarget)}
        batch={reportTarget}
        warehouses={warehouses}
        saving={reporting}
        onClose={() => setReportTarget(null)}
        onSave={handleReportSave}
      />

      <ManufacturingDetailModal
        visible={Boolean(manufacturingInfoGroup)}
        group={manufacturingInfoGroup}
        busyIndex={manufacturingBusyIndex}
        onClose={() => setManufacturingInfoOrderId(null)}
        onFabricar={handleFabricar}
        onEliminar={handleEliminarManufacturingLine}
      />

      <PedidoBatchDetailModal
        visible={Boolean(pedidoBatchInfoGroup)}
        group={pedidoBatchInfoGroup}
        busyId={pedidoBatchBusyId}
        onClose={() => setPedidoBatchInfoOrderId(null)}
        onEmpacar={handleEmpacar}
        onEditar={handleEditarPedidoBatch}
        onEliminar={handleEliminarPedidoBatch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: colors.background },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tabBar: { marginBottom: 4 },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.neutralSoftBg,
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabButtonText: { fontSize: 13, fontWeight: "600", color: colors.slate500 },
  tabButtonTextActive: { color: colors.brand700, fontWeight: "700" },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 96, flexGrow: 1 },
  placeholder: { fontSize: 13, color: colors.slate500, paddingVertical: 12 },
  sectionLinkRow: { alignItems: "flex-end", marginBottom: 10 },
  sectionLink: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 },
  filterItem: { minWidth: 160 },
  clearButton: { backgroundColor: colors.neutralSoftBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
});
