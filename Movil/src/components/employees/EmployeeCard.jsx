import { StyleSheet, Text, View } from "react-native";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { colors } from "../../lib/theme";
import { formatDui } from "../../lib/format";

// Tarjeta de un empleado. No muestra hourlyRate (información sensible de
// nómina) — queda para el detalle/edición en la Fase 3.
export default function EmployeeCard({ employee }) {
  const fullName = `${employee.name || ""} ${employee.lastName || ""}`.trim();
  const isActive = employee.isActive !== false;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {fullName}
        </Text>
        <Badge label={isActive ? "Activo" : "Cancelado"} tone={isActive ? "green" : "gray"} />
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>
        {employee.position}
        {employee.department ? ` · ${employee.department}` : ""}
      </Text>
      {employee.dui ? (
        <Text style={styles.dui}>DUI {formatDui(employee.dui)}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.slate500,
  },
  dui: {
    marginTop: 2,
    fontSize: 13,
    color: colors.slate500,
  },
});
