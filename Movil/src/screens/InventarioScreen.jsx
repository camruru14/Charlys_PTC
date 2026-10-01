import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useInventory } from "../hooks/useInventory";
import { useOrders } from "../hooks/useOrders";
import { useWarehouses } from "../hooks/useWarehouses";
import NewItemSheet from "../components/inventory/NewItemSheet";
import PrepOrderCard from "../components/inventory/PrepOrderCard";
import StockRow from "../components/inventory/StockRow";
import BottomBar from "../components/ui/BottomBar";
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
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber } from "../lib/format";
import { isBelowMinimum } from "../lib/stockLevel";
import { MATERIAL_TYPES } from "../lib/inventoryOptions";
import { useBottomPad } from "../hooks/useBottomPad";
import {
  buildStockMap,
  finishedItemsOf,
  fullyVerifiableLines,
  isDispatched,
  lastStatusAt,
  orderLineApi,
  runAll,
  unprocessedCount,
} from "../lib/inventoryOrders";

// Mismas vistas que Web/private/frontend/src/pages/Inventario.jsx.
const TABS = [
  { value: "terminado", label: "Terminado" },
  { value: "materia", label: "Materia prima" },
  { value: "pedidos", label: "Pedidos" },
];

// «Despachados» muestra los de los últimos 30 días, como la web.
const DISPATCHED_DAYS = 30;

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

function StockList({ items, showColor, emptyText, onEdit, onLongPress }) {
  if (items.length === 0) return <EmptyState message={emptyText} icon="box" />;
  return (
    <ListGroup>
      {items.map((item) => (
        <StockRow
          key={item._id}
          item={item}
          showColor={showColor}
          onPress={() => onEdit(item)}
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
  const [segment, setSegment] = useState("preparar");
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [dispatchedSince] = useState(() => Date.now() - DISPATCHED_DAYS * 86400000);

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

  const toPrepare = useMemo(() => orders.filter((o) => !isDispatched(o)), [orders]);
  const dispatched = useMemo(
    () => orders.filter((o) => isDispatched(o) && new Date(lastStatusAt(o)).getTime() >= dispatchedSince),
    [orders, dispatchedSince],
  );
  const orderList = segment === "preparar" ? toPrepare : dispatched;

  const checkedOrders = useMemo(() => toPrepare.filter((o) => checked.has(o._id)), [toPrepare, checked]);
  const bulkSummary = useMemo(() => {
    let verifiable = 0;
    let pending = 0;
    for (const o of checkedOrders) {
      const v = fullyVerifiableLines(o, stockMap).length;
      verifiable += v;
      pending += unprocessedCount(o) - v;
    }
    return { verifiable, pending, total: verifiable + pending };
  }, [checkedOrders, stockMap]);

  const changeTab = (next) => {
    setTab(next);
    setLowOnly(false);
    setSelecting(false);
    setChecked(new Set());
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

  const toggleChecked = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setChecked(new Set());
  };

  // «Verificar seleccionados» de la web: verifica de una vez las líneas con
  // existencia completa de los pedidos marcados, con «Deshacer».
  const verifySelected = async () => {
    const groups = checkedOrders
      .map((order) => ({ order, lines: fullyVerifiableLines(order, stockMap) }))
      .filter((g) => g.lines.length > 0);
    if (!groups.length) {
      Alert.alert("Nada que verificar", "Ningún producto seleccionado tiene existencia completa");
      return;
    }
    const n = groups.reduce((s, g) => s + g.lines.length, 0);
    const reload = () => Promise.all([refreshOrders(), refresh()]);
    setBusy(true);
    try {
      await orderLineApi.verifyBulk(
        groups.map((g) => ({ id: g.order._id, items: g.lines.map((l) => ({ index: l.index, warehouse: l.warehouse })) })),
      );
      await reload();
      stopSelecting();
      toast.undo(`${n} ${n === 1 ? "producto verificado" : "productos verificados"}`, async () => {
        try {
          await runAll(groups.flatMap((g) => g.lines.map((l) => () => orderLineApi.unverify(g.order._id, l.index))));
          toast.show("Cambio deshecho");
        } catch (err) {
          Alert.alert("No se pudo deshacer", err.message);
        } finally {
          reload();
        }
      });
    } catch (err) {
      Alert.alert("No se pudo verificar", err.message);
      reload();
    } finally {
      setBusy(false);
    }
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
        <Segmented options={TABS} value={tab} onChange={changeTab} />
      </View>

      {tab === "terminado" ? (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, tab === "pedidos" && selecting ? null : bottomPad]} refreshControl={inventoryRefresh} keyboardShouldPersistTaps="handled">
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
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, tab === "pedidos" && selecting ? null : bottomPad]} refreshControl={inventoryRefresh} keyboardShouldPersistTaps="handled">
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
            emptyText={rawItems.length === 0 ? "No hay materia prima en almacén." : "Ningún artículo coincide con los filtros."}
            onEdit={editItem}
            onLongPress={openItemMenu}
          />
          <Text style={styles.summary}>
            {formatNumber(rawFiltered.length)} de {formatNumber(rawItems.length)} artículos
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          contentContainerStyle={[styles.content, tab === "pedidos" && selecting ? null : bottomPad]}
          data={orderList}
          keyExtractor={(o) => o._id}
          renderItem={({ item: o }) => (
            <PrepOrderCard
              order={o}
              stockMap={stockMap}
              selecting={selecting}
              checked={checked.has(o._id)}
              onPress={() => (selecting ? toggleChecked(o._id) : navigation.navigate("PedidoDetalle", { id: o._id }))}
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
              <View style={styles.ordersChipsRow}>
                <FilterChips
                  style={styles.flex}
                  value={segment}
                  onChange={(key) => {
                    setSegment(key);
                    stopSelecting();
                  }}
                  options={[
                    { value: "preparar", label: "Por preparar", count: toPrepare.length },
                    { value: "despachados", label: "Despachados", count: dispatched.length },
                  ]}
                />
                {segment === "preparar" && toPrepare.length > 0 ? (
                  <Pressable
                    onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>{selecting ? "Listo" : "Seleccionar"}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.hint}>
                {selecting ? "Marca los pedidos a verificar de una vez" : "Salen de aquí al recogerse todo"}
              </Text>
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
                    : segment === "preparar"
                      ? "No hay pedidos por preparar."
                      : "No hay pedidos despachados en los últimos 30 días."
                }
              />
            )
          }
        />
      )}

      {tab === "pedidos" && selecting ? (
        <BottomBar
          note={
            checkedOrders.length
              ? `${formatNumber(bulkSummary.verifiable)} de ${formatNumber(bulkSummary.total)} productos tienen existencia completa y se verificarán · ${formatNumber(bulkSummary.pending)} quedarán pendientes por revisar`
              : "Ningún pedido marcado"
          }
          actions={[
            { title: "Cancelar", variant: "secondary", disabled: busy, onPress: stopSelecting },
            {
              title: `Verificar${checkedOrders.length ? ` · ${checkedOrders.length}` : ""}`,
              icon: "check",
              loading: busy,
              disabled: bulkSummary.verifiable === 0,
              onPress: verifySelected,
            },
          ]}
        />
      ) : null}

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
  ordersHeader: { marginBottom: 12 },
  ordersChipsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  hint: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
