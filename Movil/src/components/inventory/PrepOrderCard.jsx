import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import { colors, getTone, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatNumber } from "../../lib/format";
import { statusTone } from "../../lib/statusTones";
import {
  COUNT_STATUS,
  arrivalLabel,
  dispatchNote,
  inventoryMacroStatus,
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
// una casilla y el toque la marca en vez de abrir el pedido. `group` es el
// grupo de la lista (ORDER_GROUPS): mientras el pedido sigue en bodega
// muestra cuándo llegó (ámbar si pasa de 2 días) y su avance; ya despachado,
// la ruta y la hora.
export default function PrepOrderCard({ order, stockMap, group, onPress, selecting = false, checked = false }) {
  const macro = inventoryMacroStatus(order);
  const inWarehouse = group ? group.sort === "arrival" : true;
  const arrival = inWarehouse ? arrivalLabel(order) : null;
  const note = inWarehouse ? shortageNote(order, stockMap) : null;

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
        <View style={styles.numberBox}>
          <Text style={styles.number}>{order.orderNumber}</Text>
          {arrival ? (
            <View style={styles.arrival}>
              <Icon name="clock" size={12} color={arrival.late ? tones.amber.text : colors.muted} />
              <Text style={[styles.age, arrival.late && styles.ageLate]} numberOfLines={1}>
                {arrival.text}
              </Text>
            </View>
          ) : null}
        </View>
        <Pill label={macro} tone={statusTone(macro, "pedido-inventario")} />
      </View>
      <View style={[styles.row, styles.second]}>
        <Text style={styles.customer} numberOfLines={1}>
          {order.customer?.name || "—"}
        </Text>
        {inWarehouse ? null : (
          <Text style={styles.age} numberOfLines={1}>
            {dispatchNote(order)}
          </Text>
        )}
      </View>
      {inWarehouse ? (
        <View style={[styles.row, styles.progressRow]}>
          <ProgressSegments order={order} stockMap={stockMap} />
          <Text style={styles.progress} numberOfLines={1}>
            {progressLabel(order)}
          </Text>
        </View>
      ) : null}
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
  numberBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arrival: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  number: {
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
    fontVariant: ["tabular-nums"],
  },
  ageLate: {
    fontFamily: fonts.bold,
    color: tones.amber.text,
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
