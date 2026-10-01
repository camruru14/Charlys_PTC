import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import { FieldLabel, fieldStyles } from "./fieldStyles";

// Selector de una opción entre una lista, que se abre en una BottomSheet.
// `label` es opcional (si no se pasa, no ocupa espacio arriba — útil para
// usarlo como filtro compacto, ver Dashboard); `title` es el encabezado de
// la hoja y por defecto usa `label`.
export default function SelectField({
  label,
  title,
  value,
  options,
  onChange,
  required = false,
  placeholder = "Seleccionar",
  style,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const heading = title || label;

  return (
    <View style={[fieldStyles.field, style]}>
      <FieldLabel label={label} required={required} />
      <Pressable
        style={({ pressed }) => [fieldStyles.box, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${heading || "Seleccionar"}: ${selected ? selected.label : "sin seleccionar"}`}
      >
        <Text style={selected ? fieldStyles.value : fieldStyles.placeholder} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="chevronDown" size={18} color={colors.chevron} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={heading} scroll={false}>
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.value)}
          style={styles.list}
          renderItem={({ item, index }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && styles.optionDivider,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionSelected]}>{item.label}</Text>
                {isSelected ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No hay opciones</Text>}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.surface2 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
  },
  optionDivider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  optionSelected: { fontFamily: fonts.semibold, color: colors.primary },
  empty: { paddingVertical: 14, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
