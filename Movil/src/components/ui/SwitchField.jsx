import { StyleSheet, Switch, Text, View } from "react-native";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { fieldStyles } from "./fieldStyles";

// Fila etiqueta + Switch dentro de la misma caja de 46 que los demás campos,
// usada para isActive/featured/active y filtros tipo "Solo con pendientes".
// `description` (opcional) va debajo de la etiqueta en muted.
export default function SwitchField({ label, value, onValueChange, description, disabled = false, style }) {
  return (
    <View style={[fieldStyles.field, style]}>
      <View style={[fieldStyles.box, styles.box]}>
        <View style={styles.texts}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.busyLine, true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.busyLine}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingRight: 8,
  },
  texts: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
});
