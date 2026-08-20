import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import MiniButton from "../ui/MiniButton";
import { colors } from "../../lib/theme";

// Tarjeta de un pedido en LogisticaScreen. `pickups` (solo pestaña
// "Pedidos para despacho") viene precalculado por la pantalla con
// getRequiredPickups + pickupDateFor de lib/deliveryFilters.js — un badge
// verde con "✓" por cada parada ya recogida, gris por cada una pendiente.
export default function DeliveryOrderCard({
  order,
  pickups,
  statusLabel,
  statusTone,
  actionLabel,
  onAction,
  busy,
}) {
  const driver = order.delivery?.driver;
  const driverName = driver ? `${driver.name} ${driver.lastName}` : "— sin asignar";

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.orderNumber} numberOfLines={1}>
          {order.orderNumber}
        </Text>
        <Badge label={statusLabel} tone={statusTone} />
      </View>

      <Text style={styles.line}>Motorista: {driverName}</Text>
      <Text style={styles.line}>Vehículo: {order.delivery?.vehicle || "—"}</Text>
      <Text style={styles.line} numberOfLines={1}>
        Zona: {order.delivery?.address || order.customer?.address || "—"}
      </Text>

      {pickups && pickups.length > 0 ? (
        <View style={styles.pickupRow}>
          {pickups.map(({ location, done }) => (
            <Badge key={location} label={done ? `✓ ${location}` : location} tone={done ? "green" : "gray"} />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <MiniButton
          label={actionLabel}
          variant={actionLabel === "Asignar" ? "primary" : "neutral"}
          onPress={onAction}
          loading={busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderNumber: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  line: { marginTop: 4, fontSize: 12, color: colors.slate500 },
  pickupRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actions: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
