import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Card from "../ui/Card";
import ProgressBar from "./ProgressBar";
import { colors } from "../../lib/theme";

// Fila resumen de un pedido agrupado, usada en los tabs "Por fabricar" y
// "Fabricación de pedidos" de Fabricación, y en el tab "Pedidos" de
// Inventario. `onDelete` (Fase 8, opcional) agrega el botón "Eliminar" —
// Fabricación sigue sin pasarlo, así que no le cambia nada.
export default function OrderGroupRow({ orderNumber, customerName, countLabel, segments, caption, onPress, onDelete }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.orderNumber} numberOfLines={1}>
        {orderNumber}
      </Text>
      <Text style={styles.customer} numberOfLines={1}>
        {customerName || "—"}
      </Text>
      <Text style={styles.count}>{countLabel}</Text>

      <View style={styles.progressWrap}>
        <ProgressBar segments={segments} caption={caption} />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.verButton} onPress={onPress}>
          <Text style={styles.verButtonText}>Ver</Text>
        </TouchableOpacity>
        {onDelete ? (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Eliminar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  orderNumber: { fontSize: 14, fontWeight: "700", color: colors.text },
  customer: { marginTop: 2, fontSize: 13, color: colors.slate700 },
  count: { marginTop: 4, fontSize: 12, color: colors.slate500 },
  progressWrap: { marginTop: 10 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  verButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
  deleteButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.dangerSoftBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
});
