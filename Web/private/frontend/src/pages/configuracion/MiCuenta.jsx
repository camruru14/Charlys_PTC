import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import Button from "../../components/ui/Button";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import { Field, ReadonlyField } from "../../components/ui/Field";
import PermissionLine from "../../components/employees/PermissionLine";
import { DUI_INPUT_PROPS } from "../../lib/dui";

const emptyCredentials = { email: "", newPassword: "", confirmPassword: "", currentPassword: "" };

/*
  Configuración > Mi cuenta: datos de quien tiene la sesión abierta
  (/auth/me). Teléfono y DUI se guardan con la barra «Cambios sin guardar»
  de Configuración (el borrador vive en Configuracion.jsx); correo y
  contraseña van aparte y siempre piden la contraseña actual. Los datos de
  OTRO empleado se editan en Personal y permisos.
*/
function MiCuenta({ account, loading, error, form, onChange, onCredentialsSaved }) {
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [saving, setSaving] = useState(false);

  if (loading && !account) return <EmptyState title="Cargando tu cuenta…" />;
  if (error || !account) return <EmptyState title="No se pudo cargar tu cuenta" description={error} />;

  const emailChanged = credentials.email.trim() !== "" && credentials.email.trim().toLowerCase() !== account.email;
  const canSubmit = (emailChanged || credentials.newPassword) && credentials.currentPassword && !saving;

  const handleCredentials = (e) => setCredentials((c) => ({ ...c, [e.target.name]: e.target.value }));

  async function saveCredentials(e) {
    e.preventDefault();
    if (credentials.newPassword && credentials.newPassword !== credentials.confirmPassword) {
      return toast.error("La nueva contraseña y su confirmación no coinciden");
    }
    setSaving(true);
    try {
      const saved = await api.put("/auth/me/credentials", {
        currentPassword: credentials.currentPassword,
        email: emailChanged ? credentials.email.trim() : undefined,
        newPassword: credentials.newPassword || undefined,
      });
      onCredentialsSaved(saved);
      setCredentials(emptyCredentials);
      toast.success(emailChanged && credentials.newPassword ? "Correo y contraseña actualizados" : emailChanged ? "Correo actualizado" : "Contraseña actualizada");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4">
        <div className="mb-4 flex items-center gap-3.5">
          <Avatar person={account} size={48} tone="color" />
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-bold text-ink">
              {account.name} {account.lastName}
            </h2>
            <p className="t-aux mt-0.5">{[account.position, account.department].filter(Boolean).join(" · ") || "Sin puesto asignado"}</p>
            <div className="mt-1.5">
              <PermissionLine employee={account} />
            </div>
          </div>
        </div>
        <form id="account-form" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Teléfono" name="phone" value={form.phone} onChange={onChange} placeholder="2222-2222" />
          <Field label="DUI" name="dui" value={form.dui} onChange={onChange} {...DUI_INPUT_PROPS} />
          <ReadonlyField label="Correo con el que inicias sesión" value={account.email} />
        </form>
      </section>

      <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4">
        <h2 className="t-card-title">Correo y contraseña</h2>
        <p className="t-aux mt-0.5">Para cambiar cualquiera de los dos, confirma con tu contraseña actual.</p>
        <form onSubmit={saveCredentials} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nuevo correo" name="email" type="email" value={credentials.email} onChange={handleCredentials} placeholder={account.email} autoComplete="email" />
          <div className="hidden sm:block" />
          <Field label="Nueva contraseña" name="newPassword" type="password" value={credentials.newPassword} onChange={handleCredentials} minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
          <Field
            label="Confirmar nueva contraseña"
            name="confirmPassword"
            type="password"
            value={credentials.confirmPassword}
            onChange={handleCredentials}
            required={Boolean(credentials.newPassword)}
            autoComplete="new-password"
          />
          <Field
            label="Contraseña actual"
            name="currentPassword"
            type="password"
            value={credentials.currentPassword}
            onChange={handleCredentials}
            required={emailChanged || Boolean(credentials.newPassword)}
            autoComplete="current-password"
          />
          <div className="flex items-end">
            <Button type="submit" size="detail" disabled={!canSubmit}>
              {saving ? "Guardando…" : "Actualizar acceso"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default MiCuenta;
