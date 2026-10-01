import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useEmployees } from "../hooks/useEmployees";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import BottomBar from "../components/ui/BottomBar";
import DateField from "../components/ui/DateField";
import SelectField from "../components/ui/SelectField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { todayInput } from "../lib/format";
import { api } from "../lib/api";
import { fullName, hoursPayload } from "../lib/attendance";

// "AAAA-MM-DD" + "HH:mm" -> Date local de ese día y hora.
function buildDateTime(dateValue, timeValue) {
  const [y, m, d] = dateValue.split("-").map(Number);
  const [h, min] = timeValue.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0);
}

// «Registrar marcación» a posteriori (modal de Empleados.jsx en la web): se
// elige empleado, fecha, entrada y salida, y las horas trabajadas y extra se
// calculan solas con el horario laboral. params: { employeeId } (opcional,
// desde la ficha del empleado).
export default function RegistrarMarcacionFormScreen({ navigation, route }) {
  const toast = useToast();
  const { employees } = useEmployees();
  const { schedule } = useWorkSchedule();
  const [employeeId, setEmployeeId] = useState(route.params?.employeeId || null);
  const [date, setDate] = useState(todayInput());
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () =>
      [...employees]
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "es"))
        .map((e) => ({ label: fullName(e), value: e._id })),
    [employees],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Registrar marcación" });
  }, [navigation]);

  const handleSave = async () => {
    if (!employeeId) return Alert.alert("Falta información", "Selecciona un empleado");
    if (!date) return Alert.alert("Falta información", "Selecciona la fecha");
    if (!checkInTime || !checkOutTime) return Alert.alert("Falta información", "Completa hora de entrada y salida");

    const checkIn = buildDateTime(date, checkInTime);
    const checkOut = buildDateTime(date, checkOutTime);
    if (checkOut <= checkIn) return Alert.alert("Hora inválida", "La salida debe ser después de la entrada");

    setSaving(true);
    try {
      await api.post(`/employees/${employeeId}/attendance`, {
        date,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        ...hoursPayload(checkIn, checkOut, schedule),
      });
      toast.show("Asistencia registrada");
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo registrar", error.message || "Intenta de nuevo");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        <SelectField
          label="Empleado"
          value={employeeId}
          options={options}
          onChange={setEmployeeId}
          required
          placeholder="Selecciona un empleado"
        />
        <DateField label="Fecha" value={date} onChange={setDate} maximumDate={new Date()} required />
        <DateField label="Hora de entrada" value={checkInTime} onChange={setCheckInTime} mode="time" required />
        <DateField label="Hora de salida" value={checkOutTime} onChange={setCheckOutTime} mode="time" required />
        <Text style={styles.note}>
          Las horas trabajadas y las horas extra se calculan solas a partir de la entrada y la salida (jornada de{" "}
          {schedule.workdayHours} horas).
        </Text>
      </KeyboardScreen>

      <BottomBar
        actions={[
          { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
          { title: "Guardar", loading: saving, onPress: handleSave },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
});
