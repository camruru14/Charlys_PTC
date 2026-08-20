import {
  DrawerContentScrollView,
  DrawerItem,
  createDrawerNavigator,
} from "@react-navigation/drawer";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import DateRangeButton from "../components/ui/DateRangeButton";
import { colors } from "../lib/theme";

import DashboardScreen from "../screens/DashboardScreen";
import FabricacionScreen from "../screens/FabricacionScreen";
import FinanzasScreen from "../screens/FinanzasScreen";
import PedidosScreen from "../screens/PedidosScreen";
import LogisticaScreen from "../screens/LogisticaScreen";
import InventarioScreen from "../screens/InventarioScreen";
import CatalogoScreen from "../screens/CatalogoScreen";
import EmpleadosScreen from "../screens/EmpleadosScreen";
import AsistenciaScreen from "../screens/AsistenciaScreen";
import ConfiguracionScreen from "../screens/ConfiguracionScreen";

const Drawer = createDrawerNavigator();

// Un ítem de Drawer por sección, en el mismo orden y con las mismas
// etiquetas que Web/private/frontend/src/lib/nav.jsx (NAV_ITEMS). El título
// de cada pantalla (mostrado en el header) usa el mismo `title` de nav.jsx.
const SECTIONS = [
  { name: "Dashboard", label: "Dashboard", title: "Dashboard", component: DashboardScreen, showDateRange: true },
  { name: "Fabricacion", label: "Fabricación", title: "Fabricación", component: FabricacionScreen, showDateRange: true },
  { name: "Finanzas", label: "Finanzas", title: "Finanzas", component: FinanzasScreen, showDateRange: true },
  { name: "Pedidos", label: "Pedidos", title: "Pedidos", component: PedidosScreen },
  {
    name: "Logistica",
    label: "Logística",
    title: "Logística — Gestión de Flotas",
    component: LogisticaScreen,
  },
  {
    name: "Inventario",
    label: "Inventario",
    title: "Inventario / Almacén",
    component: InventarioScreen,
  },
  {
    name: "Catalogo",
    label: "Catálogo",
    title: "Catálogo — Tienda pública",
    component: CatalogoScreen,
  },
  {
    name: "Empleados",
    label: "Empleados",
    title: "Empleados — RRHH",
    component: EmpleadosScreen,
  },
  // Exclusiva del celular: no existe en nav.jsx de la web (ver
  // AsistenciaScreen.jsx) porque ahí RRHH captura la asistencia a
  // posteriori, en vez de que cada empleado marque su propia entrada/salida.
  {
    name: "Asistencia",
    label: "Asistencia",
    title: "Marcar Asistencia",
    component: AsistenciaScreen,
  },
];

// BOTTOM_ITEMS de nav.jsx: Configuración va aparte, al fondo del Drawer.
const BOTTOM_SECTION = {
  name: "Configuracion",
  label: "Configuración",
  title: "Configuración",
  component: ConfiguracionScreen,
};

// Contenido custom del Drawer: réplica del Sidebar.jsx web — menú principal
// arriba, y abajo (separado por un borde) Configuración, Cerrar Sesión y el
// perfil del usuario autenticado.
function CustomDrawerContent(props) {
  const { user, logout } = useAuth();
  const displayName = user
    ? `${user.name || ""} ${user.lastName || ""}`.trim() || user.email
    : "";
  const displayRole = user?.position || "";

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>IC</Text>
        </View>
        <Text style={styles.headerTitle}>Industrias Charly</Text>
      </View>

      <View style={styles.section}>
        {props.state.routes
          .filter((route) => route.name !== BOTTOM_SECTION.name)
          .map((route, index) => {
            const section = SECTIONS.find((s) => s.name === route.name);
            if (!section) return null;
            const isFocused = props.state.index === index;
            return (
              <DrawerItem
                key={route.key}
                label={section.label}
                focused={isFocused}
                activeTintColor={colors.brand700}
                activeBackgroundColor={colors.brand50}
                inactiveTintColor={colors.slate700}
                labelStyle={styles.itemLabel}
                onPress={() => props.navigation.navigate(route.name)}
              />
            );
          })}
      </View>

      <View style={styles.bottomSection}>
        <DrawerItem
          label={BOTTOM_SECTION.label}
          activeTintColor={colors.brand700}
          activeBackgroundColor={colors.brand50}
          inactiveTintColor={colors.slate700}
          labelStyle={styles.itemLabel}
          focused={props.state.routes[props.state.index]?.name === BOTTOM_SECTION.name}
          onPress={() => props.navigation.navigate(BOTTOM_SECTION.name)}
        />

        <DrawerItem
          label="Cerrar sesión"
          labelStyle={[styles.itemLabel, styles.logoutLabel]}
          onPress={logout}
        />

        {user ? (
          <View style={styles.profile}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              {displayRole ? (
                <Text style={styles.profileRole} numberOfLines={1}>
                  {displayRole}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: colors.brand700,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {SECTIONS.map((section) => (
        <Drawer.Screen
          key={section.name}
          name={section.name}
          component={section.component}
          options={{
            title: section.title,
            drawerLabel: section.label,
            headerRight: section.showDateRange ? () => <DateRangeButton /> : undefined,
          }}
        />
      ))}
      <Drawer.Screen
        name={BOTTOM_SECTION.name}
        component={BOTTOM_SECTION.component}
        options={{ title: BOTTOM_SECTION.title, drawerLabel: BOTTOM_SECTION.label }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  logoBadge: {
    height: 36,
    width: 36,
    borderRadius: 10,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brand700,
  },
  section: {
    paddingHorizontal: 4,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  bottomSection: {
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  logoutLabel: {
    color: colors.danger,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  profileAvatar: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  profileInfo: {
    flexShrink: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  profileRole: {
    fontSize: 12,
    color: colors.slate500,
  },
});
