import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../../lib/theme";

// Botón chico tipo "pill" para acciones de fila (Verificar, Empacar,
// Fabricar, Reportar, etc.), usado en toda la Fase 4 — evita repetir el
// mismo TouchableOpacity+Text en cada pantalla que necesita varios botones
// de acción pequeños uno junto a otro.
const VARIANTS = {
  primary: { bg: colors.brand50, fg: colors.brand700 },
  neutral: { bg: colors.neutralSoftBg, fg: colors.slate700 },
  success: { bg: colors.successSoftBg, fg: colors.successSoftText },
  danger: { bg: colors.dangerSoftBg, fg: colors.danger },
};

export default function MiniButton({ label, onPress, variant = "primary", loading = false, disabled = false }) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: palette.bg }, isDisabled && styles.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      hitSlop={8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
