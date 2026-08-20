import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-muted-foreground">Entra a tu cuenta para comprar y ver tus pedidos.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-8">
        <Field label="Correo electrónico" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-right text-sm">
          <Link to="/cuenta/recuperar" className="font-medium text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link to="/cuenta/registro" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </section>
  );
}
