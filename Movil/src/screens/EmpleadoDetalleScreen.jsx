import { useCallback, useLayoutEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEmployees } from "../hooks/useEmployees";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import AttendanceRow from "../components/employees/AttendanceRow";
import { employeeStatus, roleLine } from "../components/employees/EmployeeRow";
import BottomBar from "../components/ui/BottomBar";
import ErrorState from "../components/ui/ErrorState";
import IconButton from "../components/ui/IconButton";
import ListGroup, { ListRow } from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import StatTile from "../components/ui/StatTile";
import { colors, tones } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { formatDateYear, formatMoney, formatWeekdayDate } from "../lib/format";
import { formatDui } from "../lib/dui";
import {
  attendanceDays,
  defaultMonth,
  employeeMonthRows,
  fmtHours,
  fullName,
  monthLabel,
  monthTotals,
} from "../lib/attendance";
import { statusTone } from "../lib/statusTones";

// Ficha de un empleado (EmployeeDetail de Personal.jsx en la web): horas del
// mes, su asistencia día por día (con los días Ausente) y sus datos.
// «Registrar asistencia» abre el formulario con el empleado ya elegido.
// params: { id, month: "AAAA-MM" (el elegido en Empleados) }
export default function EmpleadoDetalleScreen({ navigation, route }) {
  const id = route.params?.id;
  const { employees, loading, refreshing, error, refresh } = useEmployees();
  const { schedule, refresh: refreshSchedule } = useWorkSchedule();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshSchedule();
    }, [refresh, refreshSchedule]),
  );

  const employee = employees.find((e) => String(e._id) === String(id)) || null;
  const month = route.params?.month || defaultMonth(employees);
  const days = useMemo(() => attendanceDays(employees, month), [employees, month]);
  const rows = useMemo(() => (employee ? employeeMonthRows(employee, days) : []), [employee, days]);
  const totals = monthTotals(rows, schedule);

  useLayoutEffect(() => {
    if (!employee) return;
    const status = employeeStatus(employee);
    navigation.setOptions({
      title: fullName(employee),
      headerBackTitle: "Personal",
      headerStatus: { label: status, tone: statusTone(status, "empleado") },
      headerSubtitle: [roleLine(employee), employee.dui ? `DUI ${formatDui(employee.dui)}` : null].filter(Boolean).join(" · "),
      // Editar al empleado es de Configuración > Personal y permisos en la
      // web; aquí se deja a mano desde la ficha.
      headerRight: () => (
        <IconButton
          icon="more"
          accessibilityLabel="Más acciones del empleado"
          onPress={() =>
            Alert.alert(fullName(employee), undefined, [
              { text: "Editar empleado", onPress: () => navigation.navigate("EmpleadoForm", { id: employee._id }) },
              { text: "Cancelar", style: "cancel" },
            ])
          }
        />
      ),
    });
  }, [navigation, employee]);

  if (!employee) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refresh} />;
    return <ErrorState message="Este empleado ya no existe." />;
  }

  const data = [
    employee.phone ? { label: "Teléfono", value: employee.phone } : null,
    employee.email ? { label: "Correo", value: employee.email } : null,
    employee.hourlyRate != null ? { label: "Valor por hora", value: formatMoney(employee.hourlyRate) } : null,
    employee.hireDate ? { label: "Fecha de ingreso", value: formatDateYear(employee.hireDate) } : null,
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.tiles}>
          <StatTile style={styles.tile} size="small" label="Horas del mes" value={fmtHours(totals.worked)} />
          <StatTile
            style={styles.tile}
            size="small"
            label="Horas extra"
            value={fmtHours(totals.overtime)}
            valueColor={tones.blue.text}
          />
        </View>

        <ListGroup>
          <View style={styles.groupHeader}>
            <Text style={type.overline}>Asistencia · {monthLabel(month)}</Text>
          </View>
          {rows.length ? (
            rows.map((r) => (
              <AttendanceRow key={r.key} dayLabel={formatWeekdayDate(r.date)} record={r.record} schedule={schedule} />
            ))
          ) : (
            <Text style={styles.empty}>Sin marcaciones en {monthLabel(month)}.</Text>
          )}
        </ListGroup>

        {data.length ? (
          <>
            <Text style={[type.cardTitle, styles.sectionTitle]}>Datos del empleado</Text>
            <ListGroup>
              {data.map((d) => (
                <ListRow key={d.label} title={d.label} value={d.value} />
              ))}
            </ListGroup>
          </>
        ) : null}
      </ScrollView>

      <BottomBar
        actions={[
          {
            title: "Registrar asistencia",
            icon: "clock",
            onPress: () => navigation.navigate("RegistrarMarcacionForm", { employeeId: employee._id }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 10 },
  tile: { flex: 1 },
  groupHeader: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 9 },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingHorizontal: 15, paddingVertical: 14 },
  sectionTitle: { marginTop: 8, marginBottom: 8 },
});
