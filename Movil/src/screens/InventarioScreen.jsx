import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useInventory } from "../hooks/useInventory";
import { useOrders } from "../hooks/useOrders";
import InventoryCard from "../components/inventory/InventoryCard";
import OrderGroupRow from "../components/batches/OrderGroupRow";
import PedidoInventarioDetailModal from "../components/orders/PedidoInventarioDetailModal";
import VerifyStockModal from "../components/orders/VerifyStockModal";
import KpiTile from "../components/dashboard/KpiTile";
import SegmentedField from "../components/ui/SegmentedField";
import SelectField from "../components/ui/SelectField";
import SwitchField from "../components/ui/SwitchField";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";
import { formatCurrency, formatNumber } from "../lib/format";
import { stockStatus } from "../lib/inventoryStatus";
import {
  macroStatus,
  getItemStatusCounts,
  progressSegments,
  progressCaption,
  MACRO_STATUS_LABELS,
} from "../lib/orderProgress";

const TABS = [
  { key: "articulos", label: "Artículos en almacén" },
  { key: "lotes", label: "Lotes Reportados" },
  { key: "pedidos", label: "Pedidos" },
];
const STOCK_STATUSES = ["Suficiente", "Insuficiente"];
const PEDIDOS_STATUS_FILTERS = ["sinVerificar", "verificado", "enviado", "empacado", "parcial", "entregado"];

