import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";
import { formatDate } from "../../lib/format";
import { batchStatusTone } from "../../lib/statusTones";

export default function PedidoBatchDetailModal({ visible, group, onClose, onEmpacar, onEditar, onEliminar, busyId }) {
  const rows = group?.batches || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>
            Lotes del pedido {group?.order?.orderNumber || ""}
          </Text>

          <ScrollView style={styles.list}>
            {rows.length === 0 ? (
              <Text style={styles.empty}>Este pedido no tiene lotes.</Text>
            ) : (
              rows.map(({ batch: b, item, index }) => {
                const pedidoLine = item ? { order: group.order, item, index } : null;
                return (
                  <View key={b._id} style={styles.row}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {b.batchNumber}
                      </Text>
                      <Badge label={b.status} tone={batchStatusTone(b.status)} />
                    </View>
                    <Text style={styles.rowSubtitle}>
                      {b.product} · {b.color || "—"} · {b.productionLine || "—"}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      Meta {b.targetQuantity ?? pedidoLine?.item?.quantity ?? "—"} · Producido{" "}
                      {Number(b.producedQuantity || 0).toLocaleString("es-SV")} · {formatDate(b.startDate || b.createdAt)}
                    </Text>

                    <View style={styles.rowActions}>
                      {!pedidoLine ? (
                        <Text style={styles.mutedText}>Sin pedido vinculado</Text>
                      ) : pedidoLine.item.packed ? (
                        <Badge label="Empacado" tone="green" />
                      ) : b.status === "Completado" ? (
                        <TouchableOpacity
                          style={styles.actionButton}
                          disabled={busyId === b._id}
                          onPress={() => onEmpacar(pedidoLine)}
                        >
                          <Text style={styles.actionButtonText}>{busyId === b._id ? "Empacando…" : "Empacar"}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.mutedText}>Editar lote para avanzar</Text>
                      )}
                      <TouchableOpacity style={styles.editButton} onPress={() => onEditar(b)}>
                        <Text style={styles.editButtonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteButton} onPress={() => onEliminar(b)}>
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                      </TouchableOpacity>
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
  row: { backgroundColor: colors.neutralSoftBg, borderRadius: 12, padding: 12, marginBottom: 8 },
  rowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: colors.text, flexShrink: 1 },
  rowSubtitle: { marginTop: 4, fontSize: 12, color: colors.slate500 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  mutedText: { fontSize: 12, color: colors.slate400 },
  actionButton: { backgroundColor: colors.brand50, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  editButton: {
    backgroundColor: colors.neutralSoftBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  editButtonText: { fontSize: 12, fontWeight: "700", color: colors.slate700 },
  deleteButton: { backgroundColor: colors.dangerSoftBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  empty: { fontSize: 13, color: colors.slate400, textAlign: "center", paddingVertical: 24 },
  closeButton: { marginTop: 12, alignSelf: "center" },
  closeButtonText: { fontSize: 13, fontWeight: "700", color: colors.slate700 },
});
