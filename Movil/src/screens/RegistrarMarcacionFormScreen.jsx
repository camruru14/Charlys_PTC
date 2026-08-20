import { useMemo, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useEmployees } from "../hooks/useEmployees";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import SelectField from "../components/ui/SelectField";
import DateField from "../components/ui/DateField";
import { colors } from "../lib/theme";
import { todayInput } from "../lib/format";
import { api } from "../lib/api";

// Jornada de referencia para calcular horas extra, misma fórmula que ya usa
// AsistenciaScreen.jsx y pages/Empleados.jsx en el panel web.
const STANDARD_WORKDAY_HOURS = 8;

// Registro de asistencia A POSTERIORI por RRHH: se elige empleado + fecha +
// hora de entrada/salida ya conocidas y se manda todo en un solo POST — a
// diferencia de AsistenciaScreen.jsx, que hace el check-in y luego el
// check-out en tiempo real (esa pantalla no se toca).
export default function RegistrarMarcacionFormScreen({ navigation }) {
  const { employees, refresh: refreshEmployees } = useEmployees();
  const [employeeId, setEmployeeId] = useState(null);
  const [date, setDate] = useState(todayInput());
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => employees.map((e) => ({ label: `${e.name || ""} ${e.lastName || ""}`.trim(), value: e._id })),
    [employees],
  );

  const buildDateTime = (dateValue, timeValue) => {
    const [y, m, d] = dateValue.split("-").map(Number);
    const [h, min] = timeValue.split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0);
  };

  const handleSave = async () => {
    if (!employeeId) {
      Alert.alert("Falta información", "Elegí un empleado");
      return;
    }
    if (!date) {
      Alert.alert("Falta información", "Elegí la fecha");
      return;
    }
    if (!checkInTime || !checkOutTime) {
      Alert.alert("Falta información", "Elegí la hora de entrada y de salida");
      return;
    }
    const checkIn = buildDateTime(date, checkInTime);
    const checkOut = buildDateTime(date, checkOutTime);
    if (checkOut <= checkIn) {
      Alert.alert("Hora inválida", "La hora de salida debe ser posterior a la de entrada");
      return;
    }
    const workedHours = Number(((checkOut - checkIn) / 3600000).toFixed(2));
    const overtimeHours = Number(Math.max(0, workedHours - STANDARD_WORKDAY_HOURS).toFixed(2));

    setSaving(true);
    try {
      await api.post(`/employees/${employeeId}/attendance`, {
        date,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        workedHours,
        overtimeHours,
      });
      refreshEmployees();
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo registrar", error.message || "Intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  useSaveCancelHeader({
    navigation,
    title: "Registrar marcación",
    saving,
    onSave: handleSave,
  });

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <SelectField label="Empleado" value={employeeId} options={options} onChange={setEmployeeId} required placeholder="Elegir empleado" />
      <DateField label="Fecha" value={date} onChange={setDate} maximumDate={new Date()} required />
      <DateField label="Hora de entrada" value={checkInTime} onChange={setCheckInTime} mode="time" required />
      <DateField label="Hora de salida" value={checkOutTime} onChange={setCheckOutTime} mode="time" required />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
});