// 3 pestañas, igual que Web/private/frontend/src/pages/Inventario.jsx:
// Artículos en almacén (con sub-secciones Materia Prima / Producto
// Terminado) + Lotes Reportados (ya existía, ahora con "Eliminar reporte"
// además de "Enviar") + Pedidos (nueva, progreso de verificación/empacado
// de los pedidos solicitados a inventario).
export default function InventarioScreen({ navigation }) {
  const { items, loading, refreshing, error, refresh, enviarAAlmacen, eliminarReporte } = useInventory();
  const {
    orders,
    loading: ordersLoading,
    refreshing: ordersRefreshing,
    error: ordersError,
    refresh: refreshOrders,
    verifyItem,
    packItem,
    sendToManufacturing,
    cancelInventoryRequest,
  } = useOrders();

  const [activeTab, setActiveTab] = useState("articulos");
  const [articleSubTab, setArticleSubTab] = useState("raw");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [sendingId, setSendingId] = useState(null);
  const [deletingReportId, setDeletingReportId] = useState(null);

  const [pedidosStatusFilter, setPedidosStatusFilter] = useState("");
  const [pedidosOnlyPending, setPedidosOnlyPending] = useState(false);
  const [pedidoInfoOrderId, setPedidoInfoOrderId] = useState(null);
  const [pedidoBusyIndex, setPedidoBusyIndex] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [sendingToManufacturing, setSendingToManufacturing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshOrders();
    }, [refresh, refreshOrders]),
  );

  const reportedItems = useMemo(
    () => items.filter((i) => i.batchNumber).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [items],
  );
  const warehouseItems = useMemo(() => items.filter((i) => !i.batchNumber), [items]);
  const rawMaterialItems = useMemo(() => warehouseItems.filter((i) => i.category === "Materia Prima"), [warehouseItems]);
  const finishedItems = useMemo(() => warehouseItems.filter((i) => i.category === "Producto Terminado"), [warehouseItems]);

  const kpis = useMemo(() => {
    const low = warehouseItems.filter((i) => stockStatus(i) === "Insuficiente").length;
    const value = warehouseItems.reduce((s, i) => s + (i.stock || 0) * (i.unitCost || 0), 0);
    return { raw: rawMaterialItems.length, finished: finishedItems.length, low, value };
  }, [warehouseItems, rawMaterialItems, finishedItems]);

  const activeArticleItems = articleSubTab === "raw" ? rawMaterialItems : finishedItems;

  const articleOptions = useMemo(() => {
    const locations = [...new Set(activeArticleItems.map((i) => i.location).filter(Boolean))].sort();
    const colorsList = [...new Set(activeArticleItems.map((i) => i.color).filter(Boolean))].sort();
    return { locations, colorsList };
  }, [activeArticleItems]);

  const filteredArticleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeArticleItems.filter((i) => {
      if (q && !i.name?.toLowerCase().includes(q)) return false;
      if (locationFilter && i.location !== locationFilter) return false;
      if (articleSubTab === "finished" && colorFilter && i.color !== colorFilter) return false;
      if (articleSubTab === "raw" && typeFilter && i.materialType !== typeFilter) return false;
      if (statusFilter && stockStatus(i) !== statusFilter) return false;
      return true;
    });
  }, [activeArticleItems, search, locationFilter, colorFilter, typeFilter, statusFilter, articleSubTab]);

  const hasActiveArticleFilters = Boolean(search || locationFilter || colorFilter || typeFilter || statusFilter);

  const requestedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.inventoryRequestedAt)
        .sort((a, b) => new Date(b.inventoryRequestedAt) - new Date(a.inventoryRequestedAt)),
    [orders],
  );
  const pedidoInfoOrder = useMemo(
    () => requestedOrders.find((o) => o._id === pedidoInfoOrderId) || null,
    [requestedOrders, pedidoInfoOrderId],
  );
  const filteredRequestedOrders = useMemo(
    () =>
      requestedOrders.filter((o) => {
        if (pedidosStatusFilter && macroStatus(o) !== pedidosStatusFilter) return false;
        if (pedidosOnlyPending && getItemStatusCounts(o).sinVerificar === 0) return false;
        return true;
      }),
    [requestedOrders, pedidosStatusFilter, pedidosOnlyPending],
  );
  const hasActivePedidosFilters = Boolean(pedidosStatusFilter || pedidosOnlyPending);

  const verifyMatches = useMemo(() => {
    if (!verifyTarget) return [];
    return finishedItems.filter(
      (i) => i.name === verifyTarget.item.product && (i.color || "") === (verifyTarget.item.color || ""),
    );
  }, [finishedItems, verifyTarget]);

  const handleSend = (item) => {
    Alert.alert(
      "Enviar a almacén",
      `Vas a enviar ${item.name} (lote ${item.batchNumber}) a Artículos en almacén. Si ya existe un producto terminado con el mismo artículo, color y bodega, sus ${Number(item.stock || 0).toLocaleString("es-SV")} ${item.unit} se sumarán a esa existencia; si no, se creará uno nuevo.`,
      [
        { text: "Cancelar" },
        {
          text: "Confirmar",
          onPress: async () => {
            setSendingId(item._id);
            try {
              await enviarAAlmacen(item._id);
            } catch (error) {
              Alert.alert("No se pudo enviar", error.message || "Intentá de nuevo");
            } finally {
              setSendingId(null);
            }
          },
        },
      ],
    );
  };

  const handleDeleteReport = (item) => {
    const msg = item.sentToWarehouse
      ? `¿Eliminar el reporte de ${item.name} (lote ${item.batchNumber})? El lote en Fabricación queda igual; como ya se había enviado a almacén, ese stock se conserva sin cambios.`
      : `¿Eliminar el reporte de ${item.name} (lote ${item.batchNumber})? El lote en Fabricación queda igual, solo deja de estar reportado.`;
    Alert.alert("Eliminar lote reportado", msg, [
      { text: "Cancelar" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setDeletingReportId(item._id);
          try {
            await eliminarReporte(item._id);
          } catch (error) {
            Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
          } finally {
            setDeletingReportId(null);
          }
        },
      },
    ]);
  };

  const handleVerify = ({ order, item, index }) => {
    setPedidoInfoOrderId(null);
    setVerifyTarget({ order, item, index });
  };

  const confirmVerify = async (warehouseName) => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      await verifyItem(verifyTarget.order._id, verifyTarget.index, warehouseName);
      setVerifyTarget(null);
      refresh();
    } catch (error) {
      Alert.alert("No se pudo verificar", error.message || "Intentá de nuevo");
    } finally {
      setVerifying(false);
    }
  };

  const handleSendToManufacturingFromVerify = async () => {
    if (!verifyTarget) return;
    setSendingToManufacturing(true);
    try {
      await sendToManufacturing(verifyTarget.order._id, verifyTarget.index);
      setVerifyTarget(null);
    } catch (error) {
      Alert.alert("No se pudo enviar", error.message || "Intentá de nuevo");
    } finally {
      setSendingToManufacturing(false);
    }
  };

  const handlePack = async ({ order, item, index }) => {
    setPedidoBusyIndex(index);
    try {
      await packItem(order._id, index);
    } catch (error) {
      Alert.alert("No se pudo empacar", error.message || "Intentá de nuevo");
    } finally {
      setPedidoBusyIndex(null);
    }
  };

  const handleCancelRequest = (order) => {
    Alert.alert(
      "Eliminar pedido",
      `¿Eliminar ${order.orderNumber} de Pedidos? Se borra todo su rastro de verificación aquí.`,
      [
        { text: "Cancelar" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelInventoryRequest(order._id);
              refresh();
            } catch (error) {
              Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingState />;
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.kpiGrid}>
          <KpiTile label="Materia prima" value={formatNumber(kpis.raw)} hint="insumos" />
          <KpiTile label="Productos terminados" value={formatNumber(kpis.finished)} hint="referencias" />
          <KpiTile label="Stock bajo" value={formatNumber(kpis.low)} hint={kpis.low ? "Reponer" : "OK"} />
          <KpiTile label="Valor del inventario" value={formatCurrency(kpis.value)} hint="estimado" />
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

      {activeTab === "articulos" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={filteredArticleItems}
          keyExtractor={(item, index) => item._id || String(index)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("InventarioItemForm", { id: item._id, category: item.category })}
            >
              <InventoryCard item={item} />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState
              message={
                hasActiveArticleFilters
                  ? "Ningún artículo coincide con los filtros."
                  : articleSubTab === "raw"
                    ? "No hay materia prima en almacén."
                    : "No hay productos terminados en almacén."
              }
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.subTabRow}>
                <SegmentedField
                  value={articleSubTab}
                  options={[
                    { key: "raw", label: "Materia Prima" },
                    { key: "finished", label: "Producto Terminado" },
                  ]}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.key}
                  onChange={setArticleSubTab}
                />
              </View>

              <TextInput
                style={styles.search}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar artículo…"
                placeholderTextColor={colors.slate400}
              />
              <View style={styles.filterRow}>
                <View style={styles.filterItem}>
                  <SelectField
                    title="Bodega"
                    value={locationFilter}
                    onChange={setLocationFilter}
                    options={[
                      { label: "Bodega: todos", value: "" },
                      ...articleOptions.locations.map((l) => ({ label: l, value: l })),
                    ]}
                  />
                </View>
                {articleSubTab === "finished" ? (
                  <View style={styles.filterItem}>
                    <SelectField
                      title="Color"
                      value={colorFilter}
                      onChange={setColorFilter}
                      options={[
                        { label: "Color: todos", value: "" },
                        ...articleOptions.colorsList.map((c) => ({ label: c, value: c })),
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.filterItem}>
                    <SelectField
                      title="Tipo"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[
                        { label: "Tipo: todos", value: "" },
                        { label: "Polimero", value: "Polimero" },
                        { label: "Aditivo", value: "Aditivo" },
                        { label: "Tinta", value: "Tinta" },
                        { label: "Insumo", value: "Insumo" },
                      ]}
                    />
                  </View>
                )}
                <View style={styles.filterItem}>
                  <SelectField
                    title="Stock"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { label: "Stock: todos", value: "" },
                      ...STOCK_STATUSES.map((s) => ({ label: s, value: s })),
                    ]}
                  />
                </View>
              </View>
              {hasActiveArticleFilters ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearch("");
                    setLocationFilter("");
                    setColorFilter("");
                    setTypeFilter("");
                    setStatusFilter("");
                  }}
                >
                  <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      ) : activeTab === "lotes" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={reportedItems}
          keyExtractor={(item, index) => item._id || item.batchNumber || String(index)}
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              onSend={() => handleSend(item)}
              sending={sendingId === item._id}
              onDeleteReport={() => handleDeleteReport(item)}
              deletingReport={deletingReportId === item._id}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<EmptyState message="Aún no hay lotes reportados desde Fabricación." />}
          ListHeaderComponent={
            <View style={styles.sectionLinkRow}>
              <TouchableOpacity onPress={() => navigation.navigate("Fabricacion")}>
                <Text style={styles.sectionLink}>Ir a Fabricación</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={filteredRequestedOrders}
          keyExtractor={(o) => o._id}
          renderItem={({ item: o }) => (
            <OrderGroupRow
              orderNumber={o.orderNumber}
              customerName={o.customer?.name}
              countLabel={`${(o.items || []).length} producto(s)`}
              segments={progressSegments(o)}
              caption={progressCaption(o) || "Sin productos"}
              onPress={() => setPedidoInfoOrderId(o._id)}
              onDelete={() => handleCancelRequest(o)}
            />
          )}
          refreshControl={<RefreshControl refreshing={ordersRefreshing} onRefresh={refreshOrders} />}
          ListEmptyComponent={
            ordersError && requestedOrders.length === 0 ? (
              <ErrorState message={ordersError} onRetry={refreshOrders} />
            ) : (
              <EmptyState
                message={
                  ordersLoading
                    ? "Cargando…"
                    : hasActivePedidosFilters && requestedOrders.length > 0
                      ? "Ningún pedido coincide con los filtros."
                      : "Aún no hay pedidos solicitados a inventario."
                }
              />
            )
          }
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <SelectField
                  title="Estado"
                  value={pedidosStatusFilter}
                  onChange={setPedidosStatusFilter}
                  options={[
                    { label: "Estado: todos", value: "" },
                    ...PEDIDOS_STATUS_FILTERS.map((key) => ({ label: MACRO_STATUS_LABELS[key], value: key })),
                  ]}
                />
              </View>
              <SwitchField label="Solo con pendientes" value={pedidosOnlyPending} onValueChange={setPedidosOnlyPending} />
              {hasActivePedidosFilters ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setPedidosStatusFilter("");
                    setPedidosOnlyPending(false);
                  }}
                >
                  <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {activeTab === "articulos" ? (
        <FloatingAddButton
          onPress={() =>
            navigation.navigate("InventarioItemForm", {
              category: articleSubTab === "raw" ? "Materia Prima" : "Producto Terminado",
            })
          }
        />
      ) : null}

      <PedidoInventarioDetailModal
        visible={Boolean(pedidoInfoOrder)}
        order={pedidoInfoOrder}
        busyIndex={pedidoBusyIndex}
        onClose={() => setPedidoInfoOrderId(null)}
        onVerify={handleVerify}
        onPack={handlePack}
      />

      <VerifyStockModal
        visible={Boolean(verifyTarget)}
        target={verifyTarget}
        matches={verifyMatches}
        verifying={verifying}
        sendingToManufacturing={sendingToManufacturing}
        onClose={() => setVerifyTarget(null)}
        onConfirm={confirmVerify}
        onSendToManufacturing={handleSendToManufacturingFromVerify}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: colors.background },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tabBar: { marginBottom: 4 },
  tabButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.neutralSoftBg, marginRight: 8 },
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
  subTabRow: { marginBottom: 12 },
  placeholder: { fontSize: 13, color: colors.slate500, paddingVertical: 12 },
  sectionLinkRow: { alignItems: "flex-end", marginBottom: 10 },
  sectionLink: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
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
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 },
  filterItem: { minWidth: 150, flexGrow: 1 },
  clearButton: { backgroundColor: colors.neutralSoftBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
});
