import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Sparkline from "./Sparkline";
import { colors } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";

// Tarjeta KPI del Dashboard (2×2): etiqueta, valor, nota de comparación (un nodo, para poder
// colorear la variación) y la mini gráfica de línea al ancho de la tarjeta.
export default function KpiTile({ label, value, valueColor, note, spark, color, sparkLabel, style }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={[styles.tile, style]}>
      <Text style={[type.overline, styles.label]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, valueColor && { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.note} numberOfLines={2}>
        {note}
      </Text>
      <View style={styles.spark} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {width > 0 ? <Sparkline data={spark} color={color} width={width} height={36} accessibilityLabel={sparkLabel} /> : null}
      </View>
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
    gap: 3,
  },
  label: { flexShrink: 1 },
  value: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, color: colors.ink, fontVariant: ["tabular-nums"] },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, minHeight: 32 },
  spark: { height: 36, marginTop: 2 },
});
