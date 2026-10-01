import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import { useRoutes } from "../hooks/useRoutes";
import { CrewSheet } from "../components/logistics/RouteSheets";
import BottomBar from "../components/ui/BottomBar";
import Button from "../components/ui/Button";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import StatTile from "../components/ui/StatTile";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatClock, formatElapsed, formatMoney, formatNumber } from "../lib/format";
import {
  departBlocker,
  dispatchInfo,
  incompleteText,
  isConfirmed,
  personName,
  pickupAt,
  pickupDetail,
  progressNote,
  requiredPickups,
  routeProgress,
} from "../lib/logistics";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

const LOCATION_ICON = { "Almacén": "warehouse", "Fabricación": "factory" };
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Círculo de la parada: verde con check (entregada), primary (la actual) o
// gris (pendiente).
function StopNumber({ n, state }) {
  if (state === "done") {
    return (
      <View style={[styles.circle, { backgroundColor: tones.green.dot }]}>
        <Icon name="check" size={14} color={colors.white} />
      </View>
    );
  }
  const current = state === "current";
  return (
    <View style={[styles.circle, { backgroundColor: current ? colors.primary : tones.gray.bg }]}>
      <Text style={[styles.circleText, { color: current ? colors.white : tones.gray.text }]}>{n}</Text>
    </View>
  );
}

