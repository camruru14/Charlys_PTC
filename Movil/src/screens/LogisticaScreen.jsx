import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import { useRoutes } from "../hooks/useRoutes";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useMovedIds } from "../hooks/useMovedIds";
import DispatchOrderCard from "../components/logistics/DispatchOrderCard";
import MovedFlash from "../components/logistics/MovedFlash";
import RouteCard from "../components/logistics/RouteCard";
import { NewRouteSheet } from "../components/logistics/RouteSheets";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import DateRangeButton from "../components/ui/DateRangeButton";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import Segmented from "../components/ui/Segmented";
import SearchField from "../components/ui/SearchField";
import { useToast } from "../components/ui/Toast";
import { useDateRange } from "../context/DateRangeContext";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber, formatShortDate } from "../lib/format";
import {
  DISPATCH_GROUPS,
  ROUTE_GROUPS,
  dispatchCounts,
  dispatchGroup,
  dispatchOrders,
  groupDispatchOrders,
  canRemoveFromRoute,
  groupRoutes,
  matchesQuery,
  routeCounts,
  routeGroup,
  routeIdOf,
  routeLabel,
  routeRef,
  routeSearchText,
} from "../lib/logistics";
import { useBottomPad } from "../hooks/useBottomPad";

// Mismas vistas que Web/private/frontend/src/pages/Logistica.jsx.
const TABS = [
  { value: "transito", label: "En tránsito" },
  { value: "despacho", label: "Para despacho" },
];

// Chips: «Todos»/«Todas» más uno por grupo de la jerarquía (lib/logistics.js,
// igual que la web).
const DISPATCH_CHIPS = [{ value: "todos", label: "Todos" }, ...DISPATCH_GROUPS.map((g) => ({ value: g.key, label: g.chip }))];
const ROUTE_CHIPS = [{ value: "todas", label: "Todas" }, ...ROUTE_GROUPS.map((g) => ({ value: g.key, label: g.chip }))];

// Refresco automático de los datos de Logística (cambios del panel web, de
// otra persona o de Fabricación) mientras la pantalla está enfocada.
const REFRESH_MS = 15000;

