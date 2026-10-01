import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEmployees } from "../hooks/useEmployees";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import EmployeeRow from "../components/employees/EmployeeRow";
import TeamAttendanceRow from "../components/employees/TeamAttendanceRow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import MonthChip from "../components/ui/MonthChip";
import SearchField from "../components/ui/SearchField";
import Segmented from "../components/ui/Segmented";
import { colors, tones } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatDayLong, formatNumber } from "../lib/format";
import { attendanceDays, attendanceMonths, defaultMonth, fullName, monthLabel } from "../lib/attendance";

const TABS = [
  { value: "personal", label: "Personal" },
  { value: "asistencia", label: "Asistencia" },
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function matches(emp, query, area) {
  if (area !== "all" && emp.department !== area) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fullName(emp), emp.position, emp.department, emp.email].some((v) => (v || "").toLowerCase().includes(q));
}

// Empleados (Web/private/frontend/src/pages/Empleados.jsx): Personal (lista
// con búsqueda y áreas; tocar abre la ficha, EmpleadoDetalleScreen) y
// Asistencia (marcaciones del mes por día, sobre la franja de 06:00 a 18:00).
// Agregar y editar empleados se hace desde Configuración > Personal y
// permisos, como en la web; aquí «+» registra una marcación.
export default function EmpleadosScreen({ navigation }) {
  const { employees, loading, refreshing, error, refresh } = useEmployees();
  const { schedule, refresh: refreshSchedule } = useWorkSchedule();

  const [tab, setTab] = useState("personal");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [teamQuery, setTeamQuery] = useState("");
  const [chosenMonth, setChosenMonth] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshSchedule();
    }, [refresh, refreshSchedule]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        tab === "asistencia"
          ? () => (
              <IconButton
                icon="plus"
                variant="primary"
                onPress={() => navigation.navigate("RegistrarMarcacionForm")}
                accessibilityLabel="Registrar marcación"
              />
            )
          : undefined,
    });
  }, [navigation, tab]);

  const months = useMemo(() => attendanceMonths(employees), [employees]);
  const month = chosenMonth || defaultMonth(employees);
  const days = useMemo(() => attendanceDays(employees, month), [employees, month]);

  // Personal
  const areaOptions = useMemo(() => {
    const counts = new Map();
    employees.forEach((e) => e.department && counts.set(e.department, (counts.get(e.department) || 0) + 1));
    return [
      { value: "all", label: "Todos", count: employees.length },
      ...[...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "es"))
        .map(([name, count]) => ({ value: name, label: name, count })),
    ];
  }, [employees]);

  const visible = useMemo(
    () => employees.filter((e) => matches(e, query, area)).sort((a, b) => fullName(a).localeCompare(fullName(b), "es")),
    [employees, query, area],
  );

  // Asistencia: días del mes con sus marcaciones y ausentes, filtrados por nombre.
  const groups = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    const match = (emp) => !q || fullName(emp).toLowerCase().includes(q);
    return days
      .map((day) => ({ day, entries: day.entries.filter((e) => match(e.employee)), absent: day.absent.filter(match) }))
      .filter((g) => g.entries.length || g.absent.length);
  }, [days, teamQuery]);

  const monthOptions = (months.includes(month) ? months : [month, ...months]).map((m) => ({
    value: m,
    label: capitalize(monthLabel(m)),
  }));

  const reload = () => Promise.all([refresh(), refreshSchedule()]);
  const openEmployee = (emp) => navigation.navigate("EmpleadoDetalle", { id: emp._id, month });

  const header = (
    <View style={styles.tabs}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  let body;
  if (loading && !employees.length) body = <LoadingState />;
  else if (error && !employees.length) body = <ErrorState message={error} onRetry={refresh} />;
  else if (tab === "personal")
    body = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar empleado" style={styles.search} />
        <FilterChips
          options={areaOptions}
          value={area}
          onChange={setArea}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        />
        {visible.length ? (
          <ListGroup>
            {visible.map((emp) => (
              <EmployeeRow key={emp._id} employee={emp} onPress={() => openEmployee(emp)} />
            ))}
          </ListGroup>
        ) : (
          <EmptyState icon="users" message={employees.length ? "Ningún empleado coincide." : "No hay empleados."} />
        )}
      </ScrollView>
    );
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        data={groups}
        keyExtractor={(g) => g.day.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={styles.teamHeader}>
            <View style={styles.filters}>
              <SearchField
                value={teamQuery}
                onChangeText={setTeamQuery}
                placeholder="Buscar empleado"
                style={styles.flex}
              />
              <MonthChip value={month} options={monthOptions} onChange={setChosenMonth} />
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: tones.blue.dot }]} />
                <Text style={styles.legendText}>Jornada</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: tones.amber.dot }]} />
                <Text style={styles.legendText}>Hora extra</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: { day, entries, absent } }) => (
          <ListGroup>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{formatDayLong(day.date)}</Text>
              <Text style={styles.dayCount}>
                {formatNumber(day.entries.length)} {day.entries.length === 1 ? "marcación" : "marcaciones"}
              </Text>
            </View>
            {entries.map((e) => (
              <TeamAttendanceRow key={e.key} employee={e.employee} record={e.record} schedule={schedule} />
            ))}
            {absent.map((emp) => (
              <TeamAttendanceRow key={`${day.key}-${emp._id}`} employee={emp} record={null} schedule={schedule} />
            ))}
          </ListGroup>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            message={days.length ? "Ningún empleado coincide." : `Sin marcaciones en ${monthLabel(month)}.`}
          />
        }
      />
    );

  return (
    <View style={styles.screen}>
      {header}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  search: { marginBottom: 12 },
  chipsScroll: { marginHorizontal: -20, marginBottom: 12 },
  chips: { paddingHorizontal: 20 },
  teamHeader: { gap: 10, marginBottom: 10 },
  filters: { flexDirection: "row", gap: 10 },
  legend: { flexDirection: "row", justifyContent: "flex-end", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink2 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: colors.surface2,
  },
  dayTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  dayCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
