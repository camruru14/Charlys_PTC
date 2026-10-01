import { Pressable, StyleSheet, Text, View } from "react-native";
import Avatar, { personTone } from "../ui/Avatar";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { fullName } from "../../lib/attendance";
import { statusTone } from "../../lib/statusTones";

export const employeeStatus = (emp) => (emp.isActive !== false ? "Activo" : "Inactivo");
export const roleLine = (emp) => [emp.position, emp.department].filter(Boolean).join(" · ");

// Fila de un empleado en Empleados > Personal (EmployeeRow de la web), para
// ir dentro de un ListGroup: avatar con un tono fijo por persona, nombre,
// «Puesto · Área» y la Pill Activo / Inactivo.
export default function EmployeeRow({ employee, onPress }) {
  const status = employeeStatus(employee);
  const inactive = status === "Inactivo";
  const role = roleLine(employee);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={fullName(employee)} tone={personTone(employee)} size={36} />
      <View style={styles.texts}>
        <Text style={[styles.name, inactive && styles.muted]} numberOfLines={1}>
          {fullName(employee) || "—"}
        </Text>
        {role ? (
          <Text style={styles.role} numberOfLines={1}>
            {role}
          </Text>
        ) : null}
      </View>
      <Pill label={status} tone={statusTone(status, "empleado")} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 10 },
  pressed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  muted: { color: colors.muted },
  role: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
