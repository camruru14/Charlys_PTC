import { StyleSheet, View } from "react-native";
import Icon from "../ui/Icon";
import { categoryIconName, categoryTone } from "../../lib/expenseCategories";

// Cuadro con el ícono de una categoría de gasto, tintado con su color. Con
// `name` se fuerza otro ícono de <Icon /> («Otros ingresos» va con $ en verde,
// las ventas con la bolsa).
export default function CategoryAvatar({ icon, color, name, size = 38, style }) {
  const tone = categoryTone(color);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: tone.bg }, style]}>
      <Icon name={name || categoryIconName(icon)} size={Math.round(size * 0.46)} color={tone.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
