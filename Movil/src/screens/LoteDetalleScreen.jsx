import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBatches } from "../hooks/useBatches";
import { useOrders } from "../hooks/useOrders";
import { useInventory } from "../hooks/useInventory";
import { useWarehouses } from "../hooks/useWarehouses";
import { useEmployees } from "../hooks/useEmployees";
import { useProductionLines } from "../hooks/useProductionLines";
import {
  CompleteBatchSheet,
  SendToWarehouseSheet,
  StartBatchSheet,
  StopBatchSheet,
} from "../components/batches/BatchSheets";
import LineHistoryChart from "../components/batches/LineHistoryChart";
import BottomBar from "../components/ui/BottomBar";
import Card from "../components/ui/Card";
import ColorSwatch from "../components/ui/ColorSwatch";
import ErrorState from "../components/ui/ErrorState";
import IconButton from "../components/ui/IconButton";
import ListGroup, { ListRow } from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import StatTile from "../components/ui/StatTile";
import Stepper from "../components/ui/Stepper";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatClock, formatDateTime, formatNumber, formatShortDate } from "../lib/format";
import {
  batchEnd,
  batchHeaderState,
  batchStart,
  batchState,
  isStockBatch,
  lineStats,
  pendingUnits,
  productLabel,
} from "../lib/batchFlow";
import { batchApi } from "../lib/batchActions";
import { buildGroups, findOrderLot, lotState, STEP_LABELS } from "../lib/orderManufacturing";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

const STOCK_STEPS = ["Programado", "En proceso", "Completado", "En bodega"];
// Etapa del lote en su recorrido (0..3); la última se marca completada.
const STOCK_STAGE = { Programado: 0, "En proceso": 1, Detenido: 1, "Por enviar": 2, "En bodega": 3 };
const ORDER_STAGE = { Programado: 0, "En proceso": 1, Detenido: 1, Completado: 2, Empacado: 3 };

const MINUS = "−";
const signed = (n) => (n < 0 ? `${MINUS}${formatNumber(Math.abs(n))}` : `+${formatNumber(n)}`);
const pctOf = (value, total) => (total ? Math.round((value / total) * 100) : null);

function when(point) {
  if (!point) return "—";
  return point.withTime ? formatDateTime(point.date) : formatShortDate(point.date);
}

function journey(labels, stage) {
  return labels.map((label, i) => ({
    label,
    state: i < stage || (i === 3 && stage === 3) ? "done" : i === stage ? "current" : "pending",
  }));
}

