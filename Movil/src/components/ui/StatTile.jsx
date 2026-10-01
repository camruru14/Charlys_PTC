import { StyleSheet, Text, View } from "react-native";
import { colors, getTone } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";

// Tarjeta de indicador: etiqueta en mayúsculas, valor grande y nota opcional.
//   <StatTile label="Ventas del mes" value="$ 48.200" note="+12% vs. mayo" tone="green" />
// `tone` (opcional) pone un punto de ese color antes de la etiqueta.
// `note` puede ser texto o un nodo (ej. la variación en color + texto).
// `size="small"` baja el valor a 20 para cuando van 2 o 3 por fila.
export default function StatTile({ label, value, note, noteColor, tone, size = "normal", style }) {
  return (
    <View style={[styles.tile, style]}>
      <View style={styles.labelRow}>
        {tone ? <View style={[styles.dot, { backgroundColor: getTone(tone).dot }]} /> : null}
        <Text style={[type.overline, styles.label]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, size === "small" && styles.valueSmall]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? (
        <Text style={[styles.note, noteColor && { color: noteColor }]} numberOfLines={2}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    flexShrink: 1,
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  valueSmall: {
    fontSize: 20,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
});
