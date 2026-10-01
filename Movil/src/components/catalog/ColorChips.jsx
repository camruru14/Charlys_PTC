import { Pressable, StyleSheet, Text, View } from "react-native";
import { FieldLabel } from "../ui/fieldStyles";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { PRODUCT_COLORS, PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";

// Colores del producto (selección múltiple), como los checkboxes con
// puntito de ProductFormModal.jsx en la web: chip con su punto de color;
// seleccionado en primarySoft con borde.
export default function ColorChips({ value = [], onChange }) {
  const toggle = (color) => {
    onChange(value.includes(color) ? value.filter((c) => c !== color) : [...value, color]);
  };

  return (
    <View style={styles.field}>
      <FieldLabel label="Colores" />
      <View style={styles.row}>
        {PRODUCT_COLORS.map((color) => {
          const selected = value.includes(color);
          return (
            <Pressable
              key={color}
              onPress={() => toggle(color)}
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => [styles.chip, selected ? styles.selected : pressed && styles.pressed]}
            >
              <View style={[styles.dot, { backgroundColor: PRODUCT_COLOR_HEX[color] }]} />
              <Text style={[styles.text, selected && styles.textSelected]}>{color}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surface2 },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.selectBar },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: colors.line },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  textSelected: { color: colors.primarySoftText },
});
