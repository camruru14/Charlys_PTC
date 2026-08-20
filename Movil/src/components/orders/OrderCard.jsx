import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";
import { formatCurrency } from "../../lib/format";
import { orderStatusToneDetailed, paymentStatusTone } from "../../lib/statusTones";

// Tarjeta de un pedido en PedidosScreen: N° de pedido, cliente, total y dos
// badges (estado del pedido con el tono exclusivo de esta pantalla + estado
// de pago, más chico).
export default function OrderCard({ order }) {
  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.orderNumber} numberOfLines={1}>
          {order.orderNumber}
        </Text>
        <Badge label={order.status} tone={orderStatusToneDetailed(order.status)} />
      </View>

      <Text style={styles.customer} numberOfLines={1}>
        {order.customer?.name || "Cliente sin nombre"}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.total}>{formatCurrency(order.total)}</Text>
        <Badge label={order.paymentStatus} tone={paymentStatusTone(order.paymentStatus)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  customer: {
    marginTop: 4,
    fontSize: 13,
    color: colors.slate700,
  },
  footer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  total: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand700,
  },
});