// Detalle de un lote de fabricación (BatchDetail.jsx de la web, y las filas
// de lote de Fabricación > Pedidos para los lotes de pedido): recorrido,
// indicadores, gráfica de la línea, ficha y las acciones del estado actual
// con «Deshacer» donde la web lo permite.
export default function LoteDetalleScreen({ navigation, route }) {
  const bottomPad = useBottomPad(24);
  const id = route.params?.id;
  const toast = useToast();
  const { batches, loading, refreshing, error, refresh, eliminar } = useBatches();
  const { orders, refresh: refreshOrders } = useOrders();
  const { items: inventory, refresh: refreshInventory } = useInventory();
  const { warehouses: warehouseList } = useWarehouses();
  const { employees } = useEmployees();
  const { options: lines } = useProductionLines();

  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null); // "start" | "stop" | "complete" | "send"

  const batch = batches.find((b) => b._id === id) || null;
  const stock = batch ? isStockBatch(batch) : true;
  const orderLot = useMemo(
    () => (batch && !stock ? findOrderLot(buildGroups(orders, batches), batch._id) : null),
    [batch, stock, orders, batches],
  );

  // Solo empleados del Área Fabricación pueden ser operarios.
  const operators = useMemo(() => employees.filter((e) => e.department === "Fabricación"), [employees]);
  const warehouses = useMemo(() => warehouseList.map((w) => w.name), [warehouseList]);
  const finishedItems = useMemo(() => inventory.filter((i) => i.category === "Producto Terminado"), [inventory]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const state = batch ? (orderLot ? lotState(orderLot.lot) : batchState(batch)) : null;
  const headerState = batch ? (orderLot ? state : batchHeaderState(batch)) : null;

  const confirmDelete = useCallback(() => {
    if (!batch) return;
    Alert.alert("Eliminar lote", `¿Eliminar el lote ${batch.batchNumber}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(batch._id);
            toast.show("Lote eliminado");
            navigation.goBack();
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);
  }, [batch, eliminar, navigation, toast]);

  const openMenu = useCallback(() => {
    Alert.alert(batch?.batchNumber || "Lote", undefined, [
      { text: "Editar", onPress: () => navigation.navigate("LoteFabricacionForm", { id }) },
      { text: "Eliminar", style: "destructive", onPress: confirmDelete },
      { text: "Cancelar", style: "cancel" },
    ]);
  }, [batch, navigation, id, confirmDelete]);

  useLayoutEffect(() => {
    if (!batch) return;
    navigation.setOptions({
      title: batch.batchNumber,
      headerBackTitle: route.params?.backLabel,
      headerStatus: { label: headerState, tone: statusTone(headerState, "lote") },
      headerSubtitle: [batch.product, batch.color, batch.category ? String(batch.category).toLowerCase() : null]
        .filter(Boolean)
        .join(" · "),
      // Los lotes de pedido no se editan ni se borran a mano (como en la web).
      headerRight: stock
        ? () => <IconButton icon="more" onPress={openMenu} accessibilityLabel="Más acciones del lote" />
        : undefined,
    });
  }, [navigation, batch, headerState, stock, openMenu, route.params?.backLabel]);

  // Recarga lo que la acción pudo cambiar: el lote siempre; los pedidos si es
  // un lote de pedido; el inventario si movió existencia.
  const reload = ({ stockMoved = false } = {}) =>
    Promise.all([refresh(), orderLot ? refreshOrders() : null, stockMoved ? refreshInventory() : null]);

  // Acción directa: si hay `undo`, el Toast ofrece «Deshacer».
  async function act(run, message, undo, options) {
    setBusy(true);
    try {
      await run();
      await reload(options);
      setSheet(null);
      if (undo) {
        toast.undo(message, async () => {
          try {
            await undo();
            toast.show("Cambio deshecho");
          } catch (err) {
            Alert.alert("No se pudo deshacer", err.message);
          } finally {
            reload(options);
          }
        });
      } else {
        toast.show(message);
      }
    } catch (err) {
      Alert.alert("No se pudo completar", err.message);
      reload(options);
    } finally {
      setBusy(false);
    }
  }

  if (!batch) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Este lote ya no existe." />;
  }

  const b = batch;
  const actions = {
    start: (body) => act(() => batchApi.start(b._id, body), `Lote ${b.batchNumber} iniciado`),
    stop: (reason) =>
      act(
        () => batchApi.stop(b._id, reason),
        `Lote ${b.batchNumber} detenido`,
        () => batchApi.resume(b._id),
      ),
    resume: () =>
      act(
        () => batchApi.resume(b._id),
        `Lote ${b.batchNumber} reanudado`,
        () => batchApi.stop(b._id, b.stopReason),
      ),
    complete: (produced) =>
      act(
        () => batchApi.complete(b._id, produced),
        `Lote ${b.batchNumber} completado · ${formatNumber(produced)} unidades`,
        () => batchApi.reopen(b._id),
      ),
    send: (warehouse) =>
      act(
        () => batchApi.sendToWarehouse(b._id, warehouse),
        `${formatNumber(pendingUnits(b))} unidades de ${b.batchNumber} enviadas a ${warehouse}`,
        () => batchApi.undoSend(b._id),
        { stockMoved: true },
      ),
    pack: () =>
      act(
        () => batchApi.packManufactured(orderLot.group.order._id, orderLot.lot.index),
        `${[orderLot.lot.item.product, orderLot.lot.item.color].filter(Boolean).join(" · ")} empacado`,
        () => batchApi.unpackManufactured(orderLot.group.order._id, orderLot.lot.index),
      ),
  };

  const startOrAsk = () => {
    const hasOperator = b.operator || operators.length === 0;
    if (b.productionLine && hasOperator) actions.start({});
    else setSheet("start");
  };

  // Acciones del estado actual (las mismas que muestra la web).
  let barActions = [];
  switch (state) {
    case "Programado":
      barActions = [{ title: "Iniciar", icon: "factory", onPress: startOrAsk }];
      break;
    case "En proceso":
      barActions = [
        { title: "Detener", variant: "secondary", onPress: () => setSheet("stop") },
        { title: "Completar", icon: "check", onPress: () => setSheet("complete") },
      ];
      break;
    case "Detenido":
      barActions = [{ title: "Reanudar", onPress: actions.resume }];
      break;
    case "Por enviar":
      barActions = [{ title: "Enviar a bodega", icon: "warehouse", onPress: () => setSheet("send") }];
      break;
    case "Completado":
      // Lote de pedido completado: se empaca para que Logística lo recoja.
      if (orderLot) barActions = [{ title: "Empacar", icon: "box", onPress: actions.pack }];
      break;
    default:
      break;
  }
  barActions = barActions.map((a) => ({ ...a, disabled: busy }));

  const target = b.targetQuantity;
  const done = b.status === "Completado";
  const produced = b.producedQuantity || 0;
  const pct = done ? pctOf(produced, target) : null;
  const stats = stock ? lineStats(b, batches) : null;

  let vs = { value: "—", note: stats?.previous ? null : "sin lote anterior en la línea", color: undefined };
  if (stats && done && stats.previous?.producedQuantity) {
    const diff = produced - stats.previous.producedQuantity;
    const diffPct = Math.round((diff / stats.previous.producedQuantity) * 100);
    vs = {
      value: diffPct === 0 ? "0 %" : `${diffPct < 0 ? MINUS : "+"}${Math.abs(diffPct)} %`,
      note: `${signed(diff)} u. vs. ${stats.previous.batchNumber}`,
      color: diff < 0 ? tones.amber.text : diff > 0 ? tones.green.text : undefined,
    };
  }

  const steps = orderLot
    ? journey(STEP_LABELS, ORDER_STAGE[state] ?? 0)
    : journey(STOCK_STEPS, STOCK_STAGE[state] ?? 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, barActions.length > 0 ? null : bottomPad]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} />}
      >
        {state === "Detenido" ? (
          <View style={styles.stopped}>
            <Text style={styles.stoppedText}>
              {b.stoppedAt ? `Detenido desde las ${formatClock(b.stoppedAt)}` : "Detenido"}
              {b.stopReason ? ` · ${b.stopReason}` : ""}
            </Text>
          </View>
        ) : null}

        <Card>
          <Stepper steps={steps} />
        </Card>

        <View style={styles.tiles}>
          <StatTile style={styles.tile} size="small" label="Meta" value={target != null ? formatNumber(target) : "—"} />
          <StatTile
            style={styles.tile}
            size="small"
            label="Producido"
            value={done ? formatNumber(produced) : "—"}
            valueColor={done ? tones.green.text : undefined}
          />
          <StatTile style={styles.tile} size="small" label="Avance" value={pct != null ? `${pct}%` : "—"} />
        </View>

        {stats ? (
          <>
            <View style={styles.tiles}>
              <StatTile
                style={styles.tile}
                size="small"
                label="vs. lote anterior"
                value={vs.value}
                valueColor={vs.color}
                note={vs.note}
              />
              <StatTile
                style={styles.tile}
                size="small"
                label="Promedio de la línea"
                value={stats.average != null ? formatNumber(stats.average) : "—"}
                note={
                  b.productionLine
                    ? `últimos ${stats.history.length} ${stats.history.length === 1 ? "lote" : "lotes"}`
                    : "sin línea"
                }
              />
            </View>
            {b.productionLine ? (
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={type.cardTitle}>Últimos lotes de {b.productionLine}</Text>
                  {target != null ? <Text style={styles.cardAux}>Meta {formatNumber(target)} u</Text> : null}
                </View>
                <LineHistoryChart batch={b} history={stats.history} />
              </Card>
            ) : null}
          </>
        ) : null}

        <Text style={[type.cardTitle, styles.sectionTitle]}>Datos del lote</Text>
        <ListGroup>
          <ListRow
            title="Producto"
            value={productLabel(b) || "—"}
            left={b.color ? <ColorSwatch color={b.color} /> : null}
          />
          <ListRow title="Línea" value={b.productionLine || "—"} />
          <ListRow
            title="Operario"
            value={b.operator?.name ? `${b.operator.name} ${b.operator.lastName || ""}`.trim() : "—"}
          />
          <ListRow title="Inicio" value={when(batchStart(b))} />
          <ListRow title="Fin" value={when(batchEnd(b))} />
          <ListRow title="Categoría" value={b.category || "—"} />
          {b.stopReason ? <ListRow title="Motivo de detención" value={b.stopReason} /> : null}
          {state === "En bodega" ? (
            <ListRow
              title="Destino"
              value={`${b.destinationWarehouse || "Bodega"} · ${formatShortDate(b.sentToWarehouseAt)}`}
            />
          ) : null}
          {orderLot ? (
            <ListRow
              title="Pedido"
              value={orderLot.group.order.orderNumber}
              onPress={() => navigation.navigate("PedidoDetalle", { id: orderLot.group.order._id })}
            />
          ) : null}
        </ListGroup>
      </ScrollView>

      {barActions.length ? <BottomBar actions={barActions} /> : null}

      <StartBatchSheet
        batch={sheet === "start" ? b : null}
        lines={lines}
        operators={operators}
        busy={busy}
        onClose={() => setSheet(null)}
        onConfirm={actions.start}
      />
      <StopBatchSheet batch={sheet === "stop" ? b : null} busy={busy} onClose={() => setSheet(null)} onConfirm={actions.stop} />
      <CompleteBatchSheet
        batch={sheet === "complete" ? b : null}
        busy={busy}
        onClose={() => setSheet(null)}
        onConfirm={actions.complete}
      />
      <SendToWarehouseSheet
        batch={sheet === "send" ? b : null}
        warehouses={warehouses}
        finishedItems={finishedItems}
        busy={busy}
        onClose={() => setSheet(null)}
        onConfirm={actions.send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  stopped: { backgroundColor: tones.rose.bg, borderRadius: 12, padding: 12, marginBottom: 10 },
  stoppedText: { fontFamily: fonts.semibold, fontSize: 13, color: tones.rose.text },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  cardAux: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  sectionTitle: { marginTop: 8, marginBottom: 8 },
});
