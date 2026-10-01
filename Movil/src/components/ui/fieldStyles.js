import { StyleSheet, Text } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// Estilos compartidos por FormField, SelectField, DateField, SwitchField y
// SegmentedField: etiqueta 12.5/600 ink2 arriba y caja de 46 de alto.
export const INPUT_HEIGHT = 46;

export const fieldStyles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.ink2,
    marginBottom: 6,
  },
  box: {
    minHeight: INPUT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    gap: 8,
  },
  boxDisabled: {
    backgroundColor: colors.busy,
  },
  value: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  placeholder: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.faint,
  },
  suffix: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.muted,
  },
});

// Etiqueta del campo con " *" si es obligatorio; sin `label` no ocupa lugar.
export function FieldLabel({ label, required }) {
  if (!label) return null;
  return (
    <Text style={fieldStyles.label}>
      {label}
      {required ? " *" : ""}
    </Text>
  );
}
