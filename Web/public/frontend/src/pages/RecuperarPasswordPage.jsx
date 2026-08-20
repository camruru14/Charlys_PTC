import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Field from "../components/Field";
import api from "../lib/api";

/*
  Recuperación de contraseña en 3 pasos (correo -> código -> nueva
  contraseña), todo en una sola pantalla que lleva el paso con un simple
  useState. Quien realmente controla si el paso es válido es la cookie
  temporal del backend (recoveryCookie, 15 min) — este componente solo
  decide qué formulario mostrar.
*/
export default function RecuperarPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post("/auth/recovery/request-code", { email });
      toast.success(res.message);
      setStep(2);
    } catch (error) {
      toast.error(error.message || "No se pudo enviar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post("/auth/recovery/verify-code", { codeRequest: code.trim() });
      toast.success(res.message);
      setStep(3);
    } catch (error) {
      toast.error(error.message || "No se pudo verificar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/recovery/new-password", { newPassword, confirmNewPassword });
      toast.success("Contraseña actualizada, ya puedes iniciar sesión");
      navigate("/cuenta/login", { replace: true });
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md px-6 py-24">
      {step === 1 && (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">Recuperar contraseña</h1>
          <p className="mt-2 text-muted-foreground">
            Escribe tu correo y te enviaremos un código para restablecerla.
          </p>

          <form onSubmit={handleRequestCode} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-8">
            <Field label="Correo electrónico" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviarme el código"}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">Revisa tu correo</h1>
          <p className="mt-2 text-muted-foreground">
            Enviamos un código de 6 caracteres a <strong>{email}</strong>
          </p>

          <form onSubmit={handleVerifyCode} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-8">
            <Field
              label="Código"
              required
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ textAlign: "center", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.5em" }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Verificando…" : "Verificar código"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            El código expira en 15 minutos. Revisa tu carpeta de spam.
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">Nueva contraseña</h1>
          <p className="mt-2 text-muted-foreground">Elige una contraseña nueva para tu cuenta.</p>

          <form onSubmit={handleNewPassword} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-8">
            <Field
              label="Nueva contraseña (mínimo 8 caracteres)"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Field
              label="Confirmar contraseña"
              type="password"
              required
              minLength={8}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/cuenta/login" className="font-medium text-primary hover:underline">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </section>
  );
}
