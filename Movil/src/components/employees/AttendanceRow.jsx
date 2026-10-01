import { StyleSheet, Text, View } from "react-native";
import Pill from "../ui/Pill";
import { colors } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatClock } from "../../lib/format";
import { attendanceStatus, fmtHours, recordHours } from "../../lib/attendance";
import { statusTone } from "../../lib/statusTones";

const DASH = "—";

// Fila de un día de asistencia de un empleado (ficha y «Esta semana»), para
// ir dentro de un ListGroup: día, entrada – salida, horas (opcional) y el
// estado (Completo, Con extra, Tarde). Sin `record` es un día Ausente, con
// fondo rowAlert, como en la tabla de la ficha de la web.
export default function AttendanceRow({ dayLabel, record, schedule, showHours = true, dayWidth = 84 }) {
  const status = record ? attendanceStatus(record, schedule) : "Ausente";
  const times = record
    ? `${record.checkIn ? formatClock(record.checkIn) : DASH} – ${record.checkOut ? formatClock(record.checkOut) : DASH}`
    : `${DASH} – ${DASH}`;

  return (
    <View style={[styles.row, !record && styles.absent]}>
      <Text style={[styles.day, { width: dayWidth }]} numberOfLines={1}>
        {dayLabel}
      </Text>
      <Text style={styles.times} numberOfLines={1}>
        {times}
      </Text>
      {showHours ? (
        <Text style={styles.hours}>{record ? fmtHours(recordHours(record, schedule).worked) : DASH}</Text>
      ) : null}
      <View style={styles.pill}>
        <Pill label={status} tone={statusTone(status, "asistencia")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 15, paddingVertical: 9 },
  absent: { backgroundColor: colors.rowAlert },
  day: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
  times: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.ink2, fontVariant: ["tabular-nums"] },
  hours: { minWidth: 30, textAlign: "right", fontFamily: fonts.bold, fontSize: 13, color: colors.ink, fontVariant: ["tabular-nums"] },
  pill: { minWidth: 84, alignItems: "flex-end" },
});
