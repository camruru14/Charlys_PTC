import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";
import { formatDate } from "../../lib/format";

export default function ManufacturingDetailModal({ visible, group, onClose, onFabricar, onEliminar, busyIndex }) {
  const lines = group?.lines || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>
            Productos enviados a fabricar · {group?.order?.orderNumber || ""}
          </Text>

          <ScrollView style={styles.list}>
            {lines.length === 0 ? (
              <Text style={styles.empty}>Este pedido no tiene productos enviados a fabricar.</Text>
            ) : (
              lines.map(({ item, index }) => (
                <View key={index} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.product}
                      {item.color ? ` · ${item.color}` : ""}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {item.quantity} unidades · Enviado {formatDate(item.sentToManufacturingAt)}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    {item.manufacturingBatch ? (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>
                          Fabricado{item.manufacturingBatch.batchNumber ? ` · ${item.manufacturingBatch.batchNumber}` : ""}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.actionButton}
                        disabled={busyIndex === index}
                        onPress={() => onFabricar({ order: group.order, item, index })}
                      >
                        <Text style={styles.actionButtonText}>{busyIndex === index ? "Fabricando…" : "Fabricar"}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      disabled={busyIndex === index}
                      onPress={() => onEliminar({ order: group.order, item, index })}
                    >
                      <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
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
  row: { backgroundColor: colors.neutralSoftBg, borderRadius: 12, padding: 12, marginBottom: 8 },
  rowInfo: { marginBottom: 8 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  rowSubtitle: { marginTop: 2, fontSize: 12, color: colors.slate500 },
  rowActions: { flexDirection: "row", gap: 8 },
  doneBadge: { backgroundColor: colors.successSoftBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  doneBadgeText: { fontSize: 12, fontWeight: "700", color: colors.successSoftText },
  actionButton: { backgroundColor: colors.brand50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  deleteButton: { backgroundColor: colors.dangerSoftBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  empty: { fontSize: 13, color: colors.slate400, textAlign: "center", paddingVertical: 24 },
  closeButton: { marginTop: 12, alignSelf: "center" },
  closeButtonText: { fontSize: 13, fontWeight: "700", color: colors.slate700 },
});
