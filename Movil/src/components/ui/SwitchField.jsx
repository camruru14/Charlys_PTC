import { StyleSheet, Switch, Text, View } from "react-native";
import { colors } from "../../lib/theme";

// Fila label + Switch, usada para isActive/featured/active en los
// formularios de la Fase 3.
export default function SwitchField({ label, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slate200, true: colors.brand500 }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate700,
    flexShrink: 1,
    paddingRight: 12,
  },
});
