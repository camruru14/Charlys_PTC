import { StyleSheet, Text } from "react-native";
import Card from "../ui/Card";
import { colors } from "../../lib/theme";
import { formatDate, formatTime } from "../../lib/format";

// Fila de una marcación en el tab "Asistencia" de Empleados (vista RRHH: de
// TODOS los empleados, a diferencia de AsistenciaScreen que solo muestra las
// del empleado logueado).
export default function AttendanceRow({ record }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.name} numberOfLines={1}>{record.employeeName}</Text>
      <Text style={styles.date}>{formatDate(record.date)}</Text>
      <Text style={styles.detail}>
        Entrada {formatTime(record.checkIn)} · Salida {formatTime(record.checkOut)}
      </Text>
      <Text style={styles.detail}>
        {Number(record.workedHours || 0).toLocaleString("es-SV")} h trabajadas
        {record.overtimeHours ? ` · ${Number(record.overtimeHours).toLocaleString("es-SV")} h extra` : ""}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  date: { marginTop: 2, fontSize: 12, fontWeight: "600", color: colors.slate500 },
  detail: { marginTop: 2, fontSize: 12, color: colors.slate500 },
});
