import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

const defaultGetLabel = (option) => (typeof option === "object" ? option.label : option);
const defaultGetValue = (option) => (typeof option === "object" ? option.value : option);

// Control segmentado (pestañas de arriba de una pantalla): contenedor gris
// con la opción activa en blanco. `options` puede ser un arreglo de strings o
// de objetos { label, value } (o cualquier forma, con getLabel/getValue).
// Con más de 4 opciones, o `scrollable`, las opciones no se reparten el
// ancho sino que se desplazan horizontalmente.
export default function Segmented({
  options,
  value,
  onChange,
  getLabel = defaultGetLabel,
  getValue = defaultGetValue,
  scrollable,
  style,
}) {
  const scroll = scrollable ?? options.length > 4;

  const items = options.map((option) => {
    const optionValue = getValue(option);
    const selected = optionValue === value;
    return (
      <Pressable
        key={String(optionValue)}
        style={[styles.option, !scroll && styles.optionFill, selected && styles.optionActive]}
        onPress={() => onChange(optionValue)}
        hitSlop={4}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.text, selected && styles.textActive]} numberOfLines={1}>
          {getLabel(option)}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <View style={[styles.container, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {items}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.row, style]} accessibilityRole="tablist">
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.segmentBg,
    borderRadius: 12,
    padding: 3,
  },
  row: {
    flexDirection: "row",
  },
  scrollContent: {
    flexDirection: "row",
  },
  option: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  optionFill: {
    flex: 1,
  },
  optionActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.muted,
  },
  textActive: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
});
