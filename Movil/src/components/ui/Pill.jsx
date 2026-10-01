import { StyleSheet, Text, View } from "react-native";
import { getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Pastilla de estado/categoría, como StatusPill de la web: fondo suave del
// tono, texto del tono y un punto con el color "dot". `tone` es uno de los 7
// tonos de lib/theme.js (el mapeo estado -> tono está en lib/statusTones.js).
export default function Pill({ label, tone = "gray", dot = true, style }) {
  const palette = getTone(tone);

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.dot }]} /> : null}
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
