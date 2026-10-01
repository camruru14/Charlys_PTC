import { StyleSheet, Text, View } from "react-native";
import { colors, getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Fila de indicadores pequeños: cuadrito de color, etiqueta y valor.
//   <KpiInline items={[{ label: "En proceso", value: 12, tone: "blue" }]} />
// Cada item acepta `tone` (usa su color dot) o `color` directo.
export default function KpiInline({ items, style }) {
  return (
    <View style={[styles.row, style]}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.swatch, { backgroundColor: item.color || getTone(item.tone).dot }]} />
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});
