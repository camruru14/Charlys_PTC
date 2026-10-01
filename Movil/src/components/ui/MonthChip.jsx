import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import BottomSheet from "./BottomSheet";
import FilterChips from "./FilterChips";
import Icon from "./Icon";

// Chip de mes (ícono de calendario + «Septiembre») que abre una hoja con los
// meses para elegir. options = [{ value, label }].
export default function MonthChip({ value, options, onChange, title = "Mes", style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selected?.label || ""}`}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed, style]}
      >
        <Icon name="calendar" size={15} color={colors.faint} />
        <Text style={styles.text} numberOfLines={1}>
          {selected?.label || "—"}
        </Text>
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <FilterChips
          options={options}
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surface2 },
  text: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
});
