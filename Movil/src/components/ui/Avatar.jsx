import { StyleSheet, Text, View } from "react-native";
import { getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// "Ana María López" -> "AL"; "ana" -> "A".
export function initials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Círculo con las iniciales, con el fondo y el texto del tono.
export default function Avatar({ name, tone = "blue", size = 36, style }) {
  const palette = getTone(tone);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg },
        style,
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.text, { color: palette.text, fontSize: Math.round(size * 0.38) }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.bold,
  },
});
