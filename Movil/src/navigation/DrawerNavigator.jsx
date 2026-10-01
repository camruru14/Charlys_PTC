import { createDrawerNavigator } from "@react-navigation/drawer";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../hooks/useAuth";
import Avatar from "../components/ui/Avatar";
import DateRangeButton from "../components/ui/DateRangeButton";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import ScreenHeader from "../components/ui/ScreenHeader";
import { colors } from "../lib/theme";
import { fonts, type } from "../lib/typography";
import { NAV_ITEMS, NAV_SECTIONS, todayLabel } from "./navItems";

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

// Pantallas del drawer, en el orden del menú (ver navItems.js). Las que
// filtran por el rango de fechas global llevan el DateRangeButton como
// acción del encabezado.
const SCREENS = [
  { name: "Dashboard", component: DashboardScreen, showDateRange: true },
  { name: "Fabricacion", component: FabricacionScreen, showDateRange: true },
  { name: "Inventario", component: InventarioScreen },
  { name: "Pedidos", component: PedidosScreen },
  { name: "Logistica", component: LogisticaScreen },
  { name: "Finanzas", component: FinanzasScreen, showDateRange: true },
  { name: "Catalogo", component: CatalogoScreen },
  { name: "Empleados", component: EmpleadosScreen },
  { name: "Asistencia", component: AsistenciaScreen },
  { name: "Configuracion", component: ConfiguracionScreen },
];

function DrawerLink({ label, icon, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, active ? styles.itemActive : pressed && styles.itemPressed]}
    >
      {active ? <View style={styles.activeBar} /> : null}
      <Icon name={icon} size={20} color={active ? colors.primarySoftText : colors.faint} />
      <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Contenido del menú lateral: copia del Rail blanco de la web
// (Web/private/frontend/src/components/Rail.jsx) — logo arriba, secciones
// con título y, al fondo, el usuario con el botón de cerrar sesión.
function CustomDrawerContent({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const displayName = user ? `${user.name || ""} ${user.lastName || ""}`.trim() || user.email : "Usuario";
  const displayRole = user?.position || user?.department || "";
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.drawer, { paddingTop: insets.top + 12 }]}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>IC</Text>
        </View>
        <Text style={styles.brandName}>Ind. Charly</Text>
        <Pressable
          onPress={() => navigation.closeDrawer()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
          style={styles.close}
        >
          <Icon name="close" size={20} color={colors.faint} />
        </Pressable>
      </View>

      <ScrollView style={styles.sections} contentContainerStyle={styles.sectionsContent}>
        {NAV_SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={[type.overline, styles.sectionTitle]}>{section.title}</Text>
            {section.routes.map((name) => (
              <DrawerLink
                key={name}
                label={NAV_ITEMS[name].label}
                icon={NAV_ITEMS[name].icon}
                active={activeRoute === name}
                onPress={() => navigation.navigate(name)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.profile, { paddingBottom: insets.bottom + 14 }]}>
        <Avatar name={displayName} tone="blue" size={38} />
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
        <IconButton icon="logout" onPress={logout} accessibilityLabel="Cerrar sesión" />
      </View>
    </View>
  );
}

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: (props) => <ScreenHeader {...props} />,
        drawerStyle: styles.drawerContainer,
        overlayColor: colors.drawerOverlay,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {SCREENS.map((screen) => {
        const meta = NAV_ITEMS[screen.name];
        return (
          <Drawer.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
            // Función para que el subtítulo de Mi asistencia (la fecha de hoy)
            // se recalcule cada vez que el navegador se vuelve a renderizar.
            options={() => ({
              title: meta.label,
              drawerLabel: meta.label,
              subtitle: screen.name === "Asistencia" ? todayLabel() : meta.subtitle,
              headerRight: screen.showDateRange ? () => <DateRangeButton /> : undefined,
            })}
          />
        );
      })}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    width: 300,
    backgroundColor: colors.surface,
  },
  drawer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    color: colors.white,
  },
  brandName: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 16,
    color: colors.ink,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sections: {
    flex: 1,
  },
  sectionsContent: {
    paddingBottom: 12,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  item: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  itemPressed: {
    backgroundColor: colors.surface2,
  },
  itemActive: {
    backgroundColor: colors.selectBg,
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.primary,
  },
  itemText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink2,
  },
  itemTextActive: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.navDivider,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  profileRole: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
});
