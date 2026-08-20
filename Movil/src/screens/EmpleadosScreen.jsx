import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { useEmployees } from "../hooks/useEmployees";
import { useAllAttendance } from "../hooks/useAllAttendance";
import EmployeeCard from "../components/employees/EmployeeCard";
import AttendanceRow from "../components/employees/AttendanceRow";
import KpiTile from "../components/dashboard/KpiTile";
import SegmentedField from "../components/ui/SegmentedField";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";

const TABS = ["Personal", "Asistencia"];

// KPIs, tabs "Personal"/"Asistencia" y FAB con destino según el tab activo
// — mismo criterio que Web/private/frontend/src/pages/Empleados.jsx. El tab
// Asistencia es la vista de RRHH (TODOS los empleados); AsistenciaScreen.jsx
// (donde el propio empleado marca su entrada/salida) no se toca.
export default function EmpleadosScreen({ navigation }) {
  const [tab, setTab] = useState("Personal");
  const { employees, loading, refreshing, error, refresh } = useEmployees();
  const {
    records: attendance,
    loading: attendanceLoading,
    error: attendanceError,
    refreshing: attendanceRefreshing,
    refresh: refreshAttendance,
  } = useAllAttendance();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const kpis = useMemo(
    () => ({
      total: employees.length,
      activos: employees.filter((e) => e.isActive !== false).length,
      operarios: employees.filter((e) => e.department === "Fabricación").length,
      motoristas: employees.filter((e) => e.department === "Logística").length,
    }),
    [employees],
  );

  if (loading) return <LoadingState />;
  if (error && employees.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.kpiRow}>
        <KpiTile label="Empleados" value={kpis.total} />
        <KpiTile label="Activos" value={kpis.activos} />
        <KpiTile label="Operarios" value={kpis.operarios} />
        <KpiTile label="Motoristas" value={kpis.motoristas} />
      </View>

      <View style={styles.tabs}>
        <SegmentedField label="" value={tab} options={TABS} onChange={setTab} />
      </View>

      {tab === "Personal" ? (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={employees}
          keyExtractor={(item, index) => item._id || item.email || String(index)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("EmpleadoForm", { id: item._id })}
            >
              <EmployeeCard employee={item} />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<EmptyState message="No hay empleados todavía" />}
        />
      ) : attendanceLoading ? (
        <LoadingState />
      ) : attendanceError && attendance.length === 0 ? (
        <ErrorState message={attendanceError} onRetry={refreshAttendance} />
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={attendance}
          keyExtractor={(item, index) => `${item.employeeId}-${item.date}-${index}`}
          renderItem={({ item }) => <AttendanceRow record={item} />}
          refreshControl={<RefreshControl refreshing={attendanceRefreshing} onRefresh={refreshAttendance} />}
          ListEmptyComponent={<EmptyState message="No hay marcaciones registradas todavía" />}
        />
      )}

      <FloatingAddButton
        onPress={() =>
          tab === "Personal"
            ? navigation.navigate("EmpleadoForm")
            : navigation.navigate("RegistrarMarcacionForm")
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabs: { paddingHorizontal: 16, paddingTop: 12 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 96, flexGrow: 1 },
});
