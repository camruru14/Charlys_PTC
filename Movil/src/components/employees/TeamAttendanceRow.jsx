import { StyleSheet, Text, View } from "react-native";
import Avatar, { personTone } from "../ui/Avatar";
import Pill from "../ui/Pill";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { fmtHours, fullName, recordHours, timelineBar } from "../../lib/attendance";
import { statusTone } from "../../lib/statusTones";

// Fila de un empleado en Empleados > Asistencia (la franja de Asistencia.jsx
// en la web): avatar, nombre y horas; debajo, la línea de tiempo de 06:00 a
// 18:00 con la jornada en azul y la hora extra en ámbar, y la entrada y la
// salida en los extremos. Sin `record` es un Ausente (fondo rowAlert).
export default function TeamAttendanceRow({ employee, record, schedule }) {
  const name = fullName(employee);
  const bar = record ? timelineBar(record, schedule) : null;

  return (
    <View style={[styles.row, !record && styles.absent]}>
      <Avatar name={name} tone={personTone(employee)} size={28} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {name || "—"}
          </Text>
          {record ? (
            <Text style={styles.hours}>{fmtHours(recordHours(record, schedule).worked)} h</Text>
          ) : (
            <Pill label="Ausente" tone={statusTone("Ausente", "asistencia")} />
          )}
        </View>
        {record ? (
          bar ? (
            <>
              <View style={styles.track}>
                <View style={[styles.segment, { left: `${bar.left}%`, width: `${bar.workday + bar.extra}%` }]}>
                  <View style={[styles.fill, { flex: bar.workday, backgroundColor: tones.blue.dot }]} />
                  {bar.extra > 0 ? <View style={[styles.fill, { flex: bar.extra, backgroundColor: tones.amber.dot }]} /> : null}
                </View>
              </View>
              <View style={styles.times}>
                <Text style={styles.time}>{bar.checkIn}</Text>
                <Text style={styles.time}>{bar.checkOut}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.time}>Sin entrada o salida</Text>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 15, paddingVertical: 11 },
  absent: { backgroundColor: colors.rowAlert, alignItems: "center" },
  body: { flex: 1, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  hours: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.lineSoft, overflow: "hidden" },
  segment: { position: "absolute", top: 0, bottom: 0, flexDirection: "row", borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%" },
  times: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
});
