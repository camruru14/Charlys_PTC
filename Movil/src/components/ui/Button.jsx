import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import Icon from "./Icon";

// Botón de la app. Reemplaza a CustomButton (acciones de pantalla) y
// MiniButton (acciones de fila), que quedan como envoltorios de este.
//   variant: primary | soft | secondary | danger | success
//   size:    normal (50 de alto) | small (34 de alto)
//   icon:    nombre de <Icon />, opcional, a la izquierda del texto
const VARIANTS = {
  primary: { bg: colors.primary, pressed: colors.primaryHover, fg: colors.white },
  soft: { bg: colors.primarySoft, pressed: colors.selectBg, fg: colors.primarySoftText },
  secondary: { bg: colors.surface, pressed: colors.surface2, fg: colors.ink, border: colors.line },
  danger: { bg: tones.rose.bg, pressed: colors.rowAlert, fg: tones.rose.text },
  success: { bg: tones.green.bg, pressed: colors.rowNew, fg: tones.green.text },
};

export default function Button({
  title,
  label,
  onPress,
  variant = "primary",
  size = "normal",
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const small = size === "small";
  const text = title ?? label;
  // El primario deshabilitado usa su propio color (primaryDisabled); el resto
  // se atenúa.
  const disabledPrimary = isDisabled && variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={small ? 6 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || text}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : styles.normal,
        {
          backgroundColor: disabledPrimary
            ? colors.primaryDisabled
            : pressed
              ? palette.pressed
              : palette.bg,
        },
        palette.border && { borderWidth: 1, borderColor: palette.border },
        isDisabled && !disabledPrimary && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
          {text ? (
            <Text
              style={[styles.text, small ? styles.textSmall : styles.textNormal, { color: palette.fg }]}
              numberOfLines={1}
            >
              {text}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  normal: {
    height: 50,
    paddingHorizontal: 18,
  },
  small: {
    height: 34,
    paddingHorizontal: 12,
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  text: {
    fontFamily: fonts.semibold,
  },
  textNormal: {
    fontSize: 15,
  },
  textSmall: {
    fontSize: 13,
  },
});
