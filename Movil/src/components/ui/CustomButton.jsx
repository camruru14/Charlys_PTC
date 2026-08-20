import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../../lib/theme";

// Botón reutilizable al estilo del CustomButton.jsx del proyecto de
// referencia: TouchableOpacity + estado de loading + variante deshabilitada.
export default function CustomButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.brand700 : colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "secondary" && styles.textSecondary,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand600,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  textSecondary: {
    color: colors.brand700,
  },
});
