import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Fila horizontal de filtros con scroll. `options` es un arreglo de
// { value, label, count? }; `count` se muestra al lado del texto.
export default function FilterChips({ options, value, onChange, style, contentContainerStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
            {option.count != null ? (
              <Text style={[styles.count, active && styles.countActive]}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: 8,
  },
  chip: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipPressed: {
    backgroundColor: colors.surface2,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink2,
  },
  textActive: {
    color: colors.white,
  },
  count: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.faint,
    fontVariant: ["tabular-nums"],
  },
  countActive: {
    color: colors.primaryDisabled,
  },
});
