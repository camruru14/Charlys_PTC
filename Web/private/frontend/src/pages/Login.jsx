import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

/*
  Página de inicio de sesión del panel administrativo.
  Autentica contra /api/auth/login y, al tener éxito, redirige al Dashboard.
*/
function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/";

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);

    if (result.ok) {
      toast.success(result.message);
      navigate(from, { replace: true });
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-lg font-extrabold text-white">
            IC
          </span>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            Industrias Charly
          </h1>
          <p className="t-page-sub">Panel administrativo</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[14px] border border-line bg-surface p-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Correo
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@industriascharly.com"
              className="h-10 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="h-10 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-white transition hover:bg-primary-hover disabled:opacity-55"
          >
            {submitting ? "Ingresando…" : "Iniciar sesión"}
          </button>

          <p className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-center text-xs text-muted">
            Demo: <b>admin@industriascharly.com</b> / <b>admin123</b>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
