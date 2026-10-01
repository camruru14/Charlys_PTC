import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEmployees } from "../hooks/useEmployees";
import PermissionChip from "../components/employees/PermissionChip";
import { roleLine } from "../components/employees/EmployeeRow";
import Avatar, { personTone } from "../components/ui/Avatar";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import ListGroup from "../components/ui/ListGroup";
import LoadingState from "../components/ui/LoadingState";
import SearchField from "../components/ui/SearchField";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { fullName } from "../lib/attendance";
import { useBottomPad } from "../hooks/useBottomPad";

const STATUS_FILTERS = {
  all: () => true,
  active: (e) => e.isActive !== false,
  inactive: (e) => e.isActive === false,
};

function PersonRow({ employee, onPress }) {
  const inactive = employee.isActive === false;
  const role = roleLine(employee);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, inactive && styles.rowInactive, pressed && styles.pressed]}
    >
      <Avatar name={fullName(employee)} tone={inactive ? "gray" : personTone(employee)} size={36} />
      <View style={styles.texts}>
        <Text style={[styles.name, inactive && styles.muted]} numberOfLines={1}>
          {fullName(employee) || "—"}
        </Text>
        {role ? (
          <Text style={styles.role} numberOfLines={1}>
            {role}
          </Text>
        ) : null}
        <PermissionChip employee={employee} short style={styles.chip} />
      </View>
      <Icon name="chevronRight" size={18} color={colors.chevron} />
    </Pressable>
  );
}

// Configuración > Personal y permisos (PersonalPermisos.jsx de la web):
// registro completo de empleados, activos e inactivos. Cada fila muestra a
// qué paneles tendría acceso según su área y puesto (informativo, ver
// lib/permissions.js). «+» agrega y tocar una fila edita (EmpleadoFormScreen).
export default function ConfigPersonalScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const { employees, loading, refreshing, error, refresh } = useEmployees();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Personal y permisos",
      headerSubtitle: "Los permisos salen del área y el puesto",
      headerRight: () => (
        <IconButton
          icon="plus"
          variant="primary"
          onPress={() => navigation.navigate("EmpleadoForm")}
          accessibilityLabel="Agregar empleado"
        />
      ),
    });
  }, [navigation]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter(STATUS_FILTERS[status])
      .filter((e) => !q || [fullName(e), e.position, e.department, e.email, e.dui].some((v) => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false) || fullName(a).localeCompare(fullName(b), "es"));
  }, [employees, query, status]);

  const activeCount = employees.filter(STATUS_FILTERS.active).length;

  if (loading && !employees.length) return <LoadingState />;
  if (error && !employees.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <SearchField value={query} onChangeText={setQuery} placeholder="Nombre, puesto, área, DUI…" style={styles.search} />
      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Todos", count: employees.length },
          { value: "active", label: "Activos", count: activeCount },
          { value: "inactive", label: "Inactivos", count: employees.length - activeCount },
        ]}
        style={styles.chips}
      />
      {visible.length ? (
        <ListGroup>
          {visible.map((e) => (
            <PersonRow key={e._id} employee={e} onPress={() => navigation.navigate("EmpleadoForm", { id: e._id })} />
          ))}
        </ListGroup>
      ) : (
        <EmptyState
          icon="users"
          message={employees.length ? "Ningún empleado coincide." : "No hay empleados registrados."}
        />
      )}
      <Text style={styles.note}>Los permisos son informativos: todavía no restringen el acceso.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  search: { marginBottom: 12 },
  chips: { marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 11 },
  rowInactive: { backgroundColor: colors.surface2 },
  pressed: { backgroundColor: colors.surface2 },
  texts: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  muted: { color: colors.muted },
  role: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  chip: { marginTop: 5 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
