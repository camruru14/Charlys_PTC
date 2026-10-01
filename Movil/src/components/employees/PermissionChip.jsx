import { StyleSheet, Text, View } from "react-native";
import { getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { SCOPE_TONE, permissionChip, permissionSummary } from "../../lib/permissions";

// Pastilla con los paneles a los que tendría acceso un empleado según su área
// y puesto (PermissionLine de la web; informativo, no restringe nada).
// `short` abrevia las listas largas («Fabricación, Inventario y 2 más»).
export default function PermissionChip({ employee, short = false, style }) {
  const { scope, text } = short ? permissionChip(employee) : permissionSummary(employee);
  const palette = getTone(SCOPE_TONE[scope]);
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15 },
});
