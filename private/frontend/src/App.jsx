import { Navigate, Route, Routes } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HistorialLotes from "./pages/HistorialLotes";
import Logistica from "./pages/Logistica";
import Fabricacion from "./pages/Fabricacion";
import Pedidos from "./pages/Pedidos";
import Inventario from "./pages/Inventario";
import Empleados from "./pages/Empleados";
import Finanzas from "./pages/Finanzas";
import HistorialTransacciones from "./pages/HistorialTransacciones";
import Configuracion from "./pages/Configuracion";

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
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/historial-transacciones" element={<HistorialTransacciones />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
