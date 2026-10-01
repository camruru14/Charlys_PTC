import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors, getTone, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatAge, formatNumber } from "../../lib/format";
import { statusTone } from "../../lib/statusTones";
import {
  COUNT_STATUS,
  inventoryMacroStatus,
  lastStatusAt,
  lineCounts,
  lineParts,
  progressLabel,
} from "../../lib/inventoryOrders";

// Barra de avance: un segmento por producto, agrupados por estado y con el
// color de su estado (OrderProgress de PedidosInventario.jsx en la web).
function ProgressSegments({ order, stockMap }) {
  const counts = lineCounts(order, stockMap);
  const segments = COUNT_STATUS.flatMap(([key, status]) =>
    Array.from({ length: counts[key] }, (_, i) => ({ key: `${key}-${i}`, status })),
  );
  if (!segments.length) return <View style={styles.bar} />;
  return (
    <View style={styles.bar}>
      {segments.map((s) => (
        <View
          key={s.key}
          style={[styles.segment, { backgroundColor: getTone(statusTone(s.status, "linea-inventario")).dot }]}
        />
      ))}
    </View>
  );
}

// Primer faltante del pedido («Pelota Amarillo: hay 80 de 300») y cuántos
// más hay: el mismo dato que la web muestra en la fila de cada producto.
function shortageNote(order, stockMap) {
  const shortages = (order.items || []).flatMap((item) =>
    lineParts(item, stockMap)
      .filter((p) => p.status === "Existencia parcial" || p.status === "Sin existencia")
      .map((p) => ({ item, available: p.suggestion?.available || 0 })),
  );
  if (!shortages.length) return null;
  const { item, available } = shortages[0];
  const name = [item.product, item.color].filter(Boolean).join(" ");
  const more = shortages.length > 1 ? ` · y ${shortages.length - 1} más` : "";
  return `${name}: hay ${formatNumber(available)} de ${formatNumber(item.quantity)}${more}`;
}

// Tarjeta de un pedido en Inventario > Pedidos. En modo selección muestra
// una casilla y el toque la marca en vez de abrir el pedido.
export default function PrepOrderCard({ order, stockMap, onPress, selecting = false, checked = false }) {
  const macro = inventoryMacroStatus(order);
  const note = shortageNote(order, stockMap);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityState={selecting ? { checked } : undefined}
      style={({ pressed }) => [styles.card, checked && styles.cardChecked, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        {selecting ? (
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked ? <Icon name="check" size={13} color={colors.white} strokeWidth={2.6} /> : null}
          </View>
        ) : null}
        <Text style={styles.number}>{order.orderNumber}</Text>
        <Pill label={macro} tone={statusTone(macro, "pedido-inventario")} />
      </View>
      <View style={[styles.row, styles.second]}>
        <Text style={styles.customer} numberOfLines={1}>
          {order.customer?.name || "—"}
        </Text>
        <Text style={styles.age}>{formatAge(lastStatusAt(order) || order.createdAt)}</Text>
      </View>
      <View style={[styles.row, styles.progressRow]}>
        <ProgressSegments order={order} stockMap={stockMap} />
        <Text style={styles.progress} numberOfLines={1}>
          {progressLabel(order)}
        </Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  cardChecked: {
    borderColor: colors.selectBar,
    backgroundColor: colors.selectBg,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  second: {
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.busyLine,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  number: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  customer: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink2,
  },
  age: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  progressRow: {
    marginTop: 12,
  },
  bar: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.lineSoft,
  },
  segment: {
    flex: 1,
  },
  progress: {
    maxWidth: "60%",
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink2,
    fontVariant: ["tabular-nums"],
  },
  note: {
    marginTop: 10,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: tones.amber.text,
  },
});
