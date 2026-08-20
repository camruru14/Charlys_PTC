import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import LoginScreen from "../screens/LoginScreen";
import PostLoginSplashScreen from "../screens/PostLoginSplashScreen";
import DrawerNavigator from "./DrawerNavigator";
import LoteFabricacionFormScreen from "../screens/LoteFabricacionFormScreen";
import LoteDiarioFormScreen from "../screens/LoteDiarioFormScreen";
import TransaccionFormScreen from "../screens/TransaccionFormScreen";
import VehiculoFormScreen from "../screens/VehiculoFormScreen";
import BodegaFormScreen from "../screens/BodegaFormScreen";
import EmpleadoFormScreen from "../screens/EmpleadoFormScreen";
import ProductoFormScreen from "../screens/ProductoFormScreen";
import RegistrarMarcacionFormScreen from "../screens/RegistrarMarcacionFormScreen";
import InventarioItemFormScreen from "../screens/InventarioItemFormScreen";
import PedidoFormScreen from "../screens/PedidoFormScreen";
import PedidoDetalleScreen from "../screens/PedidoDetalleScreen";
import BatchHistoryScreen from "../screens/BatchHistoryScreen";
import HistorialTransaccionesScreen from "../screens/HistorialTransaccionesScreen";
import DateRangeButton from "../components/ui/DateRangeButton";
import { colors } from "../lib/theme";

const Stack = createNativeStackNavigator();

// Punto de entrada de la navegación: sin sesión, solo LoginScreen; recién
// logueado (justLoggedIn en AuthContext), solo PostLoginSplashScreen, que se
// muestra un momento y pasa sola al Drawer; con sesión ya asentada, el
// Drawer con las 10 secciones, más las 7 pantallas de formulario de la Fase
// 3 (crear/editar en Fabricación, Finanzas, Logística, Empleados y Catálogo)
// registradas como un grupo modal — cada una trae su propio header
// (Cancelar/Guardar, ver useSaveCancelHeader) en vez del header del Drawer —
// y el detalle de un pedido (Fase 4), un push normal aparte. App.js ya se
// encarga de mostrar un indicador de carga mientras AuthContext resuelve si
// hay sesión guardada, así que acá `isAuthenticated` ya es un valor
// definitivo. Al restaurar una sesión guardada (reabrir la app) no pasa por
// justLoggedIn, así que el splash post-login solo aparece tras un login real.
export default function RootNavigator() {
  const { isAuthenticated, justLoggedIn } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && justLoggedIn ? (
        <Stack.Screen name="PostLoginSplash" component={PostLoginSplashScreen} />
      ) : isAuthenticated ? (
        <>
          <Stack.Screen name="App" component={DrawerNavigator} />

          {/* Detalle de un pedido (Fase 4): push normal (desliza desde la
              derecha), no modal — es una pantalla de "drill-down" con sus
              propias acciones en el cuerpo, no un formulario con
              Guardar/Cancelar en el header. */}
          <Stack.Screen
            name="PedidoDetalle"
            component={PedidoDetalleScreen}
            options={{
              headerShown: true,
              headerTintColor: colors.brand700,
              headerTitleStyle: { fontWeight: "700" },
              title: "Pedido",
            }}
          />

          {/* Historial de lotes / de transacciones (Fase 5): también
              push normal, drill-down desde el "Ver todo" del Dashboard (y,
              en una fase futura, desde Fabricación con editable:true). */}
          <Stack.Screen
            name="HistorialLotes"
            component={BatchHistoryScreen}
            options={{
              headerShown: true,
              headerTintColor: colors.brand700,
              headerTitleStyle: { fontWeight: "700" },
              title: "Historial de lotes",
              headerRight: () => <DateRangeButton />,
            }}
          />
          <Stack.Screen
            name="HistorialTransacciones"
            component={HistorialTransaccionesScreen}
            options={{
              headerShown: true,
              headerTintColor: colors.brand700,
              headerTitleStyle: { fontWeight: "700" },
              title: "Historial de transacciones",
              headerRight: () => <DateRangeButton />,
            }}
          />

          <Stack.Group
            screenOptions={{
              presentation: "modal",
              headerShown: true,
              headerTintColor: colors.brand700,
              headerTitleStyle: { fontWeight: "700" },
            }}
          >
            <Stack.Screen name="LoteFabricacionForm" component={LoteFabricacionFormScreen} />
            <Stack.Screen name="LoteDiarioForm" component={LoteDiarioFormScreen} />
            <Stack.Screen name="TransaccionForm" component={TransaccionFormScreen} />
            <Stack.Screen name="VehiculoForm" component={VehiculoFormScreen} />
            <Stack.Screen name="BodegaForm" component={BodegaFormScreen} />
            <Stack.Screen name="EmpleadoForm" component={EmpleadoFormScreen} />
            <Stack.Screen name="ProductoForm" component={ProductoFormScreen} />
            <Stack.Screen name="RegistrarMarcacionForm" component={RegistrarMarcacionFormScreen} />
            <Stack.Screen name="InventarioItemForm" component={InventarioItemFormScreen} />
            <Stack.Screen name="PedidoForm" component={PedidoFormScreen} />
          </Stack.Group>
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
