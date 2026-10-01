import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../lib/theme";

// Modal chico (bottom sheet) para los formularios contextuales de la Fase 4
// (Verificar bodega, Reportar lote, Asignar/editar entrega): a diferencia de
// las pantallas de formulario de la Fase 3 (crear/editar un registro
// completo, con su propio header y navegación), estos son popups cortos
// sobre la pantalla actual, así que se resuelven con el `Modal` nativo de
// React Native en vez de una ruta más.
export default function FormModal({
  visible,
  title,
  onClose,
  onSave,
  saving = false,
  saveLabel = "Guardar",
  canSave = true,
  children,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.8}
              hitSlop={4}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, (saving || !canSave) && styles.saveButtonDisabled]}
              onPress={onSave}
              disabled={saving || !canSave}
              activeOpacity={0.8}
              hitSlop={4}
            >
              <Text style={styles.saveText}>{saving ? "Guardando…" : saveLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 14,
  },
  body: {
    flexGrow: 0,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate700,
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: colors.brand600,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
