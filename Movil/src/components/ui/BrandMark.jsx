import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Logo «IC»: cuadro primary con las iniciales en blanco, como el del panel
// web (Login y Rail). `size` 32 en el menú lateral, 48 en Login, 64 en el
// splash de bienvenida.
export default function BrandMark({ size = 48, style }) {
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: Math.round(size * 0.3) }, style]}
      accessibilityRole="image"
      accessibilityLabel="Industrias Charly"
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>IC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.extrabold, color: colors.white },
});
