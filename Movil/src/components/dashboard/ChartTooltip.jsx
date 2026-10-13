import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Globo de las gráficas (se muestra al tocar un casillero). Va dentro de un contenedor con
// position: relative, en (x, y) del contenedor; pasa a la izquierda de x si no cabe a la derecha.
//   title: texto en negrita; rows: [{ color?, label, value, valueColor? }]
export default function ChartTooltip({ x, y = 0, containerWidth, title, rows = [] }) {
  const flip = x > containerWidth * 0.5;
  const position = flip ? { right: Math.max(0, containerWidth - x + 10) } : { left: x + 10 };
  return (
    <View pointerEvents="none" style={[styles.box, { top: y }, position]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <View style={styles.labelWrap}>
            {r.color ? <View style={[styles.dot, { backgroundColor: r.color }]} /> : null}
            <Text style={styles.label}>{r.label}</Text>
          </View>
          <Text style={[styles.value, r.valueColor && { color: r.valueColor }]}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    minWidth: 128,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    elevation: 4,
    shadowColor: "#16203A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  title: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, marginBottom: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  labelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  value: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, fontVariant: ["tabular-nums"] },
});
