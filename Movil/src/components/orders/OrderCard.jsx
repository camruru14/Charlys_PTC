import { Pressable, StyleSheet, Text, View } from "react-native";
import Pill from "../ui/Pill";
import { colors, getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatAge, formatMoney, formatNumber } from "../../lib/format";
import { orderJourneySteps } from "../../lib/orderJourney";
import { statusTone } from "../../lib/statusTones";

// Barra del recorrido: un segmento por tramo de ORDER_STEPS (lib/orderJourney.js).
// Tramos alcanzados con el color de su estado (dominio "pedido"); omitidos
// y pendientes en gris claro.
function JourneyBar({ order }) {
  const steps = orderJourneySteps(order);
  const reached = steps.filter((s) => s.state === "done" || s.state === "current").length;
  return (
    <View
      style={styles.bar}
      accessible
      accessibilityLabel={`Recorrido: ${reached} de ${steps.length} tramos`}
    >
      {steps.map((s) => (
        <View
          key={s.label}
          style={[
            styles.segment,
            {
              backgroundColor:
                s.state === "done" || s.state === "current"
                  ? getTone(statusTone(s.label, "pedido")).dot
                  : s.state === "skipped"
                    ? colors.lineSoft
                    : colors.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

// Tarjeta de un pedido en la lista de Pedidos.
export default function OrderCard({ order, onPress }) {
  const products = (order.items || []).length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.number}>{order.orderNumber}</Text>
        <Pill label={order.status} tone={statusTone(order.status, "pedido")} />
      </View>
      <View style={[styles.row, styles.customerRow]}>
        <Text style={styles.customer} numberOfLines={1}>
          {order.customer?.name || "—"}
        </Text>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>
      <JourneyBar order={order} />
      <View style={styles.row}>
        <Text style={styles.meta}>
          {formatNumber(products)} {products === 1 ? "producto" : "productos"}
        </Text>
        <Text style={styles.meta}>{formatAge(order.createdAt)}</Text>
      </View>
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
  pressed: {
    backgroundColor: colors.surface2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  customerRow: {
    marginTop: 4,
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
  total: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  bar: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
});
