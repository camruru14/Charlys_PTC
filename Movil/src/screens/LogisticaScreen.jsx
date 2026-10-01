import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import { useRoutes } from "../hooks/useRoutes";
import DispatchOrderCard from "../components/logistics/DispatchOrderCard";
import RouteCard from "../components/logistics/RouteCard";
import { NewRouteSheet } from "../components/logistics/RouteSheets";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import Segmented from "../components/ui/Segmented";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatNumber, formatShortDate } from "../lib/format";
import { dispatchInfo, dispatchOrders } from "../lib/logistics";

// Mismas vistas que Web/private/frontend/src/pages/Logistica.jsx.
const TABS = [
  { value: "transito", label: "En tránsito" },
  { value: "despacho", label: "Para despacho" },
];

const CHIPS = [
  { value: "todos", label: "Todos", test: () => true },
  { value: "sin-ruta", label: "Sin ruta", test: (o) => !o.delivery?.route },
  { value: "incompletos", label: "Incompletos", test: (o) => !dispatchInfo(o).ready },
];

// Logística con rutas (/routes), como la web: En tránsito lista las rutas de
// hoy (tocar una abre su seguimiento, RutaDetalleScreen); Para despacho lista
// los pedidos empacados que todavía no salen y los agrega a la ruta que se
// está armando. «+» arma una ruta nueva.
export default function LogisticaScreen({ navigation }) {
  const toast = useToast();
  const {
    routes,
    availability,
    nextNumber,
    loading,
    refreshing,
    error,
    refresh,
    crear,
    addOrder,
    removeOrder,
  } = useRoutes();
  const { orders: allOrders, refreshing: ordersRefreshing, error: ordersError, refresh: refreshOrders } = useOrders();

  const [tab, setTab] = useState("transito");
  const [filter, setFilter] = useState("todos");
  const [buildingId, setBuildingId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshOrders();
    }, [refresh, refreshOrders]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      subtitle: tab === "transito" ? `Rutas de hoy · ${formatShortDate(new Date())}` : "Una ruta, varios pedidos",
      headerRight: () => (
        <IconButton icon="plus" variant="primary" onPress={() => setNewOpen(true)} accessibilityLabel="Armar ruta" />
      ),
    });
  }, [navigation, tab]);

  const orders = useMemo(() => dispatchOrders(allOrders), [allOrders]);
  const unassigned = useMemo(() => orders.filter((o) => !o.delivery?.route).length, [orders]);

  // Ruta que se está armando: la elegida, o la primera que todavía no sale.
  const pendingRoutes = useMemo(() => routes.filter((r) => !r.departedAt), [routes]);
  const buildingRoute = pendingRoutes.find((r) => r._id === buildingId) || pendingRoutes[0] || null;

  const counts = useMemo(
    () => Object.fromEntries(CHIPS.map((c) => [c.value, orders.filter(c.test).length])),
    [orders],
  );
  const visibleOrders = useMemo(
    () => orders.filter((CHIPS.find((c) => c.value === filter) || CHIPS[0]).test),
    [orders, filter],
  );

  const reloadAll = () => Promise.all([refresh(), refreshOrders()]);
  const openRoute = (id) => navigation.navigate("RutaDetalle", { id });

  // Acción directa: si hay `undo`, el Toast ofrece «Deshacer».
  async function act(run, message, undo) {
    setBusy(true);
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
      setBusy(false);
    }
  }

  const add = (order) => {
    const route = buildingRoute;
    act(
      () => addOrder(route._id, order._id),
      `${order.orderNumber} agregado a la Ruta ${route.number}`,
      () => removeOrder(route._id, order._id),
    );
  };

  const createRoute = async (body) => {
    const route = await crear(body);
    setNewOpen(false);
    toast.show(`Ruta ${route.number} creada`);
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
      nextNumber={nextNumber}
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
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.content}
          data={routes}
          keyExtractor={(r) => r._id}
          renderItem={({ item }) => <RouteCard route={item} onPress={() => openRoute(item._id)} />}
          refreshControl={<RefreshControl refreshing={refreshing || ordersRefreshing} onRefresh={reloadAll} />}
          ListEmptyComponent={
            <EmptyState icon="truck" title="Todavía no hay rutas hoy." message="Arma una con «+»." />
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
                  setFilter("sin-ruta");
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
      <FilterChips
        options={CHIPS.map((c) => ({ value: c.value, label: c.label, count: counts[c.value] }))}
        value={filter}
        onChange={setFilter}
      />
      {pendingRoutes.length > 1 ? (
        <View style={styles.routePicker}>
          <Text style={styles.pickerLabel}>Rutas por salir</Text>
          <FilterChips
            options={pendingRoutes.map((r) => ({ value: r._id, label: `Ruta ${r.number} · ${r.zone}` }))}
            value={buildingRoute?._id}
            onChange={setBuildingId}
          />
        </View>
      ) : null}
      {buildingRoute ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} numberOfLines={1}>
            Armando <Text style={styles.noticeStrong}>Ruta {buildingRoute.number}</Text> ·{" "}
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
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.content}
          data={visibleOrders}
          keyExtractor={(o) => o._id}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <DispatchOrderCard
              order={item}
              buildingRoute={buildingRoute}
              busy={busy}
              onAdd={add}
              onOpenRoute={openRoute}
              onNewRoute={() => setNewOpen(true)}
              onPress={() => navigation.navigate("PedidoDetalle", { id: item._id })}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing || ordersRefreshing} onRefresh={reloadAll} />}
          ListEmptyComponent={
            <EmptyState
              icon="orders"
              message={orders.length ? "Ningún pedido coincide con el filtro." : "No hay pedidos empacados por despachar."}
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
