import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../hooks/useOrders";
import { useInventory } from "../hooks/useInventory";
import BottomBar from "../components/ui/BottomBar";
import BottomSheet from "../components/ui/BottomSheet";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import ErrorState from "../components/ui/ErrorState";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import LevelMeter from "../components/ui/LevelMeter";
import ListGroup, { ListRow } from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import Pill from "../components/ui/Pill";
import Stepper from "../components/ui/Stepper";
import { useToast } from "../components/ui/Toast";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatDateYear, formatMoney, formatNumber, formatShortDate } from "../lib/format";
import { lastStatusEntry, orderJourneySteps } from "../lib/orderJourney";
import { normalizeStatus, statusTone } from "../lib/statusTones";
import {
  buildStockMap,
  finishedItemsOf,
  fullyVerifiableLines,
  lineParts,
  orderLineApi,
  packableLines,
  progressLabel,
  routeLabel,
  runAll,
  stockOptionsFor,
  suggestWarehouse,
} from "../lib/inventoryOrders";

// Texto de existencia de una parte de la línea (existenceText de
// PedidosInventario.jsx en la web).
function existenceText(item, part) {
  if (part.status === "Por verificar") {
    return `${part.suggestion.warehouse} · ${formatNumber(part.suggestion.available)} disp.`;
  }
  if (part.status === "Existencia parcial") {
    return `${part.suggestion.warehouse} · solo ${formatNumber(part.suggestion.available)}`;
  }
  if (part.status === "Sin existencia") return "Sin existencia";
  if (part.part === "manufacture") return "A fabricar";
  if (item.verifiedWarehouse && (part.status === "Verificado" || part.status === "Empacado")) {
    return `${item.verifiedWarehouse} · tomado`;
  }
  if (item.packedLocation === "Fabricación") return "Fabricación";
  return null;
}

// Avance del lote de una línea «En fabricación»: «Lote N · estado» y lo
// producido respecto a su meta.
function LotProgress({ batch }) {
  if (!batch?.batchNumber) return <Text style={styles.lotText}>Lote —</Text>;
  const target = Number(batch.targetQuantity) || 0;
  const produced = Number(batch.producedQuantity) || 0;
  return (
    <View style={styles.lot}>
      <Text style={styles.lotText}>
        Lote {batch.batchNumber}
        {batch.status ? ` · ${normalizeStatus(batch.status)}` : ""}
      </Text>
      <LevelMeter value={produced} max={target} tone="blue" style={styles.lotMeter} />
      <Text style={styles.lotCaption}>
        {formatNumber(produced)} de {formatNumber(target)} producidas
      </Text>
    </View>
  );
}

function ProductLine({ order, item, index, stockMap, busy, actions }) {
  const parts = lineParts(item, stockMap);

  return (
    <View style={styles.line}>
      {parts.map((part, pi) => {
        const existence = existenceText(item, part);
        return (
          <View key={part.part} style={pi > 0 && styles.subPart}>
            <View style={styles.lineTop}>
              <Text style={styles.lineName} numberOfLines={2}>
                {pi === 0 ? [item.product, item.color].filter(Boolean).join(" · ") : "↳ a fabricar"}
              </Text>
              <Text style={styles.lineQty}>{formatNumber(part.qty)} u</Text>
            </View>
            <View style={styles.lineBottom}>
              <View style={styles.existence}>
                {existence ? (
                  <>
                    <Icon name="warehouse" size={14} color={colors.faint} />
                    <Text style={styles.existenceText} numberOfLines={1}>
                      {existence}
                    </Text>
                  </>
                ) : null}
              </View>
              <Pill label={part.status} tone={statusTone(part.status, "linea-inventario")} />
            </View>

            {part.status === "Por verificar" ? (
              <Button
                title="Verificar"
                size="small"
                variant="soft"
                icon="check"
                disabled={busy}
                onPress={() => actions.openVerify(index)}
                style={styles.lineAction}
              />
            ) : part.status === "Verificado" ? (
              <Button
                title="Empacar"
                size="small"
                variant="success"
                icon="box"
                disabled={busy}
                onPress={() => actions.pack(order, index)}
                style={styles.lineAction}
              />
            ) : part.status === "Empacado" ? (
              <Text style={styles.lineNote}>{routeLabel(order) || "Esperando motorista"}</Text>
            ) : part.status === "Sin existencia" ? (
              <Button
                title="Enviar a fabricación"
                size="small"
                icon="factory"
                disabled={busy}
                onPress={() => actions.sendToManufacturing(order, index)}
                style={styles.lineAction}
              />
            ) : part.status === "En fabricación" ? (
              <LotProgress batch={item.manufacturingBatch} />
            ) : null}

            {part.status === "Existencia parcial" ? (
              <ShortageBox order={order} item={item} index={index} stockMap={stockMap} busy={busy} actions={actions} />
            ) : null}
          </View>
        );
      })}
      <Text style={styles.linePrice}>
        {formatMoney(item.unitPrice)} c/u · {formatMoney(item.subtotal ?? item.quantity * item.unitPrice)}
      </Text>
    </View>
  );
}

