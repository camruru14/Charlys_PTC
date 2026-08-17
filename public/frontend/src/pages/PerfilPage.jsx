import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";

/*
  Perfil de la cuenta del cliente: datos personales editables + cambio de
  contraseña (sabiendo la actual, distinto del flujo de recuperación por
  correo de RecuperarPasswordPage.jsx). Misma estructura que
  D:\Applefly\public\frontend\src\screens\Perfil.jsx (header con avatar,
  tarjeta "Mis datos", tarjeta "Seguridad" con modal, acciones al pie), pero
  con nuestros componentes/tokens y formularios controlados con useState
  (sin react-hook-form).
*/
export default function PerfilPage() {
  const { customer, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const defaultAddress = customer?.addresses?.find((a) => a.isDefault) || customer?.addresses?.[0];

  const [form, setForm] = useState({ name: "", lastName: "", phone: "", address: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // El perfil llega de AuthContext después del primer render, así que hay
  // que volcar sus valores al formulario cuando aparece.
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        lastName: customer.lastName || "",
        phone: customer.phone || "",
        address: defaultAddress?.address || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(form);
      toast.success("Perfil actualizado.");
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const updatePassword = (key) => (e) => setPasswordForm((f) => ({ ...f, [key]: e.target.value }));

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success("Contraseña actualizada.");
      setPasswordModalOpen(false);
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  if (!customer) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {customer.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {customer.name} {customer.lastName}
          </h1>
          <p className="text-muted-foreground">{customer.email}</p>
        </div>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-8">
          <h2 className="font-display text-lg font-semibold">Mis datos</h2>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre" required value={form.name} onChange={update("name")} />
              <Field label="Apellido" value={form.lastName} onChange={update("lastName")} />
            </div>
            {/* El correo identifica la cuenta, por eso no se puede editar */}
            <Field label="Correo electrónico" value={customer.email} disabled />
            <Field label="Teléfono" placeholder="+503 0000 0000" value={form.phone} onChange={update("phone")} />
            <Field
              label="Dirección"
              placeholder="Tu dirección de envío"
              value={form.address}
              onChange={update("address")}
            />
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {savingProfile ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-card p-8">
          <h2 className="font-display text-lg font-semibold">Seguridad</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Actualiza tu contraseña de acceso cuando lo necesites.
          </p>
          <button
            type="button"
            onClick={openPasswordModal}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold transition hover:bg-secondary/60"
          >
            Cambiar contraseña
          </button>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
        <Link to="/cuenta/pedidos" className="font-medium text-primary hover:underline">
          Ver mis pedidos
        </Link>
        <button type="button" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          Cerrar sesión
        </button>
      </div>

      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setPasswordModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar contraseña"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Cambiar contraseña</h2>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="mt-5 space-y-5">
              <Field
                label="Contraseña actual"
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={updatePassword("currentPassword")}
              />
              <Field
                label="Nueva contraseña (mínimo 8 caracteres)"
                type="password"
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={updatePassword("newPassword")}
              />
              <Field
                label="Confirmar nueva contraseña"
                type="password"
                required
                minLength={8}
                value={passwordForm.confirmNewPassword}
                onChange={updatePassword("confirmNewPassword")}
              />

              <p className="text-sm">
                <Link
                  to="/cuenta/recuperar"
                  onClick={() => setPasswordModalOpen(false)}
                  className="font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 rounded-full border border-border px-6 py-3 text-sm font-semibold transition hover:bg-secondary/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {savingPassword ? "Guardando…" : "Guardar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
