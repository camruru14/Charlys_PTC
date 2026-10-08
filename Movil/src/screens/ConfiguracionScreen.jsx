import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import Constants from "expo-constants";
import { useCompanySettings } from "../hooks/useCompanySettings";
import { useEmployees } from "../hooks/useEmployees";
import { useProductionLines } from "../hooks/useProductionLines";
import { useVehicles } from "../hooks/useVehicles";
import { useWarehouses } from "../hooks/useWarehouses";
import SettingsRow from "../components/settings/SettingsRow";
import Card from "../components/ui/Card";
import ListGroup from "../components/ui/ListGroup";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { formatElapsed, formatNumber, formatRelativeDay } from "../lib/format";
import { useBottomPad } from "../hooks/useBottomPad";

// Versión de app.json (expo.version).
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

// «hace 5 min» / «hace 3 h» dentro del mismo día; después, «ayer» o «el 19 sep»
// (fmtSince de Configuracion.jsx en la web).
function since(value) {
  const time = new Date(value).getTime();
  if (Date.now() - time < 86400000) return formatElapsed(value);
  const day = formatRelativeDay(value);
  return day === "ayer" ? day : `el ${day}`;
}

// Configuración (Web/private/frontend/src/pages/Configuracion.jsx): en el
// celular, las secciones del menú de la web son una lista; cada una es su
// propia pantalla del stack.
export default function ConfiguracionScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const { company, refresh: refreshCompany } = useCompanySettings();
  const { warehouses, loading: warehousesLoading, refreshing, refresh: refreshWarehouses } = useWarehouses();
  const { vehicles, loading: vehiclesLoading, refresh: refreshVehicles } = useVehicles();
  const { lines, loading: linesLoading, refresh: refreshLines } = useProductionLines();
  const { employees, loading: employeesLoading, refresh: refreshEmployees } = useEmployees();
  // El contador solo aparece cuando ya cargó (mientras tanto no se muestra «0»).
  const countOf = (list, loading) => (loading && !list.length ? null : list.length);

  const reload = useCallback(() => {
    refreshCompany();
    refreshWarehouses();
    refreshVehicles();
    refreshLines();
    refreshEmployees();
  }, [refreshCompany, refreshWarehouses, refreshVehicles, refreshLines, refreshEmployees]);

  useFocusEffect(reload);

  const sections = [
    { screen: "ConfigEmpresa", icon: "building", title: "Empresa", description: "Datos, logo y horario laboral" },
    { screen: "ConfigBodegas", icon: "box", title: "Bodegas", description: "Destinos del inventario", count: countOf(warehouses, warehousesLoading) },
    { screen: "ConfigVehiculos", icon: "truck", title: "Vehículos", description: "Flota para armar rutas", count: countOf(vehicles, vehiclesLoading) },
    { screen: "ConfigLineas", icon: "factory", title: "Líneas de producción", description: "Opciones al crear lotes", count: countOf(lines, linesLoading) },
    { screen: "ConfigPersonal", icon: "users", title: "Personal y permisos", description: "Alta y edición de empleados", count: countOf(employees, employeesLoading) },
    { screen: "MiCuenta", icon: "user", title: "Mi cuenta", description: "Tu correo, contraseña y datos" },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, bottomPad]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
    >
      <ListGroup>
        {sections.map((s) => (
          <SettingsRow
            key={s.screen}
            icon={s.icon}
            title={s.title}
            description={s.description}
            count={s.count != null ? formatNumber(s.count) : null}
            onPress={() => navigation.navigate(s.screen)}
          />
        ))}
      </ListGroup>

      <Card>
        <Text style={styles.company} numberOfLines={1}>
          {company.name || "Industrias Charly"}
        </Text>
        <Text style={styles.version}>
          App móvil v{APP_VERSION}
          {company.updatedAt ? ` · cambios guardados ${since(company.updatedAt)}` : ""}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  company: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  version: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
