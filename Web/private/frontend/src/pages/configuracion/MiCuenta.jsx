import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { useConfirm } from "../../hooks/useConfirm";
import Avatar from "../../components/ui/Avatar";
import ConfirmModal from "../../components/ui/ConfirmModal";
import EmptyState from "../../components/ui/EmptyState";
import { Field, PasswordField, ReadonlyField } from "../../components/ui/Field";
import PermissionLine from "../../components/employees/PermissionLine";
import { DUI_INPUT_PROPS } from "../../lib/dui";
import { IconCamera, IconEye, IconEyeOff } from "../../lib/icons";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/*
  «Contraseña actual»: fija como el correo (no se edita aquí), con el ojo
  para mostrarla. La contraseña NO se carga al entrar a Configuración: solo se
  pide al backend (GET /auth/me/password, ya desencriptada) cuando se pulsa el
  ojo. Si todavía es un hash bcrypt viejo (legacy), no se puede mostrar: el ojo
  avisa que hay que actualizarla.
*/
function CurrentPasswordField() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  // { password, legacy } del backend; null hasta que se pulsa el ojo.
  const [stored, setStored] = useState(null);
  const password = stored?.password || "";
  const shown = visible && password ? password : "•".repeat(password ? Math.min(password.length, 16) : 8);

  async function toggle() {
    if (visible) {
      setVisible(false);
      return;
    }
    if (busy) return;
    let current = stored;
    if (!current) {
      setBusy(true);
      try {
        current = await api.get("/auth/me/password");
        setStored(current);
      } catch (err) {
        toast.error(err.message);
        return;
      } finally {
        setBusy(false);
      }
    }
    if (!current?.password) {
      toast(
        current?.legacy
          ? "Tu contraseña no se puede mostrar hasta que se actualice: escribe una nueva en «Cambiar contraseña» para reemplazarla."
          : "No se pudo cargar tu contraseña. Intenta de nuevo en un momento.",
        { duration: 6000 },
      );
      return;
    }
    setVisible(true);
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
          disabled={busy}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[10px] text-muted transition hover:text-ink disabled:opacity-60"
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
    form: { name, lastName, newEmail, newPassword, phone, dui }
    passwordVersion: cambia al guardar una contraseña nueva (reinicia el ojo de «Contraseña actual»)
    onAccount: recibe la cuenta que devuelve el backend tras cambiar la foto
  La foto NO espera a «Guardar cambios»: se sube (o se quita) al momento.
*/
function MiCuenta({ account, loading, error, form, onChange, onAccount, passwordVersion = 0 }) {
  const { updateUser } = useAuth();
  const { confirm, confirmProps } = useConfirm();
  const fileRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  if (loading && !account) return <EmptyState title="Cargando tu cuenta…" />;
  if (error || !account) return <EmptyState title="No se pudo cargar tu cuenta" description={error} />;

  // La cuenta nueva va a la pantalla y a la sesión (pie del menú lateral).
  function applyAccount(saved) {
    onAccount(saved);
    updateUser({ photoUrl: saved.photoUrl });
  }

  async function uploadPhoto(file) {
    if (!file || photoBusy) return;
    if (!file.type.startsWith("image/")) return toast.error("La foto debe ser una imagen");
    if (file.size > MAX_PHOTO_BYTES) return toast.error("La foto no puede pesar más de 5 MB");
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      applyAccount(await api.post("/auth/me/photo", body));
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!(await confirm("Se quitará tu foto de perfil y volverán tus iniciales.", { danger: true, title: "Quitar foto", confirmLabel: "Quitar foto" }))) return;
    setPhotoBusy(true);
    try {
      applyAccount(await api.del("/auth/me/photo"));
      toast.success("Foto quitada");
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setPhotoBusy(false);
    }
  }

  const hasPhoto = Boolean(account.photoUrl);

  return (
    <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <div className="mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
          aria-label={hasPhoto ? "Cambiar foto de perfil" : "Subir foto de perfil"}
          className="group relative shrink-0 rounded-full"
        >
          <Avatar person={account} size={72} tone="color" />
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-ink/55 text-white transition-opacity ${
              photoBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {photoBusy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" role="status" aria-label="Subiendo foto" />
            ) : (
              <IconCamera width={22} height={22} />
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            uploadPhoto(file);
          }}
        />
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-bold text-ink">
            {account.name} {account.lastName}
          </h2>
          <p className="t-aux mt-0.5">{[account.position, account.department].filter(Boolean).join(" · ") || "Sin puesto asignado"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <PermissionLine employee={account} />
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="text-[12.5px] font-semibold text-primary-soft-text transition hover:text-primary disabled:opacity-50"
              >
                {hasPhoto ? "Cambiar foto" : "Subir foto"}
              </button>
              {hasPhoto ? (
                <button type="button" onClick={removePhoto} disabled={photoBusy} className="text-[12.5px] font-semibold text-tone-rose-text transition hover:opacity-80 disabled:opacity-50">
                  Quitar foto
                </button>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      <form id="account-form" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="name" value={form.name} onChange={onChange} maxLength={60} autoComplete="given-name" required />
        <Field label="Apellido" name="lastName" value={form.lastName} onChange={onChange} maxLength={60} autoComplete="family-name" required />
        <ReadonlyField label="Correo con el que inicias sesión" value={account.email} />
        <Field label="Cambiar correo" name="newEmail" type="email" value={form.newEmail} onChange={onChange} placeholder="Nuevo correo" autoComplete="off" />

        {/* Fija, como el correo; se confirma aparte al guardar un cambio de acceso. */}
        <CurrentPasswordField key={passwordVersion} />
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
      <ConfirmModal {...confirmProps} />
    </section>
  );
}

export default MiCuenta;
