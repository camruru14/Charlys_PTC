import { View } from "react-native";
import { PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";
import { colors } from "../../lib/theme";

// Muestra de color de producto, como ColorSwatch de la web: usa los colores
// reales del catálogo (PRODUCT_COLOR_HEX), no tokens del tema, porque
// representan el color físico del producto. Sin color conocido queda en
// lineSoft.
export default function ColorSwatch({ color, size = 12, style }) {
  const hex = color ? PRODUCT_COLOR_HEX[color] : null;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: hex || colors.lineSoft,
        },
        style,
      ]}
    />
  );
}
