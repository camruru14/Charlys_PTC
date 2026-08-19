import { useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../hooks/useAuth";
import { useMyAttendance } from "../hooks/useMyAttendance";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import CustomButton from "../components/ui/CustomButton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import { colors } from "../lib/theme";
import { formatDate, formatTime } from "../lib/format";

// Igual que SecureStore.getItemAsync/setItemAsync ya usa AuthContext para el
// token: acá guarda la hora de "Marcar entrada" localmente hasta que se
// marca la salida, así sobrevive a que la app se cierre por completo antes
// de terminar el ciclo (ver PARTE 2 de la Fase 4).
const CHECKIN_KEY = "charly-attendance-checkin";
// Jornada de referencia para calcular horas extra, misma fórmula que ya usa
// pages/Empleados.jsx en el panel web.
const STANDARD_WORKDAY_HOURS = 8;

// A diferencia del panel web (donde RRHH captura la asistencia A POSTERIORI
// con fecha/entrada/salida ya conocidas), acá el empleado marca su propia
// entrada y salida en tiempo real. El backend solo acepta un registro
// completo de una sola vez ($push de un elemento), así que "Marcar entrada"
// no llama a la API todavía — solo guarda la hora localmente — y recién al
// "Marcar salida" se arma el registro completo y se manda.
export default function AsistenciaScreen() {
  const { user } = useAuth();
  const { attendance, loading, refreshing, error, refresh } = useMyAttendance();
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

  const handleCheckIn = async () => {
    const now = new Date();
    await SecureStore.setItemAsync(CHECKIN_KEY, now.toISOString());
    setCheckIn(now);
  };

  const handleCheckOut = async () => {
    if (!checkIn) return;
    const checkOut = new Date();
    const workedHours = Number(((checkOut - checkIn) / 3600000).toFixed(2));
    const overtimeHours = Number(Math.max(0, workedHours - STANDARD_WORKDAY_HOURS).toFixed(2));

    setSubmitting(true);
    try {
      await api.post(`/employees/${user.id}/attendance`, {
        date: checkIn.toISOString().slice(0, 10),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        workedHours,
        overtimeHours,
      });
      await SecureStore.deleteItemAsync(CHECKIN_KEY);
      setCheckIn(null);
      refresh();
    } catch (error) {
      Alert.alert("No se pudo registrar la asistencia", error.message || "Intentá de nuevo");
    } finally {
      setSubmitting(false);
    }
  };

  if (restoring || loading) return <LoadingState />;
  if (error && attendance.length === 0) return <ErrorState message={error} onRetry={refresh} />;

  const history = [...attendance]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return (
    <View style={styles.container}>
      <Card style={styles.statusCard}>
        {checkIn ? (
          <>
            <Text style={styles.statusLabel}>Entrada</Text>
            <Text style={styles.statusValue}>{formatTime(checkIn)}</Text>
          </>
        ) : (
          <Text style={styles.statusIdle}>Todavía no marcaste entrada hoy</Text>
        )}
        <CustomButton
          title={submitting ? "Guardando…" : checkIn ? "Marcar salida" : "Marcar entrada"}
          onPress={checkIn ? handleCheckOut : handleCheckIn}
          loading={submitting}
        />
      </Card>

      <Text style={styles.historyTitle}>Historial reciente</Text>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={history}
        keyExtractor={(item, index) => `${item.date}-${index}`}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
            <Text style={styles.historyDetail}>
              Entrada {formatTime(item.checkIn)} · Salida {formatTime(item.checkOut)}
            </Text>
            <Text style={styles.historyDetail}>
              {Number(item.workedHours || 0).toLocaleString("es-SV")} h trabajadas
              {item.overtimeHours ? ` · ${Number(item.overtimeHours).toLocaleString("es-SV")} h extra` : ""}
            </Text>
          </Card>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState message="Todavía no hay marcaciones registradas" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  statusCard: {
    paddingVertical: 24,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.slate500,
    textTransform: "uppercase",
    textAlign: "center",
  },
  statusValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  statusIdle: {
    fontSize: 14,
    color: colors.slate500,
    textAlign: "center",
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  historyDetail: {
    marginTop: 2,
    fontSize: 12,
    color: colors.slate500,
  },
});
