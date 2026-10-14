import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { useInventory } from "../hooks/useInventory";
import { useOrders } from "../hooks/useOrders";
import { useWarehouses } from "../hooks/useWarehouses";
import NewItemSheet from "../components/inventory/NewItemSheet";
import PrepOrderCard from "../components/inventory/PrepOrderCard";
import StockRow from "../components/inventory/StockRow";
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
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { useDateRange, rangeLabel } from "../context/DateRangeContext";
import { colors, getTone, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { isBelowMinimum } from "../lib/stockLevel";
import { MATERIAL_TYPES } from "../lib/inventoryOptions";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";
import MarkAllSeen from "../components/ui/MarkAllSeen";
import { useActivity } from "../hooks/useActivity";
import {
  buildStockMap,
  finishedItemsOf,
  groupInventoryOrders,
  matchesOrderQuery,
  ORDER_GROUPS,
} from "../lib/inventoryOrders";

// Mismas vistas que Web/private/frontend/src/pages/Inventario.jsx.
const TABS = [
  { value: "terminado", label: "Terminado" },
  { value: "materia", label: "Materia prima" },
  { value: "pedidos", label: "Pedidos" },
];

// Chip rosa «Bajo mínimo» junto al buscador: filtra solo esos artículos
// (LowStockToggle de la web). Activo, se pinta en primary y se quita con
// otro toque. Sin artículos bajo mínimo (y sin el filtro puesto) no aparece.
function LowStockChip({ active, count, onToggle }) {
  if (!active && count === 0) return null;
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? "Quitar filtro de bajo mínimo" : `Solo bajo mínimo, ${count} artículos`}
      style={[styles.lowChip, active && styles.lowChipActive]}
    >
      <Icon name={active ? "close" : "alert"} size={15} color={active ? colors.white : tones.rose.text} />
      <Text style={[styles.lowChipText, active && styles.lowChipTextActive]}>{count}</Text>
    </Pressable>
  );
}

// `activityKey`: la pestaña de novedades de estos artículos (se marcan hasta tocarlos).
function StockList({ items, showColor, emptyText, activityKey, onEdit, onLongPress }) {
  const { isUnseen, markSeen } = useActivity();
  if (items.length === 0) return <EmptyState message={emptyText} icon="box" />;
  return (
    <ListGroup>
      {items.map((item) => (
        <StockRow
          key={item._id}
          item={item}
          showColor={showColor}
          unseen={isUnseen(activityKey, item._id)}
          onPress={() => {
            markSeen(activityKey, item._id);
            onEdit(item);
          }}
          onLongPress={() => onLongPress(item)}
        />
      ))}
    </ListGroup>
  );
}

