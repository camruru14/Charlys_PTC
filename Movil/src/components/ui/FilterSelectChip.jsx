import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";

// Chip de filtro que abre una hoja con sus opciones («Tipo: todos»), como
// los FilterSelect de la web. Sin valor muestra «Label: allLabel»; con un
// valor elegido va en primarySoft con borde.
//   <FilterSelectChip label="Tipo" allLabel="todos" value={type}
//     options={["Ingreso", "Gasto"]} onChange={setType} />
export default function FilterSelectChip({ label, allLabel = "todos", value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const active = value !== "" && value != null;
  const items = [{ value: "", label: allLabel.charAt(0).toUpperCase() + allLabel.slice(1) }, ...options.map((o) => ({ value: o, label: o }))];

  const pick = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${active ? value : allLabel}`}
        style={({ pressed }) => [styles.chip, active ? styles.chipActive : pressed && styles.pressed]}
      >
        <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
          {label}: {active ? value : allLabel}
        </Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.list}>
          {items.map((item, i) => {
            const selected = item.value === (value || "");
            return (
              <Pressable
                key={item.value || "all"}
                onPress={() => pick(item.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.option, i > 0 && styles.divider, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, selected && styles.optionSelected]}>{item.label}</Text>
                {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.selectBar },
  pressed: { backgroundColor: colors.surface2 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  textActive: { color: colors.primarySoftText },
  list: { marginBottom: 4 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  optionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  optionSelected: { fontFamily: fonts.semibold, color: colors.primary },
});
