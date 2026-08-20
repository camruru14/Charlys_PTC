import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";

export default function PedidoInventarioDetailModal({ visible, order, onClose, onVerify, onPack, busyIndex }) {
  const items = order?.items || [];

  const itemStatus = (it) => {
    if (order?.delivery?.driver) return "Entregado";
    if (it.packed) return "Empacado";
    if (it.verified) return "Verificado";
    if (it.sentToManufacturing) return "En Fabricación";
    return "Sin Verificar";
  };

  const badgeTone = (status) => {
    if (status === "Empacado" || status === "Entregado") return "green";
    if (status === "Verificado") return "blue";
    if (status === "En Fabricación") return "amber";
    return "gray";
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>
            Productos del pedido {order?.orderNumber || ""}
          </Text>

          <ScrollView style={styles.list}>
            {items.length === 0 ? (
              <Text style={styles.empty}>Este pedido no tiene productos.</Text>
            ) : (
              items.map((it, index) => {
                const status = itemStatus(it);
                return (
                  <View key={index} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {it.product}
                        {it.color ? ` · ${it.color}` : ""}
                      </Text>
                      <Text style={styles.rowSubtitle}>{it.quantity} unidades</Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Badge label={status} tone={badgeTone(status)} />
                      {status === "Sin Verificar" ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          disabled={busyIndex === index}
                          onPress={() => onVerify({ order, item: it, index })}
                        >
                          <Text style={styles.actionButtonText}>Verificar</Text>
                        </TouchableOpacity>
                      ) : status === "En Fabricación" ? (
                        <Text style={styles.mutedText}>esperando lote</Text>
                      ) : status === "Verificado" ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          disabled={busyIndex === index}
                          onPress={() => onPack({ order, item: it, index })}
                        >
                          <Text style={styles.actionButtonText}>{busyIndex === index ? "Empacando…" : "Empacar"}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", padding: 20 },
  title: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 12 },
  list: { maxHeight: 420 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  rowSubtitle: { marginTop: 2, fontSize: 12, color: colors.slate500 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  mutedText: { fontSize: 11, color: colors.slate400 },
  actionButton: { backgroundColor: colors.brand50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  empty: { fontSize: 13, color: colors.slate400, textAlign: "center", paddingVertical: 24 },
  closeButton: { marginTop: 12, alignSelf: "center" },
  closeButtonText: { fontSize: 13, fontWeight: "700", color: colors.slate700 },
});
