import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HistorialLotes from "./pages/HistorialLotes";
import HistorialLotesFabricacion from "./pages/HistorialLotesFabricacion";
import Logistica from "./pages/Logistica";
import Fabricacion from "./pages/Fabricacion";
import Pedidos from "./pages/Pedidos";
import Inventario from "./pages/Inventario";
import Catalogo from "./pages/Catalogo";
import Empleados from "./pages/Empleados";
import Finanzas from "./pages/Finanzas";
import HistorialTransacciones from "./pages/HistorialTransacciones";
import Configuracion from "./pages/Configuracion";
import NotFound from "./pages/NotFound";

// Página de muestra del sistema visual: solo existe en desarrollo (en el
// build de producción esta rama se elimina y DevUI no se incluye).
const DevUI = import.meta.env.DEV ? lazy(() => import("./pages/DevUI")) : null;

function App() {
  return (
    <Routes>
      {/* Pública */}
      <Route path="/login" element={<Login />} />

      {/* Protegidas: requieren sesión y viven dentro del Layout */}
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/historial-lotes" element={<HistorialLotes />} />
          <Route path="/fabricacion" element={<Fabricacion />} />
          <Route path="/fabricacion/historial" element={<HistorialLotesFabricacion />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/historial-transacciones" element={<HistorialTransacciones />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/configuracion" element={<Configuracion />} />
          {DevUI ? (
            <Route
              path="/dev/ui"
              element={
                <Suspense fallback={null}>
                  <DevUI />
                </Suspense>
              }
            />
          ) : null}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
