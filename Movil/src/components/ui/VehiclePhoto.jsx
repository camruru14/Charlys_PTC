import { Image, StyleSheet, View } from "react-native";
import { colors } from "../../lib/theme";
import Icon from "./Icon";

// Foto de un vehículo (cover) o, si no tiene, un camión sobre fondo gris
// (VehiclePhoto de la web). El tamaño y las esquinas los define quien la usa
// con `style`.
//   <VehiclePhoto uri={v.image?.url} iconSize={20} style={{ width: 56, height: 40, borderRadius: 8 }} />
export default function VehiclePhoto({ uri, style, iconSize = 24 }) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.base, style]} resizeMode="cover" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.base, styles.placeholder, style]}>
      <Icon name="truck" size={iconSize} color={colors.faint} strokeWidth={1.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.canvas, overflow: "hidden" },
  placeholder: { alignItems: "center", justifyContent: "center" },
});
