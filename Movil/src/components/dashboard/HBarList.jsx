import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Lista de barras horizontales (un solo color), portada de HBarList.jsx de la web: etiqueta, la barra
// (SVG) y el número al final. La fila tiene 36 px de alto, así que el área de toque es mayor que la barra.
//   rows       [{ key, label, value, display?, onPress? }]  (display: texto del número; onPress: toque de la fila)
//   color      color de las barras
//   max        valor que llena la barra completa (por omisión, el mayor de las filas)
function Bar({ ratio, color }) {
  return (
    <Svg width="100%" height={14}>
      <Rect x="0" y="0" width="100%" height={14} rx={4} fill={colors.lineSoft} />
      {ratio > 0 ? <Rect x="0" y="0" width={`${Math.max(2, ratio * 100)}%`} height={14} rx={4} fill={color} /> : null}
    </Svg>
  );
}

export default function HBarList({ rows = [], color, max, accessibilityLabel }) {
  const top = max ?? Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <View accessible={!rows.some((r) => r.onPress)} accessibilityLabel={accessibilityLabel}>
      {rows.map((r) => {
        const content = (
          <>
            <Text style={styles.label} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.bar}>
              <Bar ratio={(Number(r.value) || 0) / top} color={color} />
            </View>
            <Text style={styles.value}>{r.display ?? r.value}</Text>
          </>
        );
        return r.onPress ? (
          <Pressable
            key={r.key}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.display ?? r.value}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {content}
          </Pressable>
        ) : (
          <View key={r.key} style={styles.row}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, height: 36 },
  pressed: { opacity: 0.6 },
  label: { width: "32%", fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  bar: { flex: 1 },
  value: { minWidth: 44, textAlign: "right", fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
});
