import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";

// Distinto de VerifyItemModal.jsx (que deja elegir cualquier bodega sin
// chequear existencia): este SOLO muestra las bodegas donde ya hay stock de
// ese producto/color, deshabilita las que no alcanzan, y ofrece "Enviar a
// fabricación" si ninguna alcanza — portado del Modal verifyModalOpen de
// Inventario.jsx. Un paso menos que el web (tocar una bodega la confirma
// directo, sin un botón "Confirmar" aparte): mismo criterio de "tocar para
// elegir" que ya usa SelectField en el resto de la app.
export default function VerifyStockModal({
  visible,
  target,
  matches,
  verifying,
  sendingToManufacturing,
  onClose,
  onConfirm,
  onSendToManufacturing,
}) {
  const hasSufficientStock = matches.some((m) => (m.stock || 0) >= (target?.item.quantity || 0));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>
            Verificar producto en inventario
          </Text>

          {target ? (
            <>
              <Text style={styles.description}>
                Buscando {target.item.quantity} {target.item.product}
                {target.item.color ? ` (${target.item.color})` : ""} para el pedido {target.order.orderNumber} en las
                bodegas disponibles.
              </Text>

              <ScrollView style={styles.list}>
                {matches.length === 0 ? (
                  <Text style={styles.warning}>
                    No se encontró este producto en ninguna bodega de Artículos en almacén.
                  </Text>
                ) : (
                  matches.map((m) => {
                    const insufficient = (m.stock || 0) < target.item.quantity;
                    return (
                      <TouchableOpacity
                        key={m._id}
                        style={styles.option}
                        disabled={insufficient || verifying}
                        onPress={() => onConfirm(m.location)}
                      >
                        <Text style={styles.optionLocation}>{m.location || "—"}</Text>
                        <Text style={insufficient ? styles.optionInsufficient : styles.optionStock}>
                          {Number(m.stock || 0).toLocaleString("es-SV")} {m.unit} disponibles
                          {insufficient ? " · insuficiente" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            {!hasSufficientStock ? (
              <TouchableOpacity
                style={styles.manufactureButton}
                disabled={sendingToManufacturing}
                onPress={onSendToManufacturing}
              >
                <Text style={styles.manufactureButtonText}>
                  {sendingToManufacturing ? "Enviando…" : "Enviar a fabricación"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {verifying ? <Text style={styles.verifyingText}>Verificando…</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", padding: 20 },
  title: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 8 },
  description: { fontSize: 13, color: colors.slate700, marginBottom: 12 },
  list: { maxHeight: 300 },
  option: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionLocation: { fontSize: 14, fontWeight: "700", color: colors.text },
  optionStock: { marginTop: 2, fontSize: 12, color: colors.slate500 },
  optionInsufficient: { marginTop: 2, fontSize: 12, fontWeight: "700", color: colors.danger },
  warning: {
    backgroundColor: colors.warningSoftBg,
    color: colors.warningSoftText,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
  },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  cancelButton: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  cancelButtonText: { fontSize: 13, fontWeight: "700", color: colors.slate700 },
  manufactureButton: { backgroundColor: colors.warning, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  manufactureButtonText: { fontSize: 13, fontWeight: "700", color: colors.white },
  verifyingText: { marginTop: 8, fontSize: 12, color: colors.slate500, textAlign: "center" },
});
