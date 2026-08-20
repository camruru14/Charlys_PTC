import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Barra de progreso segmentada (ej. "2 en fabricación · 1 en cola"),
// portada del patrón visual de manufacturingProgress.js del panel web.
// segments = [{ key, count, pct, color, label }]
export default function ProgressBar({ segments = [], caption }) {
  return (
    <View>
      <View style={styles.track}>
        {segments.map((s) => (
          <View key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.color, height: "100%" }} />
        ))}
      </View>
      <Text style={styles.caption} numberOfLines={1}>
        {caption || "Sin datos"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.neutralSoftBg,
  },
  caption: {
    marginTop: 4,
    fontSize: 11,
    color: colors.slate500,
  },
});
