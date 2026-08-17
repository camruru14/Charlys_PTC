import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Protege rutas que requieren sesión de cliente (checkout, mis pedidos).
// Mientras se resuelve /auth/me no redirige todavía, para evitar un
// parpadeo hacia /cuenta/login en cada recarga de página.
export default function PrivateRoute() {
  const { customer, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-24 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/cuenta/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