// Seguimiento de una ruta de hoy. Junta lo que la web muestra en dos lados:
//   - En tránsito (RouteDetail): indicadores y paradas con «Entregado»
//     (deliver) y «Deshacer» (undeliver).
//   - Para despacho (RoutePanel), mientras la ruta no sale: recogidas
//     (pickup), avisos de pedidos incompletos, motorista/vehículo y «Salir a
//     ruta» (depart), deshabilitado mientras falte algo.
export default function RutaDetalleScreen({ navigation, route: navRoute }) {
  const bottomPad = useBottomPad(24);
  const id = navRoute.params?.id;
  const toast = useToast();
  const {
    routes,
    availability,
    loading,
    refreshing,
    error,
    refresh,
    actualizar,
    eliminar,
    addOrder,
    removeOrder,
    confirmPickup,
    depart,
    deliver,
    undeliver,
  } = useRoutes();
  const { orders: allOrders, refresh: refreshOrders } = useOrders();

  const [busy, setBusy] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  // Pedidos incompletos que se llevan como están («Llevar lo que hay»).
  const [takeAsIs, setTakeAsIs] = useState(() => new Set());

  const route = routes.find((r) => r._id === id) || null;
  const departed = Boolean(route?.departedAt);
  const empty = route ? !route.orders?.length && !route.deliveries?.length : false;

  // Los pedidos de /orders traen el lote poblado (para saber qué les falta).
  const ordersById = useMemo(() => new Map(allOrders.map((o) => [String(o._id), o])), [allOrders]);
  const routeOrders = useMemo(
    () => (route?.orders || []).map((o) => ordersById.get(String(o._id)) || o),
    [route, ordersById],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshOrders();
    }, [refresh, refreshOrders]),
  );

  const reloadAll = () => Promise.all([refresh(), refreshOrders()]);

  const confirmDelete = useCallback(() => {
    if (!route) return;
    Alert.alert("Eliminar ruta", `¿Eliminar la Ruta ${route.number} · ${route.zone}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(route._id);
            toast.show(`Ruta ${route.number} eliminada`);
            navigation.goBack();
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);
  }, [route, eliminar, navigation, toast]);

  useLayoutEffect(() => {
    if (!route) return;
    navigation.setOptions({
      title: `Ruta ${route.number} · ${route.zone}`,
      headerBackTitle: "Rutas",
      headerStatus: { label: route.status, tone: statusTone(route.status, "ruta") },
      headerSubtitle: [personName(route.driver) || "Sin motorista", route.driver?.phone, route.vehicle]
        .filter(Boolean)
        .join(" · "),
      // Como la web: solo se elimina una ruta vacía que no ha salido.
      headerRight:
        empty && !departed
          ? () => (
              <IconButton
                icon="more"
                accessibilityLabel="Más acciones de la ruta"
                onPress={() =>
                  Alert.alert(`Ruta ${route.number}`, undefined, [
                    { text: "Eliminar ruta", style: "destructive", onPress: confirmDelete },
                    { text: "Cancelar", style: "cancel" },
                  ])
                }
              />
            )
          : undefined,
    });
  }, [navigation, route, empty, departed, confirmDelete]);

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
      reloadAll();
    } finally {
      setBusy(false);
    }
  }

  if (!route) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Esta ruta no es de hoy o ya no existe." />;
  }

  const r = route;
  const { stops, delivered, total, current, deliveredValue, totalValue } = routeProgress(r);
  const pickups = requiredPickups(routeOrders);
  const blocker = departBlocker(r, routeOrders);
  const incomplete = departed ? [] : routeOrders.filter((o) => !dispatchInfo(o).ready && !takeAsIs.has(String(o._id)));
  const hasCrew = Boolean(r.driver && r.vehicle);

  const changeCrew = (field, value) => {
    const previous = field === "driver" ? String(r.driver?._id || r.driver || "") : r.vehicle;
    const label = field === "driver" ? "Motorista" : "Vehículo";
    act(
      () => actualizar(r._id, { [field]: value }),
      `${label} de la Ruta ${r.number} actualizado`,
      () => actualizar(r._id, { [field]: previous || null }),
    );
  };

  const setTaken = (orderId, on) =>
    setTakeAsIs((prev) => {
      const next = new Set(prev);
      if (on) next.add(orderId);
      else next.delete(orderId);
      return next;
    });

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, !departed ? null : bottomPad]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} />}
      >
        <View style={styles.tiles}>
          <StatTile
            style={styles.tile}
            size="small"
            label="Paradas"
            value={`${formatNumber(delivered)} / ${formatNumber(total)}`}
            note={progressNote(delivered, total)}
          />
          <StatTile
            style={styles.tile}
            size="small"
            label="Entregado"
            value={formatMoney(deliveredValue, 0)}
            valueColor={tones.green.text}
            note={`de ${formatMoney(totalValue, 0)}`}
          />
          <StatTile
            style={styles.tile}
            size="small"
            label="Salida"
            value={departed ? formatClock(r.departedAt) : "—"}
            note={departed ? formatElapsed(r.departedAt) : "todavía no sale"}
          />
        </View>

        {!departed ? (
          <>
            <Text style={[type.overline, styles.sectionTitle]}>Recoger</Text>
            {pickups.length === 0 ? (
              <Text style={styles.aux}>
                {routeOrders.length ? "Nada que recoger." : "Agrega pedidos desde Para despacho."}
              </Text>
            ) : (
              <ListGroup>
                {pickups.map((location) => {
                  const done = isConfirmed(r, location);
                  return (
                    <View key={location} style={styles.row}>
                      <View style={[styles.pickupDot, done && styles.pickupDone]}>
                        <Icon
                          name={done ? "check" : LOCATION_ICON[location]}
                          size={14}
                          color={done ? colors.white : colors.muted}
                        />
                      </View>
                      <View style={styles.texts}>
                        <Text style={styles.rowTitle}>{location}</Text>
                        <Text style={styles.rowSub} numberOfLines={2}>
                          {pickupDetail(routeOrders, location)}
                        </Text>
                      </View>
                      {done ? (
                        <Text style={styles.picked}>Recogido {formatClock(pickupAt(r, location))}</Text>
                      ) : (
                        <Button
                          title="Confirmar recogido"
                          variant="secondary"
                          size="small"
                          disabled={busy || r.status !== "Recolectando"}
                          onPress={() =>
                            act(() => confirmPickup(r._id, location), `Recogida en ${location} confirmada`)
                          }
                        />
                      )}
                    </View>
                  );
                })}
              </ListGroup>
            )}

            {incomplete.map((o) => (
              <View key={o._id} style={styles.warning}>
                <Text style={styles.warningText}>{incompleteText(o)}</Text>
                <View style={styles.warningActions}>
                  <Button
                    title="Quitar de la ruta"
                    variant="secondary"
                    size="small"
                    disabled={busy}
                    onPress={() =>
                      act(
                        () => removeOrder(r._id, o._id),
                        `${o.orderNumber} quitado de la Ruta ${r.number}`,
                        () => addOrder(r._id, o._id),
                      )
                    }
                  />
                  <Button
                    title="Llevar lo que hay"
                    variant="secondary"
                    size="small"
                    onPress={() => {
                      const orderId = String(o._id);
                      setTaken(orderId, true);
                      toast.undo(`${o.orderNumber} sale con lo que hay`, () => setTaken(orderId, false));
                    }}
                  />
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={[type.overline, styles.sectionTitle]}>Paradas de la ruta</Text>
        {stops.length === 0 ? (
          <Text style={styles.aux}>Esta ruta todavía no tiene pedidos.</Text>
        ) : (
          <ListGroup>
            {stops.map((stop, i) => {
              const state = stop.delivered ? "done" : i === current ? "current" : "pending";
              const order = ordersById.get(String(stop.order._id)) || stop.order;
              const address = order.delivery?.address || order.customer?.address;
              let right = null;
              if (state === "current") {
                right = (
                  <Button
                    title="Entregado"
                    variant="success"
                    size="small"
                    disabled={busy}
                    onPress={() =>
                      act(
                        () => deliver(r._id, order._id),
                        `${order.customer?.name || order.orderNumber} entregado`,
                        () => undeliver(r._id, order._id),
                      )
                    }
                  />
                );
              } else if (state === "done") {
                right = <Text style={styles.time}>{stop.deliveredAt ? formatClock(stop.deliveredAt) : "—"}</Text>;
              } else if (!departed) {
                const ready = dispatchInfo(order).ready;
                right = (
                  <Pill label={ready ? "Listo" : "Incompleto"} tone={statusTone(ready ? "Listo" : "Incompleto", "parada")} />
                );
              } else {
                right = <Text style={styles.dash}>—</Text>;
              }
              return (
                <View key={`${order._id}-${i}`} style={[styles.row, state === "current" && styles.rowCurrent]}>
                  <StopNumber n={i + 1} state={state} />
                  <View style={styles.texts}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {order.customer?.name || "—"}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[order.orderNumber, address, stop.partial ? "entrega parcial" : null].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {right}
                </View>
              );
            })}
          </ListGroup>
        )}

        {!departed ? (
          <Button
            title={hasCrew ? "Reasignar motorista o vehículo" : "Asignar motorista y vehículo"}
            icon="users"
            variant="secondary"
            disabled={busy}
            onPress={() => setCrewOpen(true)}
            style={styles.crewButton}
          />
        ) : null}
      </ScrollView>

      {!departed ? (
        <BottomBar
          note={blocker ? capitalize(blocker) : undefined}
          actions={[
            {
              title: "Salir a ruta",
              icon: "truck",
              disabled: busy || Boolean(blocker),
              onPress: () => act(() => depart(r._id), `Ruta ${r.number} salió`),
            },
          ]}
        />
      ) : null}

      <CrewSheet
        route={crewOpen ? r : null}
        availability={availability}
        busy={busy}
        onClose={() => setCrewOpen(false)}
        onChange={changeCrew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  sectionTitle: { marginTop: 10, marginBottom: 8 },
  aux: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 10 },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  rowCurrent: { backgroundColor: colors.selectBg },
  texts: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  circle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  circleText: { fontFamily: fonts.bold, fontSize: 12, fontVariant: ["tabular-nums"] },
  pickupDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupDone: { backgroundColor: tones.green.dot, borderColor: tones.green.dot },
  picked: { fontFamily: fonts.semibold, fontSize: 12.5, color: tones.green.text, fontVariant: ["tabular-nums"] },
  time: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
  dash: { fontFamily: fonts.semibold, fontSize: 14, color: colors.faint },
  warning: {
    backgroundColor: tones.amber.bg,
    borderWidth: 1,
    borderColor: colors.amberLine,
    borderRadius: 12,
    padding: 13,
    gap: 10,
    marginBottom: 10,
  },
  warningText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.amberStrong },
  warningActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  crewButton: { marginTop: 6 },
});