// Aviso ámbar de una línea con existencia parcial: tomar lo que hay y
// mandar a fabricar el resto, o fabricar todo (el mismo cuadro que abre
// «Resolver faltante» en la web).
function ShortageBox({ order, item, index, stockMap, busy, actions }) {
  const s = suggestWarehouse(item, stockMap);
  const rest = item.quantity - s.available;
  return (
    <View style={styles.shortage}>
      <Text style={styles.shortageText}>
        Solo hay {formatNumber(s.available)} en {s.warehouse} y ninguna otra tiene más.
      </Text>
      <Button
        title={`Tomar ${formatNumber(s.available)} y fabricar ${formatNumber(rest)}`}
        size="small"
        disabled={busy}
        onPress={() => actions.split(order, index, s.warehouse, s.available)}
        style={styles.shortageButton}
      />
      <Button
        title={`Fabricar las ${formatNumber(item.quantity)}`}
        size="small"
        variant="secondary"
        disabled={busy}
        onPress={() => actions.sendToManufacturing(order, index)}
        style={styles.shortageButton}
      />
    </View>
  );
}

// Hoja para elegir la bodega al verificar una línea (RadioCardList de la web):
// las bodegas que no alcanzan quedan deshabilitadas.
function VerifySheet({ index, item: current, stockMap, busy, onClose, onVerify }) {
  // Mientras la hoja se cierra (current ya es null) sigue mostrando la
  // última línea, para que el contenido no desaparezca durante la animación.
  const lastItem = useRef(current);
  if (current) lastItem.current = current;
  const item = current || lastItem.current;
  const options = item ? stockOptionsFor(item, stockMap) : [];
  const [chosen, setChosen] = useState(null);
  // Al abrir la hoja para otra línea se vuelve a la bodega sugerida.
  useEffect(() => setChosen(null), [index]);
  const selected = chosen ?? (item ? suggestWarehouse(item, stockMap).warehouse : null);

  return (
    <BottomSheet
      visible={Boolean(current)}
      onClose={onClose}
      title={item ? `Verificar ${[item.product, item.color].filter(Boolean).join(" · ")}` : ""}
      subtitle={item ? `${formatNumber(item.quantity)} u · elige la bodega de donde se toma` : ""}
      footer={
        <Button
          title={`Verificar en ${selected || "—"}`}
          disabled={busy || !selected}
          loading={busy}
          onPress={() => onVerify(selected)}
        />
      }
    >
      {options.map((o) => {
        const disabled = o.stock < (item?.quantity || 0);
        const active = o.warehouse === selected;
        return (
          <Pressable
            key={o.warehouse}
            disabled={disabled}
            onPress={() => setChosen(o.warehouse)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
          >
            <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.optionTexts}>
              <Text style={styles.optionTitle}>
                {o.warehouse} · {formatNumber(o.stock)} disponibles
              </Text>
              {disabled ? <Text style={styles.optionDetail}>No alcanza para {formatNumber(item.quantity)}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

// Detalle de un pedido. Junta lo que en la web está en la ficha de Pedidos
// (recorrido, cliente, entrega, productos, editar y eliminar) con la
// preparación de Inventario > Pedidos (verificar, empacar, resolver
// faltantes, enviar a fabricación), con los mismos endpoints y el mismo
// «Deshacer». Fabricar, empacar lo fabricado y asignar la entrega siguen en
// Fabricación y Logística, igual que en la web.
export default function PedidoDetalleScreen({ navigation, route }) {
  const id = route.params?.id;
  const toast = useToast();
  const { orders, loading, refreshing, error, refresh, eliminar } = useOrders();
  const { items: inventory, refresh: refreshInventory } = useInventory();
  const [busy, setBusy] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState(null);

  const order = orders.find((o) => o._id === id);
  const stockMap = useMemo(() => buildStockMap(finishedItemsOf(inventory)), [inventory]);

  // Al volver de editar el pedido, se vuelve a leer.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const confirmDelete = useCallback(() => {
    if (!order) return;
    Alert.alert(
      "Eliminar pedido",
      `¿Eliminar el pedido ${order.orderNumber}? El stock ya tomado de bodega vuelve a su lugar y se borran sus lotes que sigan Programados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await eliminar(order._id);
              toast.show("Pedido eliminado");
              navigation.goBack();
            } catch (err) {
              // El backend explica qué resolver primero (desempacar o
              // resolver el lote en Fabricación).
              Alert.alert("No se pudo eliminar", err.message);
            }
          },
        },
      ],
    );
  }, [order, eliminar, navigation, toast]);

  const openMenu = useCallback(() => {
    Alert.alert(order?.orderNumber || "Pedido", undefined, [
      { text: "Editar pedido", onPress: () => navigation.navigate("PedidoForm", { id }) },
      { text: "Eliminar pedido", style: "destructive", onPress: confirmDelete },
      { text: "Cancelar", style: "cancel" },
    ]);
  }, [order, navigation, id, confirmDelete]);

  useLayoutEffect(() => {
    if (!order) return;
    navigation.setOptions({
      title: order.orderNumber,
      headerStatus: { label: order.status, tone: statusTone(order.status, "pedido") },
      headerSubtitle: [order.customer?.name, formatMoney(order.total), order.paymentStatus].filter(Boolean).join(" · "),
      headerRight: () => <IconButton icon="more" onPress={openMenu} accessibilityLabel="Más acciones del pedido" />,
    });
  }, [navigation, order, openMenu]);

  // Recarga después de una acción; `stock`: la acción movió existencia.
  const reload = (stock) => Promise.all([refresh(), stock ? refreshInventory() : null]);

  // Acción directa con «Deshacer», como act() de PedidosInventario.jsx.
  async function act(run, message, undo, { stock = false } = {}) {
    setBusy(true);
    try {
      await run();
      await reload(stock);
      setVerifyIndex(null);
      toast.undo(message, async () => {
        try {
          await undo();
          toast.show("Cambio deshecho");
        } catch (err) {
          Alert.alert("No se pudo deshacer", err.message);
        } finally {
          reload(stock);
        }
      });
    } catch (err) {
      Alert.alert("No se pudo completar", err.message);
      // El pedido pudo cambiar en otra pantalla: se vuelve a leer.
      reload(stock);
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    openVerify: (index) => setVerifyIndex(index),
    verify: (o, index, warehouse) =>
      act(
        () => orderLineApi.verify(o._id, index, warehouse),
        `${o.items[index].product} verificado en ${warehouse}`,
        () => orderLineApi.unverify(o._id, index),
        { stock: true },
      ),
    verifyAll: (o, lines) =>
      act(
        () => orderLineApi.verifyBulk([{ id: o._id, items: lines.map((l) => ({ index: l.index, warehouse: l.warehouse })) }]),
        `${lines.length} ${lines.length === 1 ? "producto verificado" : "productos verificados"}`,
        () => runAll(lines.map((l) => () => orderLineApi.unverify(o._id, l.index))),
        { stock: true },
      ),
    pack: (o, index) =>
      act(
        () => orderLineApi.pack(o._id, index),
        `${o.items[index].product} empacado`,
        () => orderLineApi.unpack(o._id, index),
      ),
    packVerified: (o, lines) =>
      act(
        () => runAll(lines.map((l) => () => orderLineApi.pack(o._id, l.index))),
        `${lines.length} ${lines.length === 1 ? "producto empacado" : "productos empacados"}`,
        () => runAll(lines.map((l) => () => orderLineApi.unpack(o._id, l.index))),
      ),
    sendToManufacturing: (o, index) =>
      act(
        () => orderLineApi.sendToManufacturing(o._id, index),
        `${o.items[index].product} enviado a fabricación`,
        () => orderLineApi.cancelManufacturing(o._id, index),
      ),
    split: (o, index, warehouse, quantity) =>
      act(
        () => orderLineApi.split(o._id, index, warehouse, quantity),
        `Tomados ${formatNumber(quantity)} de ${warehouse}; ${formatNumber(o.items[index].quantity - quantity)} a fabricación`,
        () => orderLineApi.unsplit(o._id, index),
        { stock: true },
      ),
  };

  if (!order) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Este pedido ya no existe." />;
  }

  const items = order.items || [];
  const verifiable = fullyVerifiableLines(order, stockMap);
  const packable = packableLines(order);
  const last = lastStatusEntry(order);
  const address = order.delivery?.address || order.customer?.address;
  const routeInfo = order.delivery?.route?.number
    ? `${order.delivery.route.zone} · Ruta ${order.delivery.route.number}`
    : "sin asignar";

  // Acciones del pedido completo (en la web: «Verificar todo» y «Empacar
  // verificados»). Si hay las dos, verificar es la principal.
  const barActions = [
    packable.length > 0 && {
      title: `Empacar · ${packable.length}`,
      icon: "box",
      variant: verifiable.length > 0 ? "secondary" : "primary",
      disabled: busy,
      onPress: () => actions.packVerified(order, packable),
    },
    verifiable.length > 0 && {
      title: `Verificar todo · ${verifiable.length}`,
      icon: "check",
      disabled: busy,
      onPress: () => actions.verifyAll(order, verifiable),
    },
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
              refreshInventory();
            }}
          />
        }
      >
        <Card>
          <Text style={[type.overline, styles.cardLabel]}>Recorrido del pedido</Text>
          <Stepper steps={orderJourneySteps(order)} />
        </Card>

        <Card>
          <View style={styles.cardHeader}>
            <Text style={type.cardTitle}>Productos</Text>
            <Text style={styles.cardAux}>{progressLabel(order)}</Text>
          </View>
          {verifiable.length > 0 ? (
            <View style={styles.verifyHint}>
              <Text style={styles.verifyHintTitle}>
                {verifiable.length} {verifiable.length === 1 ? "producto tiene" : "productos tienen"} existencia completa
                en una bodega
              </Text>
              <Text style={styles.verifyHintDetail}>
                {verifiable.map((l) => `${l.item.product} → ${l.warehouse}`).join(" · ")}
              </Text>
            </View>
          ) : null}
          {items.length === 0 ? <Text style={styles.placeholder}>Este pedido no tiene productos.</Text> : null}
          {items.map((item, index) => (
            <View key={index} style={index > 0 && styles.lineDivider}>
              <ProductLine order={order} item={item} index={index} stockMap={stockMap} busy={busy} actions={actions} />
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total del pedido</Text>
            <Text style={styles.totalValue}>{formatMoney(order.total)}</Text>
          </View>
        </Card>

        <ListGroup>
          <ListRow
            title="Cliente"
            subtitleLines={3}
            subtitle={[order.customer?.name, order.customer?.email, order.customer?.phone].filter(Boolean).join("\n") || "—"}
          />
          <ListRow title="Entrega" subtitle={`${address || "—"}\n${routeInfo}`} />
          <ListRow title="Pago" right={<Pill label={order.paymentStatus} tone={statusTone(order.paymentStatus, "pago")} />} />
          <ListRow title="Solicitado" value={formatDateYear(order.createdAt)} />
          <ListRow
            title="Última acción"
            value={last ? `${formatShortDate(last.at)} · ${String(last.status).toLowerCase()}` : "—"}
          />
          {order.sentToInventoryAt ? (
            <ListRow title="Inventario" value={`Pasó solo el ${formatShortDate(order.sentToInventoryAt)}`} />
          ) : null}
        </ListGroup>
      </ScrollView>

      {barActions.length > 0 ? <BottomBar actions={barActions} /> : null}

      <VerifySheet
        index={verifyIndex}
        item={verifyIndex !== null ? items[verifyIndex] : null}
        stockMap={stockMap}
        busy={busy}
        onClose={() => setVerifyIndex(null)}
        onVerify={(warehouse) => actions.verify(order, verifyIndex, warehouse)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  cardLabel: { marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  cardAux: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: "right" },
  placeholder: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 8 },
  verifyHint: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12, marginVertical: 6, gap: 2 },
  verifyHintTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primarySoftText },
  verifyHintDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink2 },
  line: { paddingVertical: 12 },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  subPart: { marginTop: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.lineSoft },
  lineTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  lineName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  lineQty: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  lineBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 },
  existence: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  existenceText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  lineAction: { alignSelf: "flex-start", marginTop: 10 },
  lineNote: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  linePrice: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.faint, fontVariant: ["tabular-nums"] },
  lot: { marginTop: 10, gap: 5 },
  lotText: { fontFamily: fonts.semibold, fontSize: 12, color: tones.blue.text, fontVariant: ["tabular-nums"] },
  lotMeter: { maxWidth: 180 },
  lotCaption: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, fontVariant: ["tabular-nums"] },
  shortage: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.amberLine,
    backgroundColor: tones.amber.bg,
    gap: 8,
  },
  shortageText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.amberStrong },
  shortageButton: { alignSelf: "stretch" },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  totalValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ["tabular-nums"] },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.selectBar, backgroundColor: colors.selectBg },
  optionDisabled: { opacity: 0.5 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.busyLine,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionTexts: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  optionDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
