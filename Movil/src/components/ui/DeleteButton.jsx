import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../../lib/theme";

// Botón rojo al fondo de cada pantalla de edición (nunca en la de
// creación), que pide confirmación antes de borrar — mismo patrón de
// Alert.alert en las 6 pantallas de formulario de la Fase 3.
export default function DeleteButton({
  label = "Eliminar",
  confirmTitle = "¿Eliminar?",
  confirmMessage = "Esta acción no se puede deshacer.",
  onConfirm,
  disabled = false,
}) {
  const handlePress = () => {
    Alert.alert(confirmTitle, confirmMessage, [
      { text: "Cancelar" },
      { text: "Eliminar", style: "destructive", onPress: onConfirm },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoftBg,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "700",
  },
});
