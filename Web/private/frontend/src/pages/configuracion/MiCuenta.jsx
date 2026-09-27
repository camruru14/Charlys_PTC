import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import { Field, PasswordField, ReadonlyField } from "../../components/ui/Field";
import PermissionLine from "../../components/employees/PermissionLine";
import { DUI_INPUT_PROPS } from "../../lib/dui";
import { IconEye, IconEyeOff } from "../../lib/icons";

/*
  «Contraseña actual»: fija como el correo (no se edita aquí), con el ojo
  para mostrarla. Viene del backend ya desencriptada (GET /auth/me/password).
  Si todavía es un hash bcrypt viejo (legacy), no se puede desencriptar: se
  usa la que se escribió al iniciar sesión en esta pestaña
  (AuthContext.sessionPassword) y, si tampoco hay, el ojo avisa que hay que
  actualizarla.
*/
function CurrentPasswordField({ password, legacy }) {
  const [visible, setVisible] = useState(false);
  const shown = visible && password ? password : "•".repeat(password ? Math.min(password.length, 16) : 8);

  function toggle() {
    if (!password) {
      toast(
        legacy
          ? "Tu contraseña no se puede mostrar hasta que se actualice: escribe una nueva en «Cambiar contraseña» para reemplazarla."
          : "Todavía no se pudo cargar tu contraseña. Intenta de nuevo en un momento.",
        { duration: 6000 },
      );
      return;
    }
    setVisible((v) => !v);
  }

  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Contraseña actual</span>
      <div className="relative flex min-h-[38px] items-center rounded-[10px] border border-dashed border-line bg-surface-2 pl-3 pr-10 text-[13px] font-semibold text-ink">
        <span className="truncate" data-testid="current-password">
          {shown}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[10px] text-muted transition hover:text-ink"
        >
          {/* El ícono muestra el estado: tachado = oculta, abierto = visible. */}
          {visible ? <IconEye width={16} height={16} /> : <IconEyeOff width={16} height={16} />}
        </button>
      </div>
    </div>
  );
}

/*
  Configuración > Mi cuenta: datos de quien tiene la sesión abierta
  (/auth/me), en una sola tarjeta. Todo se guarda con la barra «Cambios sin
  guardar» de Configuración (el borrador y las validaciones viven en
  Configuracion.jsx): cambiar el correo o la contraseña exige la contraseña
  actual, que se pide al guardar (ConfirmPasswordModal). Los datos de OTRO
  empleado se editan en Personal y permisos.
    form: { newEmail, newPassword, phone, dui }
    storedPassword: { password, legacy } de GET /auth/me/password (null mientras carga)
*/
function MiCuenta({ account, loading, error, form, onChange, storedPassword }) {
  const { sessionPassword } = useAuth();
  if (loading && !account) return <EmptyState title="Cargando tu cuenta…" />;
  if (error || !account) return <EmptyState title="No se pudo cargar tu cuenta" description={error} />;

  return (
    <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <div className="mb-5 flex items-center gap-3.5">
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
        <ReadonlyField label="Correo con el que inicias sesión" value={account.email} />
        <Field label="Cambiar correo" name="newEmail" type="email" value={form.newEmail} onChange={onChange} placeholder="Nuevo correo" autoComplete="off" />

        {/* Fija, como el correo; se confirma aparte al guardar un cambio de acceso. */}
        <CurrentPasswordField password={storedPassword?.password || (storedPassword?.legacy ? sessionPassword : "")} legacy={Boolean(storedPassword?.legacy)} />
        <PasswordField
          label="Cambiar contraseña"
          name="newPassword"
          value={form.newPassword}
          onChange={onChange}
          placeholder="Nueva contraseña"
          minLength={6}
          autoComplete="new-password"
        />
        <p className="t-aux -mt-2 sm:col-span-2">Al guardar un correo o una contraseña nuevos se te pedirá tu contraseña actual. La nueva contraseña debe tener al menos 6 caracteres.</p>

        <div className="border-t border-line-soft sm:col-span-2" />
        <Field label="Teléfono" name="phone" value={form.phone} onChange={onChange} placeholder="2222-2222" />
        <Field label="DUI" name="dui" value={form.dui} onChange={onChange} {...DUI_INPUT_PROPS} />
      </form>
    </section>
  );
}

export default MiCuenta;
