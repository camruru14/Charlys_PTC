import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Leyenda de una gráfica, a la derecha del título de la tarjeta (como ChartLegend.jsx de la web).
// items: [{ key, label, color, shape?: "line" | "square" }].
export default function ChartLegend({ items = [] }) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <View style={[item.shape === "square" ? styles.square : styles.line, { backgroundColor: item.color }]} />
          <Text style={styles.text}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  item: { flexDirection: "row", alignItems: "center", gap: 5 },
  line: { width: 14, height: 3, borderRadius: 2 },
  square: { width: 10, height: 10, borderRadius: 3 },
  text: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink2 },
});
