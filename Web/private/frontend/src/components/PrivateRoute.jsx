import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/*
  Protege las rutas del panel: si no hay sesión, redirige a /login
  y recuerda la ruta de origen para volver tras iniciar sesión.
*/
const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] text-sm font-medium text-slate-600">
        Cargando sesión…
      </div>
    );
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
};

export default PrivateRoute;
