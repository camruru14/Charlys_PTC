import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import LoginScreen from "../screens/LoginScreen";
import PostLoginSplashScreen from "../screens/PostLoginSplashScreen";
import DrawerNavigator from "./DrawerNavigator";
import LoteFabricacionFormScreen from "../screens/LoteFabricacionFormScreen";
import LoteDiarioFormScreen from "../screens/LoteDiarioFormScreen";
import TransaccionFormScreen from "../screens/TransaccionFormScreen";
import VehiculoDetalleScreen from "../screens/VehiculoDetalleScreen";
import BodegaFormScreen from "../screens/BodegaFormScreen";
import EmpleadoFormScreen from "../screens/EmpleadoFormScreen";
import ProductoFormScreen from "../screens/ProductoFormScreen";
import RegistrarMarcacionFormScreen from "../screens/RegistrarMarcacionFormScreen";
import InventarioItemFormScreen from "../screens/InventarioItemFormScreen";
import PedidoDetalleScreen from "../screens/PedidoDetalleScreen";
import BatchHistoryScreen from "../screens/BatchHistoryScreen";
import LoteDetalleScreen from "../screens/LoteDetalleScreen";
import RutaDetalleScreen from "../screens/RutaDetalleScreen";
import EmpleadoDetalleScreen from "../screens/EmpleadoDetalleScreen";
import ConfigEmpresaScreen from "../screens/ConfigEmpresaScreen";
import ConfigBodegasScreen from "../screens/ConfigBodegasScreen";
import ConfigVehiculosScreen from "../screens/ConfigVehiculosScreen";
import ConfigLineasScreen from "../screens/ConfigLineasScreen";
import ConfigSubcategoriasScreen from "../screens/ConfigSubcategoriasScreen";
import ConfigPersonalScreen from "../screens/ConfigPersonalScreen";
import MiCuentaScreen from "../screens/MiCuentaScreen";
import LineaFormScreen from "../screens/LineaFormScreen";
import HistorialTransaccionesScreen from "../screens/HistorialTransaccionesScreen";
import DateRangeButton from "../components/ui/DateRangeButton";
import DetailHeader from "../components/ui/DetailHeader";
import { colors } from "../lib/theme";
import { EXTRA_META } from "./navItems";

const Stack = createNativeStackNavigator();

// Opciones comunes de las pantallas de detalle y formularios: encabezado
// propio (DetailHeader: "‹ Anterior", título, Pill y subtítulo opcionales)
// en vez del header nativo, y fondo canvas.
const detailHeader = {
  headerShown: true,
  header: (props) => <DetailHeader {...props} />,
  contentStyle: { backgroundColor: colors.canvas },
};

// Punto de entrada de la navegación: sin sesión, solo LoginScreen; recién
// logueado (justLoggedIn en AuthContext), solo PostLoginSplashScreen, que se
// muestra un momento y pasa sola al Drawer; con sesión ya asentada, el
// Drawer con las secciones, más las pantallas de detalle (push normal, con
// DetailHeader) y los formularios, registrados como un grupo modal (con
// BottomBar Cancelar/Guardar en la pantalla). App.js ya se
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
            options={{ ...detailHeader, title: "Pedido" }}
          />

          {/* Detalle de un lote de fabricación: recorrido, indicadores y las
              acciones del estado (iniciar, completar, enviar a bodega…). */}
          <Stack.Screen name="LoteDetalle" component={LoteDetalleScreen} options={{ ...detailHeader, title: "Lote" }} />

          {/* Seguimiento de una ruta de Logística: recogidas, salida y
              entregas parada por parada. */}
          <Stack.Screen name="RutaDetalle" component={RutaDetalleScreen} options={{ ...detailHeader, title: "Ruta" }} />

          {/* Ficha de un empleado: horas y asistencia del mes, y sus datos. */}
          {/* Secciones de Configuración (en la web, pestañas de la misma
              página): cada una es una pantalla con «‹ Configuración». */}
          <Stack.Screen name="ConfigEmpresa" component={ConfigEmpresaScreen} options={{ ...detailHeader, title: "Empresa" }} />
          <Stack.Screen name="ConfigBodegas" component={ConfigBodegasScreen} options={{ ...detailHeader, title: "Bodegas" }} />
          <Stack.Screen name="ConfigVehiculos" component={ConfigVehiculosScreen} options={{ ...detailHeader, title: "Vehículos" }} />
          {/* Un vehículo (crear o editar): foto, modelo, placa y uso actual. */}
          <Stack.Screen name="VehiculoDetalle" component={VehiculoDetalleScreen} options={{ ...detailHeader, title: "Vehículo" }} />
          <Stack.Screen name="ConfigLineas" component={ConfigLineasScreen} options={{ ...detailHeader, title: "Líneas de producción" }} />
          <Stack.Screen name="ConfigSubcategorias" component={ConfigSubcategoriasScreen} options={{ ...detailHeader, title: "Subcategorías" }} />
          <Stack.Screen name="ConfigPersonal" component={ConfigPersonalScreen} options={{ ...detailHeader, title: "Personal y permisos" }} />
          <Stack.Screen name="MiCuenta" component={MiCuentaScreen} options={{ ...detailHeader, title: "Mi cuenta" }} />

          <Stack.Screen
            name="EmpleadoDetalle"
            component={EmpleadoDetalleScreen}
            options={{ ...detailHeader, title: "Empleado" }}
          />

          {/* Historial de lotes / de transacciones (Fase 5): también
              push normal, drill-down desde el "Ver todo" del Dashboard (y,
              en una fase futura, desde Fabricación con editable:true). */}
          <Stack.Screen
            name="HistorialLotes"
            component={BatchHistoryScreen}
            options={{
              ...detailHeader,
              title: EXTRA_META.HistorialLotes.title,
              headerSubtitle: EXTRA_META.HistorialLotes.subtitle,
              headerRight: () => <DateRangeButton />,
            }}
          />
          <Stack.Screen
            name="HistorialTransacciones"
            component={HistorialTransaccionesScreen}
            options={{
              ...detailHeader,
              title: EXTRA_META.HistorialTransacciones.title,
              headerSubtitle: EXTRA_META.HistorialTransacciones.subtitle,
              headerRight: () => <DateRangeButton />,
            }}
          />

          <Stack.Group screenOptions={{ ...detailHeader, presentation: "modal" }}>
            <Stack.Screen name="LoteFabricacionForm" component={LoteFabricacionFormScreen} />
            <Stack.Screen name="LoteDiarioForm" component={LoteDiarioFormScreen} />
            <Stack.Screen name="TransaccionForm" component={TransaccionFormScreen} />
            <Stack.Screen name="BodegaForm" component={BodegaFormScreen} />
            <Stack.Screen name="LineaForm" component={LineaFormScreen} />
            <Stack.Screen name="EmpleadoForm" component={EmpleadoFormScreen} />
            <Stack.Screen name="ProductoForm" component={ProductoFormScreen} />
            <Stack.Screen name="RegistrarMarcacionForm" component={RegistrarMarcacionFormScreen} />
            <Stack.Screen name="InventarioItemForm" component={InventarioItemFormScreen} />
          </Stack.Group>
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
