import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";
import { PRODUCT_COLORS, PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";

// Chips de selección múltiple para `colors` en ProductoFormScreen: mismo
// patrón visual que el checkbox de PRODUCT_COLOR_HEX del panel web
// (puntito de color junto al nombre), adaptado a TouchableOpacity.
export default function ColorChips({ value = [], onChange }) {
  const toggle = (color) => {
    onChange(value.includes(color) ? value.filter((c) => c !== color) : [...value, color]);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Colores</Text>
      <View style={styles.row}>
        {PRODUCT_COLORS.map((color) => {
          const selected = value.includes(color);
          return (
            <TouchableOpacity
              key={color}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggle(color)}
              activeOpacity={0.8}
              hitSlop={6}
            >
              <View style={[styles.dot, { backgroundColor: PRODUCT_COLOR_HEX[color] }]} />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{color}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand500,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
  },
  chipTextSelected: {
    color: colors.brand700,
  },
});
