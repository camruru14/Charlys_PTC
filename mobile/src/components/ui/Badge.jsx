import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Pill de estado/categoría reutilizado por todas las tarjetas de dominio
// (status de lotes, tipo de transacción, activo/inactivo, categoría, etc.)
const TONES = {
  gray: { bg: colors.neutralSoftBg, fg: colors.slate500 },
  blue: { bg: colors.brand50, fg: colors.brand700 },
  green: { bg: colors.successSoftBg, fg: colors.successSoftText },
  red: { bg: colors.dangerSoftBg, fg: colors.danger },
  amber: { bg: colors.warningSoftBg, fg: colors.warningSoftText },
  yellow: { bg: colors.yellowSoftBg, fg: colors.yellowSoftText },
  purple: { bg: colors.purpleSoftBg, fg: colors.purpleSoftText },
  sky: { bg: colors.skySoftBg, fg: colors.skySoftText },
};

export default function Badge({ label, tone = "gray" }) {
  const palette = TONES[tone] || TONES.gray;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
