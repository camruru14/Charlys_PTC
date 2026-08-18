import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";

export default function RegistroPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register(form);
      navigate("/", { replace: true });
      toast.success("¡Cuenta creada!");
    } catch (error) {
      toast.error(error.message || "No se pudo crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight">Crear cuenta</h1>
      <p className="mt-2 text-muted-foreground">Regístrate para comprar y ver el historial de tus pedidos.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre" required value={form.name} onChange={update("name")} />
          <Field label="Apellido" value={form.lastName} onChange={update("lastName")} />
        </div>
        <Field label="Correo electrónico" type="email" required value={form.email} onChange={update("email")} />
        <Field label="Teléfono" value={form.phone} onChange={update("phone")} />
        <Field
          label="Contraseña (mínimo 8 caracteres)"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update("password")}
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link to="/cuenta/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </section>
  );
}