// Inventario: Producto terminado, Materia prima y Pedidos por preparar, como
// la web. «Nuevo artículo» (solo Materia prima) abre una hoja; tocar un
// artículo abre su edición (InventarioItemFormScreen) y mantenerlo
// presionado ofrece eliminarlo. Tocar un pedido abre su detalle, donde se
// verifica, empaca y resuelven faltantes.
export default function InventarioScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { items, loading, refreshing, error, refresh, crear, eliminar } = useInventory();
  const {
    orders,
    loading: ordersLoading,
    refreshing: ordersRefreshing,
    error: ordersError,
    refresh: refreshOrders,
  } = useOrders();
  const { warehouses: warehouseList } = useWarehouses();
  const warehouses = useMemo(() => warehouseList.map((w) => w.name), [warehouseList]);

  // Novedades: burbuja de cada pestaña y registros marcados hasta que se abren.
  const { counts, isUnseen, markSeen } = useActivity();
  const tabs = TABS.map((t) => ({ ...t, badge: counts[`inventario.${t.value}`] }));

  const [tab, setTab] = useState("terminado");
  const [lowOnly, setLowOnly] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // Filtros de Producto terminado
  const [finishedSearch, setFinishedSearch] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("");
  // Filtros de Materia prima
  const [rawSearch, setRawSearch] = useState("");
  const [materialType, setMaterialType] = useState("");
  // Pedidos
  const range = useDateRange();
  const [estado, setEstado] = useState("");
  const [orderQuery, setOrderQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshOrders();
    }, [refresh, refreshOrders]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle:
        tab === "pedidos"
          ? "Pedidos — llegan solos, se verifican de una vez y se empacan sin confirmación"
          : "Materia prima y producto terminado",
      headerRight:
        tab === "materia"
          ? () => (
              <IconButton icon="plus" variant="primary" onPress={() => setNewOpen(true)} accessibilityLabel="Nuevo artículo" />
            )
          : tab === "pedidos"
            ? // El rango de fechas solo filtra Recogido, En Tránsito y Entregado.
              () => <DateRangeButton />
            : undefined,
    });
  }, [navigation, tab]);

  // Stock real, dividido por categoría. Los artículos con batchNumber son
  // reportes de lote, no stock (se excluyen igual que en la web).
  const finishedItems = useMemo(() => finishedItemsOf(items), [items]);
  const rawItems = useMemo(() => items.filter((i) => !i.batchNumber && i.category === "Materia Prima"), [items]);
  const stockMap = useMemo(() => buildStockMap(finishedItems), [finishedItems]);

  const tabItems = tab === "materia" ? rawItems : finishedItems;
  const lowCount = useMemo(() => tabItems.filter(isBelowMinimum).length, [tabItems]);

  const finishedOptions = useMemo(
    () => ({
      locations: [...new Set(finishedItems.map((i) => i.location).filter(Boolean))].sort(),
      colors: [...new Set(finishedItems.map((i) => i.color).filter(Boolean))].sort(),
    }),
    [finishedItems],
  );

  const finishedFiltered = useMemo(() => {
    const q = finishedSearch.trim().toLowerCase();
    return finishedItems.filter((i) => {
      if (lowOnly && !isBelowMinimum(i)) return false;
      if (q && !`${i.name || ""} ${i.color || ""}`.toLowerCase().includes(q)) return false;
      if (location && i.location !== location) return false;
      if (color && i.color !== color) return false;
      return true;
    });
  }, [finishedItems, lowOnly, finishedSearch, location, color]);

  const rawFiltered = useMemo(() => {
    const q = rawSearch.trim().toLowerCase();
    return rawItems.filter((i) => {
      if (lowOnly && !isBelowMinimum(i)) return false;
      if (q && !(i.name || "").toLowerCase().includes(q)) return false;
      if (materialType && i.materialType !== materialType) return false;
      return true;
    });
  }, [rawItems, lowOnly, rawSearch, materialType]);

  // Grupos con la búsqueda y el rango (los conteos del filtro «Estado» salen de
  // aquí); no se muestran los vacíos ni los que no son el estado elegido.
  const foundOrders = useMemo(() => orders.filter((o) => matchesOrderQuery(o, orderQuery)), [orders, orderQuery]);
  const allGroups = useMemo(() => groupInventoryOrders(foundOrders, range), [foundOrders, range]);
  const orderGroups = useMemo(
    () => allGroups.filter((g) => g.items.length > 0 && (!estado || g.key === estado)),
    [allGroups, estado],
  );
  const orderSections = useMemo(
    () => orderGroups.map((g) => ({ key: g.key, group: g, title: g.label, note: g.note, count: g.items.length, data: g.items })),
    [orderGroups],
  );
  const visibleCount = useMemo(() => orderGroups.reduce((n, g) => n + g.items.length, 0), [orderGroups]);
  const stateOptions = useMemo(
    () =>
      allGroups.map((g) => ({
        value: g.key,
        label: g.status,
        dot: getTone(statusTone(g.status, "pedido-inventario")).dot,
        meta: formatNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    [allGroups],
  );
  const totalFound = useMemo(() => allGroups.reduce((n, g) => n + g.items.length, 0), [allGroups]);
  const estadoGroup = ORDER_GROUPS.find((g) => g.key === estado);

  const changeTab = (next) => {
    setTab(next);
    setLowOnly(false);
  };

  const editItem = (item) => navigation.navigate("InventarioItemForm", { id: item._id });

  const openItemMenu = (item) => {
    const label = `${item.name}${item.color ? ` · ${item.color}` : ""}`;
    Alert.alert(label, undefined, [
      { text: "Editar", onPress: () => editItem(item) },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert("Eliminar artículo", `¿Eliminar ${label}?`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Eliminar",
              style: "destructive",
              onPress: async () => {
                try {
                  await eliminar(item._id);
                  toast.show("Artículo eliminado");
                } catch (err) {
                  Alert.alert("No se pudo eliminar", err.message);
                }
              },
            },
          ]),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleCreate = async (payload) => {
    await crear(payload);
    setNewOpen(false);
    toast.show("Artículo agregado");
  };

  if (loading) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const kpis =
    tab === "terminado"
      ? [
          { label: "Artículos", value: formatNumber(finishedItems.length), tone: "blue" },
          {
            label: "Unidades",
            value: formatNumber(finishedItems.reduce((s, i) => s + (Number(i.stock) || 0), 0)),
            tone: "green",
          },
          { label: "Bajo mín.", value: formatNumber(lowCount), tone: "rose" },
        ]
      : [
          { label: "Artículos", value: formatNumber(rawItems.length), tone: "blue" },
          { label: "Bajo mín.", value: formatNumber(lowCount), tone: "rose" },
        ];

  const inventoryRefresh = <RefreshControl refreshing={refreshing} onRefresh={refresh} />;

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Segmented options={tabs} value={tab} onChange={changeTab} />
      </View>

      {tab === "terminado" ? (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, bottomPad]} refreshControl={inventoryRefresh} keyboardShouldPersistTaps="handled">
          <MarkAllSeen activityKey="inventario.terminado" />
          <KpiInline items={kpis} style={styles.kpis} />
          <View style={styles.searchRow}>
            <SearchField
              value={finishedSearch}
              onChangeText={setFinishedSearch}
              placeholder="Buscar artículo o color"
              style={styles.flex}
            />
            <LowStockChip active={lowOnly} count={lowCount} onToggle={() => setLowOnly((v) => !v)} />
          </View>
          <View style={styles.filterRow}>
            <SelectField
              style={styles.filterItem}
              title="Bodega"
              value={location}
              onChange={setLocation}
              options={[{ label: "Bodega: todas", value: "" }, ...finishedOptions.locations.map((l) => ({ label: l, value: l }))]}
            />
            <SelectField
              style={styles.filterItem}
              title="Color"
              value={color}
              onChange={setColor}
              options={[{ label: "Color: todos", value: "" }, ...finishedOptions.colors.map((c) => ({ label: c, value: c }))]}
            />
          </View>
          <StockList
            items={finishedFiltered}
            activityKey="inventario.terminado"
            showColor
            emptyText={finishedItems.length === 0 ? "No hay productos terminados en almacén." : "Ningún artículo coincide con los filtros."}
            onEdit={editItem}
            onLongPress={openItemMenu}
          />
          <Text style={styles.summary}>
            {formatNumber(finishedFiltered.length)} de {formatNumber(finishedItems.length)} artículos ·{" "}
            {formatNumber(finishedFiltered.reduce((s, i) => s + (Number(i.stock) || 0), 0))} unidades en total
          </Text>
        </ScrollView>
      ) : tab === "materia" ? (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, bottomPad]} refreshControl={inventoryRefresh} keyboardShouldPersistTaps="handled">
          <MarkAllSeen activityKey="inventario.materia" />
          <KpiInline items={kpis} style={styles.kpis} />
          <FilterChips
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
            value={materialType}
            onChange={setMaterialType}
            options={[
              { value: "", label: "Todos", count: rawItems.length },
              ...MATERIAL_TYPES.map((t) => ({
                value: t,
                label: t,
                count: rawItems.filter((i) => i.materialType === t).length,
              })),
            ]}
          />
          <View style={styles.searchRow}>
            <SearchField value={rawSearch} onChangeText={setRawSearch} placeholder="Buscar artículo" style={styles.flex} />
            <LowStockChip active={lowOnly} count={lowCount} onToggle={() => setLowOnly((v) => !v)} />
          </View>
          <StockList
            items={rawFiltered}
            activityKey="inventario.materia"
            emptyText={rawItems.length === 0 ? "No hay materia prima en almacén." : "Ningún artículo coincide con los filtros."}
            onEdit={editItem}
            onLongPress={openItemMenu}
          />
          <Text style={styles.summary}>
            {formatNumber(rawFiltered.length)} de {formatNumber(rawItems.length)} artículos
          </Text>
        </ScrollView>
      ) : (
        <SectionList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          sections={orderSections}
          keyExtractor={(o) => o._id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <GroupHeader title={section.title} note={section.note} count={section.count} />}
          renderItem={({ item: o, section }) => (
            <PrepOrderCard
              order={o}
              stockMap={stockMap}
              group={section.group}
              unseen={isUnseen("inventario.pedidos", o._id)}
              onPress={() => {
                markSeen("inventario.pedidos", o._id);
                navigation.navigate("PedidoDetalle", { id: o._id, activityKey: "inventario.pedidos" });
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={ordersRefreshing}
              onRefresh={() => {
                refreshOrders();
                refresh();
              }}
            />
          }
          ListHeaderComponent={
            <View style={styles.ordersHeader}>
              <MarkAllSeen activityKey="inventario.pedidos" />
              <SearchField value={orderQuery} onChangeText={setOrderQuery} placeholder="Buscar por pedido o cliente" />
              <View style={styles.ordersChipsRow}>
                <FilterSelectChip
                  label="Estado"
                  allLabel="todos"
                  allMeta={formatNumber(totalFound)}
                  size="lg"
                  value={estado}
                  options={stateOptions}
                  onChange={setEstado}
                />
                <View style={styles.ordersSummary}>
                  <Text style={styles.summaryCount}>
                    {formatNumber(visibleCount)} {visibleCount === 1 ? "pedido" : "pedidos"}
                  </Text>
                  <Text style={styles.summaryRange} numberOfLines={1}>
                    {rangeLabel(range)}
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            ordersError && orders.length === 0 ? (
              <ErrorState message={ordersError} onRetry={refreshOrders} />
            ) : (
              <EmptyState
                icon="orders"
                message={
                  ordersLoading
                    ? "Cargando pedidos…"
                    : estadoGroup
                      ? `No hay pedidos «${estadoGroup.status}» ${estadoGroup.ranged ? "en este rango" : "con estos filtros"}.`
                      : orderQuery.trim()
                        ? "No hay pedidos con estos filtros."
                        : "No hay pedidos."
                }
              />
            )
          }
        />
      )}

      <NewItemSheet visible={newOpen} warehouses={warehouses} onClose={() => setNewOpen(false)} onCreate={handleCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  kpis: { marginBottom: 12 },
  chips: { marginHorizontal: -20, marginBottom: 12 },
  chipsContent: { paddingHorizontal: 20 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  lowChip: {
    height: 42,
    minWidth: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: tones.rose.bg,
  },
  lowChipActive: { backgroundColor: colors.primary },
  lowChipText: { fontFamily: fonts.bold, fontSize: 13, color: tones.rose.text, fontVariant: ["tabular-nums"] },
  lowChipTextActive: { color: colors.white },
  filterRow: { flexDirection: "row", gap: 10 },
  filterItem: { flex: 1, marginBottom: 12 },
  summary: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  ordersHeader: { gap: 10, marginBottom: 12 },
  ordersChipsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ordersSummary: { flex: 1, alignItems: "flex-end" },
  summaryCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  summaryRange: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