function SectionHeader({ title, count }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

// Logística con rutas (/routes), como la web: En tránsito lista las rutas (todas
// las activas más las completadas del rango de fechas global, por defecto esta
// semana; tocar una abre su seguimiento, RutaDetalleScreen); Para despacho no
// se filtra por fecha y lista
// los pedidos empacados que todavía no salen y los agrega a la ruta que se
// está armando. «+» arma una ruta nueva. Las dos listas van agrupadas por
// jerarquía, con chips por estado, y se recalculan solas con cada lectura.
export default function LogisticaScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const {
    routes,
    availability,
    loading,
    refreshing,
    error,
    refresh,
    refreshQuiet,
    crear,
    addOrder,
    removeOrder,
  } = useRoutes();
  const {
    orders: allOrders,
    refreshing: ordersRefreshing,
    error: ordersError,
    refresh: refreshOrders,
    refreshQuiet: refreshOrdersQuiet,
  } = useOrders();

  const [tab, setTab] = useState("transito");
  const [filter, setFilter] = useState("todos");
  const [routeFilter, setRouteFilter] = useState("todas");
  const [orderQuery, setOrderQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const range = useDateRange();
  const [buildingId, setBuildingId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  // Acciones en curso, por clave («order:<id>»): cada botón solo se bloquea
  // mientras corre SU acción, no todos a la vez.
  const [pending, setPending] = useState(() => new Set());
  const isBusy = (key) => pending.has(key);

  // Lectura en segundo plano cada 15 s (y al enfocar la pantalla o volver a la
  // app): sin spinner, sin tocar errores y sin solaparse con otra lectura ni
  // con una acción en curso. El pull-to-refresh manual sigue igual.
  useAutoRefresh(
    () => {
      if (pending.size > 0) return;
      refreshQuiet();
      refreshOrdersQuiet();
    },
    { interval: REFRESH_MS },
  );

  // Rango elegido, en texto («28 sep – 1 oct»); «Todo» no tiene fechas.
  const rangeText = range.from ? `${formatShortDate(range.from)} – ${formatShortDate(range.preset || !range.to ? new Date() : range.to)}` : "Todo";

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle: tab === "transito" ? `Rutas · ${rangeText}` : "Una ruta, varios pedidos",
      // El selector de rango (el mismo de Finanzas) solo va en En tránsito.
      headerRight: () => (
        <View style={styles.headerActions}>
          {tab === "transito" ? <DateRangeButton /> : null}
          <IconButton icon="plus" variant="primary" onPress={() => setNewOpen(true)} accessibilityLabel="Armar ruta" />
        </View>
      ),
    });
  }, [navigation, tab, rangeText]);

  const orders = useMemo(() => dispatchOrders(allOrders), [allOrders]);
  const unassigned = useMemo(() => orders.filter((o) => !o.delivery?.route).length, [orders]);

  // Ruta que se está armando: la elegida, o la primera que todavía no sale.
  const pendingRoutes = useMemo(() => routes.filter((r) => !r.departedAt), [routes]);
  const buildingRoute = pendingRoutes.find((r) => r._id === buildingId) || pendingRoutes[0] || null;
  const routesById = useMemo(() => new Map(routes.map((r) => [String(r._id), r])), [routes]);

  // Todo se recalcula con cada lectura: grupos, orden, chips y conteos.
  // La búsqueda mira el pedido, el cliente y la ruta (por código, completo o
  // parcial) en Para despacho, y el código, la zona, el motorista y la placa
  // en las rutas. Los conteos de los chips siguen a la búsqueda.
  const foundOrders = useMemo(
    () =>
      orders.filter((o) =>
        matchesQuery(
          [o.orderNumber, o.customer?.name, o.delivery?.route ? `${routeLabel(o.delivery.route)} ${o.delivery.route.zone || ""}` : ""]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          orderQuery,
        ),
      ),
    [orders, orderQuery],
  );
  const foundRoutes = useMemo(() => routes.filter((r) => matchesQuery(routeSearchText(r), routeQuery)), [routes, routeQuery]);
  const dispatchChipCounts = useMemo(() => dispatchCounts(foundOrders), [foundOrders]);
  const routeChipCounts = useMemo(() => routeCounts(foundRoutes), [foundRoutes]);
  const orderSections = useMemo(
    () => groupDispatchOrders(foundOrders, filter).map((g) => ({ key: g.key, title: g.label, count: g.items.length, data: g.items })),
    [foundOrders, filter],
  );
  const routeSections = useMemo(
    () => groupRoutes(foundRoutes, routeFilter).map((g) => ({ key: g.key, title: g.label, count: g.items.length, data: g.items })),
    [foundRoutes, routeFilter],
  );
  const movedOrders = useMovedIds(orders, dispatchGroup);
  const movedRoutes = useMovedIds(routes, routeGroup);

  const reloadAll = () => Promise.all([refresh(), refreshOrders()]);
  const openRoute = (id) => navigation.navigate("RutaDetalle", { id });

  // Acción directa: si hay `undo`, el Toast ofrece «Deshacer».
  async function act(run, message, undo, key = "global") {
    setPending((prev) => new Set(prev).add(key));
    try {
      await run();
      refreshOrders();
      if (undo) {
        toast.undo(message, async () => {
          try {
            await undo();
            toast.show("Cambio deshecho");
          } catch (err) {
            Alert.alert("No se pudo deshacer", err.message);
          } finally {
            reloadAll();
          }
        });
      } else {
        toast.show(message);
      }
    } catch (err) {
      Alert.alert("No se pudo completar", err.message);
      // La ruta pudo cambiar en otro lado: se vuelve a leer todo.
      reloadAll();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const add = (order) => {
    const route = buildingRoute;
    act(
      () => addOrder(route._id, order._id),
      `${order.orderNumber} agregado a ${routeRef(route)}`,
      () => removeOrder(route._id, order._id),
      `order:${order._id}`,
    );
  };

  // Quitar un pedido de su ruta (solo antes de salir y de recoger su lugar;
  // canRemoveFromRoute decide si se ofrece el botón). Confirma y el pedido
  // vuelve a Para despacho.
  const removeFromRoute = (order, route) => {
    Alert.alert("Quitar de la ruta", `¿Quitar ${order.orderNumber} de ${routeRef(route)}? El pedido volverá a Para despacho.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () =>
          act(
            () => removeOrder(route._id, order._id),
            `${order.orderNumber} quitado de ${routeRef(route)}`,
            () => addOrder(route._id, order._id),
            `order:${order._id}`,
          ),
      },
    ]);
  };

  const createRoute = async (body) => {
    const route = await crear(body);
    setNewOpen(false);
    toast.show(`${routeLabel(route)} creada`);
    // Como la web: la ruta nueva queda abierta en Para despacho para
    // agregarle pedidos.
    setBuildingId(route._id);
    setTab("despacho");
    refreshOrders();
  };

  const header = (
    <View style={styles.header}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  const newRouteSheet = (
    <NewRouteSheet
      visible={newOpen}
      availability={availability}
      onClose={() => setNewOpen(false)}
      onCreate={createRoute}
    />
  );

  if (tab === "transito") {
    let body;
    if (loading && !routes.length) body = <LoadingState />;
    else if (error && !routes.length) body = <ErrorState message={error} onRetry={refresh} />;
    else
      body = (
        <SectionList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          sections={routeSections}
          keyExtractor={(r) => r._id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <SearchField value={routeQuery} onChangeText={setRouteQuery} placeholder="Buscar por código, zona o motorista" />
              <FilterChips
                options={ROUTE_CHIPS.map((c) => ({ ...c, count: routeChipCounts[c.value] }))}
                value={routeFilter}
                onChange={setRouteFilter}
              />
            </View>
          }
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} />}
          renderItem={({ item }) => (
            <MovedFlash moved={movedRoutes.has(String(item._id))}>
              <RouteCard route={item} onPress={() => openRoute(item._id)} />
            </MovedFlash>
          )}
          refreshControl={<RefreshControl refreshing={refreshing || ordersRefreshing} onRefresh={reloadAll} />}
          ListEmptyComponent={
            routes.length ? (
              <EmptyState icon="truck" title="Ninguna ruta coincide con el filtro o la búsqueda." />
            ) : (
              <EmptyState icon="truck" title="No hay rutas en este rango." message="Cambia el rango de fechas o arma una con «+»." />
            )
          }
          ListFooterComponent={
            <Card style={styles.unassigned}>
              <Text style={styles.unassignedText}>
                <Text style={styles.strong}>
                  {formatNumber(unassigned)} {unassigned === 1 ? "pedido" : "pedidos"}
                </Text>{" "}
                sin ruta asignada
              </Text>
              <Button
                title="Asignar"
                variant="soft"
                size="small"
                onPress={() => {
                  setFilter("todos");
                  setTab("despacho");
                }}
              />
            </Card>
          }
        />
      );
    return (
      <View style={styles.screen}>
        {header}
        {body}
        {newRouteSheet}
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <SearchField value={orderQuery} onChangeText={setOrderQuery} placeholder="Buscar por pedido, cliente o ruta" />
      <FilterChips
        options={DISPATCH_CHIPS.map((c) => ({ ...c, count: dispatchChipCounts[c.value] }))}
        value={filter}
        onChange={setFilter}
      />
      {pendingRoutes.length > 1 ? (
        <View style={styles.routePicker}>
          <Text style={styles.pickerLabel}>Rutas por salir</Text>
          <FilterChips
            options={pendingRoutes.map((r) => ({ value: r._id, label: `${routeLabel(r)} · ${r.zone}` }))}
            value={buildingRoute?._id}
            onChange={setBuildingId}
          />
        </View>
      ) : null}
      {buildingRoute ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} numberOfLines={1}>
            Armando <Text style={styles.noticeStrong}>{routeLabel(buildingRoute)}</Text> ·{" "}
            {formatNumber(buildingRoute.orders?.length || 0)}{" "}
            {buildingRoute.orders?.length === 1 ? "pedido" : "pedidos"}
          </Text>
          <Pressable onPress={() => openRoute(buildingRoute._id)} hitSlop={8} accessibilityRole="link">
            <Text style={styles.noticeLink}>Ver ruta</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Ninguna ruta por salir</Text>
          <Pressable onPress={() => setNewOpen(true)} hitSlop={8} accessibilityRole="link">
            <Text style={styles.noticeLink}>Armar ruta</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      {ordersError && !allOrders.length ? (
        <ErrorState message={ordersError} onRetry={refreshOrders} />
      ) : (
        <SectionList
          style={styles.flex}
          contentContainerStyle={[styles.content, bottomPad]}
          sections={orderSections}
          keyExtractor={(o) => o._id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={listHeader}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} />}
          renderItem={({ item, section }) => (
            <MovedFlash moved={movedOrders.has(String(item._id))}>
              <DispatchOrderCard
                order={item}
                group={section.key}
                route={routesById.get(routeIdOf(item))}
                buildingRoute={buildingRoute}
                busy={isBusy(`order:${item._id}`)}
                onAdd={add}
                onRemove={removeFromRoute}
                onOpenRoute={openRoute}
                onNewRoute={() => setNewOpen(true)}
                onPress={() => navigation.navigate("PedidoDetalle", { id: item._id })}
              />
            </MovedFlash>
          )}
          refreshControl={<RefreshControl refreshing={refreshing || ordersRefreshing} onRefresh={reloadAll} />}
          ListEmptyComponent={
            <EmptyState
              icon="orders"
              message={orders.length ? "Ningún pedido coincide con el filtro o la búsqueda." : "No hay pedidos empacados por despachar."}
            />
          }
        />
      )}
      {newRouteSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  listHeader: { gap: 12, marginBottom: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: colors.canvas,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.subtle },
  sectionCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  routePicker: { gap: 6 },
  pickerLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.primarySoftText },
  noticeStrong: { fontFamily: fonts.bold },
  noticeLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  unassigned: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  unassignedText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.ink2 },
  strong: { fontFamily: fonts.bold, color: colors.ink },
});
