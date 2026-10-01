import { StyleSheet, View } from "react-native";
import { colors, getTone } from "../../lib/theme";

// Barra de nivel de 6px (existencias, avance de un lote). `value` va de 0 a
// `max` (100 por defecto); el relleno usa el color dot del tono.
export default function LevelMeter({ value = 0, max = 100, tone = "blue", style }) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: getTone(tone).dot }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lineSoft,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
