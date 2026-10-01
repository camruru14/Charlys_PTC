import { StyleSheet } from "react-native";
import { colors } from "./theme";

// Figtree, la misma tipografía del panel web. Se carga en App.js con
// @expo-google-fonts/figtree. En React Native cada peso es una familia
// distinta: se elige con fontFamily y NO se combina con fontWeight (en
// Android, fontWeight sobre una fuente cargada hace que caiga a la del
// sistema).
export const fonts = {
  regular: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  semibold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
  extrabold: "Figtree_800ExtraBold",
};

const BY_WEIGHT = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semibold,
  700: fonts.bold,
  800: fonts.extrabold,
};

// font(600) -> { fontFamily: "Figtree_600SemiBold" }
export function font(weight = 400) {
  return { fontFamily: BY_WEIGHT[weight] || fonts.regular };
}

export const type = StyleSheet.create({
  // Título de pantalla
  screenTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  // Subtítulo debajo del título de pantalla
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  // Etiqueta pequeña en mayúsculas (encabezados de sección, StatTile)
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.faint,
  },
  // Se combina con otro estilo: [type.body, type.tabular]
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});

export default type;
