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
//
// Opcionales (no cambian los usos que ya existen):
// - Una opción puede ser { value, label, dot, meta, muted }: `dot` es el color
//   de un punto, `meta` un texto a la derecha (p. ej. un conteo) y `muted` la
//   pinta en gris sin impedir elegirla.
// - `allMeta`: el `meta` de la opción «todos».
// - Si hay `meta`, el chip se lee «Label  valor  meta ▾» (como el combobox
//   «Estado» de la web) y la hoja alinea los conteos a la derecha.
// - `size="lg"`: 42 de alto, como SearchField.
const normalize = (o) => (typeof o === "string" ? { value: o, label: o } : o);

export default function FilterSelectChip({ label, allLabel = "todos", value, options, onChange, allMeta, size = "md" }) {
  const [open, setOpen] = useState(false);
  const active = value !== "" && value != null;
  const allItem = { value: "", label: allLabel.charAt(0).toUpperCase() + allLabel.slice(1), meta: allMeta };
  const items = [allItem, ...options.map(normalize)];
  const selectedItem = items.find((i) => i.value === (value || "")) || allItem;
  const withMeta = items.some((i) => i.meta != null);
  const chipText = active ? selectedItem.label : allLabel;

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
        accessibilityLabel={`${label}: ${chipText}${withMeta && selectedItem.meta != null ? `, ${selectedItem.meta}` : ""}`}
        style={({ pressed }) => [styles.chip, size === "lg" && styles.chipLarge, active ? styles.chipActive : pressed && styles.pressed]}
      >
        {withMeta ? (
          <View style={styles.chipRow}>
            <Text style={styles.chipLabel}>{label}</Text>
            <Text style={[styles.text, styles.chipValue, active && styles.textActive]} numberOfLines={1}>
              {selectedItem.label}
            </Text>
            {selectedItem.meta != null ? (
              <Text style={[styles.chipMeta, active && styles.textActive]}>{selectedItem.meta}</Text>
            ) : null}
            <Icon name="chevronDown" size={15} color={active ? colors.primarySoftText : colors.subtle} />
          </View>
        ) : (
          <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
            {label}: {chipText}
          </Text>
        )}
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
                {item.dot ? <View style={[styles.dot, { backgroundColor: item.dot }, item.muted && styles.dotMuted]} /> : null}
                <Text
                  style={[styles.optionText, styles.optionLabel, item.muted && styles.optionMuted, selected && styles.optionSelected]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.meta != null ? (
                  <Text style={[styles.optionMeta, item.muted && styles.optionMuted, selected && styles.optionSelected]}>{item.meta}</Text>
                ) : null}
                {selected ? <Icon name="check" size={18} color={colors.primary} /> : withMeta ? <View style={styles.checkSpace} /> : null}
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
  chipLarge: { height: 42, borderRadius: 12 },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.selectBar },
  pressed: { backgroundColor: colors.surface2 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2 },
  textActive: { color: colors.primarySoftText },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  chipValue: { flexShrink: 1, color: colors.ink },
  chipMeta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, fontVariant: ["tabular-nums"] },
  list: { marginBottom: 4 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotMuted: { opacity: 0.4 },
  optionText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  optionLabel: { flex: 1 },
  optionMeta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, fontVariant: ["tabular-nums"] },
  optionMuted: { color: colors.faint },
  optionSelected: { fontFamily: fonts.semibold, color: colors.primary },
  checkSpace: { width: 18 },
});
