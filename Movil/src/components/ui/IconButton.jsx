import { Pressable, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";
import Icon from "./Icon";

// Botón cuadrado de 42×42 con solo un ícono (volver, filtros, agregar...).
//   variant: bordered (blanco con borde) | primary (fondo primary, ícono blanco)
// accessibilityLabel es obligatorio: sin texto visible, es lo único que
// anuncia el lector de pantalla.
export default function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "bordered",
  iconSize = 20,
  disabled = false,
  style,
}) {
  if (__DEV__ && !accessibilityLabel) {
    console.warn(`IconButton "${icon}" sin accessibilityLabel`);
  }
  const primary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: disabled ? colors.primaryDisabled : pressed ? colors.primaryHover : colors.primary }
          : [styles.bordered, pressed && { backgroundColor: colors.surface2 }],
        disabled && !primary && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={primary ? colors.white : colors.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bordered: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  disabled: {
    opacity: 0.5,
  },
});
