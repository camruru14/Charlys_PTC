import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/theme";

// Selector de una sola opción como fila de botones ("segmented control"
// simple), usado en vez de un Picker nativo para status/tipo/categoría/
// departamento/operario en los formularios de la Fase 3. `options` puede ser
// un arreglo de strings o de objetos (con getLabel/getValue).
export default function SegmentedField({
  label,
  value,
  options,
  onChange,
  getLabel = (option) => option,
  getValue = (option) => option,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const optionValue = getValue(option);
          const selected = optionValue === value;
          return (
            <TouchableOpacity
              key={String(optionValue)}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => onChange(optionValue)}
              activeOpacity={0.8}
              hitSlop={6}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {getLabel(option)}
              </Text>
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
  pill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  pillSelected: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand500,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
  },
  pillTextSelected: {
    color: colors.brand700,
  },
});
