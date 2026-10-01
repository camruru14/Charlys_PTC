import { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../hooks/useAuth";
import { useMyAttendance } from "../hooks/useMyAttendance";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import { api } from "../lib/api";
import AttendanceRow from "../components/employees/AttendanceRow";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import ErrorState from "../components/ui/ErrorState";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatClock, formatWeekdayDate } from "../lib/format";
import { dayKey, fmtHours, hoursPayload, recordDay } from "../lib/attendance";
import { useBottomPad } from "../hooks/useBottomPad";

// Igual que SecureStore.getItemAsync/setItemAsync ya usa AuthContext para el
// token: acá guarda la hora de "Marcar entrada" localmente hasta que se
// marca la salida, así sobrevive a que la app se cierre por completo antes
// de terminar el ciclo.
const CHECKIN_KEY = "charly-attendance-checkin";

// "jue 24 sep" -> "Jue 24"
function shortDay(date) {
  const [weekday, day] = formatWeekdayDate(date).split(" ");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}`;
}

// Lunes de esta semana a las 00:00.
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Hora actual, actualizada al cambiar cada minuto.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60000);
    }, 60000 - (Date.now() % 60000));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

// Mi asistencia (exclusiva de la app): el empleado marca su propia entrada y
// salida en tiempo real. El backend solo acepta un registro completo de una
// sola vez (POST /employees/:id/attendance), así que "Marcar entrada" no
// llama a la API todavía — solo guarda la hora localmente — y recién al
// "Marcar salida" se arma el registro completo y se manda, con las horas
// calculadas como la web (horario laboral de /settings/work-schedule).
export default function AsistenciaScreen() {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  const { user } = useAuth();
  const { attendance, loading, refreshing, error, refresh } = useMyAttendance();
  const { schedule, refresh: refreshSchedule } = useWorkSchedule();
  const now = useNow();
  const [checkIn, setCheckIn] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Al abrir la pantalla, recupera una entrada marcada previamente (incluso
  // si la app se cerró por completo mientras tanto).
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(CHECKIN_KEY);
        if (stored) setCheckIn(new Date(stored));
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const week = useMemo(() => {
    const from = startOfWeek();
    return attendance
      .map((record, i) => ({ key: `${record.date}-${i}`, record, date: recordDay(record) }))
      .filter((r) => r.date && r.date >= from)
      .sort((a, b) => b.date - a.date);
  }, [attendance]);

  const handleCheckIn = async () => {
    const at = new Date();
    try {
      await SecureStore.setItemAsync(CHECKIN_KEY, at.toISOString());
      setCheckIn(at);
      toast.show(`Entrada marcada a las ${formatClock(at)}`);
    } catch (err) {
      Alert.alert("No se pudo marcar la entrada", err.message || "Intenta de nuevo");
    }
  };

  const handleCheckOut = async () => {
    if (!checkIn) return;
    const checkOut = new Date();
    const hours = hoursPayload(checkIn, checkOut, schedule);

    setSubmitting(true);
    try {
      await api.post(`/employees/${user.id}/attendance`, {
        // Día local de la entrada (como el «date» del formulario de la web).
        date: dayKey(checkIn),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        ...hours,
      });
      await SecureStore.deleteItemAsync(CHECKIN_KEY);
      setCheckIn(null);
      toast.show(`Salida marcada · ${fmtHours(hours.workedHours)} h trabajadas`);
      refresh();
    } catch (err) {
      Alert.alert("No se pudo registrar la asistencia", err.message || "Intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  };

  if (restoring || (loading && !attendance.length)) return <LoadingState />;
  if (error && attendance.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            refreshSchedule();
          }}
        />
      }
    >
      <Card style={styles.clockCard}>
        <Text style={[type.overline, styles.center]}>Hora actual</Text>
        <Text style={styles.clock}>{formatClock(now)}</Text>
        <Text style={styles.schedule}>
          {checkIn
            ? `Entrada marcada a las ${formatClock(checkIn)} · jornada de ${schedule.workdayHours} horas`
            : `Entrada a las ${schedule.startTime} · jornada de ${schedule.workdayHours} horas`}
        </Text>
        <Button
          title={checkIn ? "Marcar salida" : "Marcar entrada"}
          icon="fingerprint"
          loading={submitting}
          onPress={checkIn ? handleCheckOut : handleCheckIn}
          style={styles.mark}
        />
        <Text style={styles.note}>Tu salida se marca aquí mismo al terminar el turno.</Text>
      </Card>

      <ListGroup>
        <View style={styles.groupHeader}>
          <Text style={type.cardTitle}>Esta semana</Text>
        </View>
        {week.length ? (
          week.map((r) => (
            <AttendanceRow
              key={r.key}
              dayLabel={shortDay(r.date)}
              record={r.record}
              schedule={schedule}
              showHours={false}
              dayWidth={60}
            />
          ))
        ) : (
          <Text style={styles.empty}>Todavía no hay marcaciones esta semana.</Text>
        )}
      </ListGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  clockCard: { alignItems: "stretch", paddingVertical: 24, paddingHorizontal: 16, gap: 4 },
  center: { textAlign: "center" },
  clock: {
    fontFamily: fonts.extrabold,
    fontSize: 52,
    lineHeight: 62,
    letterSpacing: -1,
    color: colors.ink,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  schedule: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 14 },
  mark: { height: 64, borderRadius: 16 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 10 },
  groupHeader: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 10 },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingHorizontal: 15, paddingVertical: 14 },
});
