import Modal from "../../components/ui/Modal";
import { PasswordField } from "../../components/ui/Field";
import { buttonClass } from "../../lib/buttonStyles";

/*
  Confirmación con la contraseña actual antes de aplicar un cambio de correo
  o de contraseña en Mi cuenta (se abre desde «Guardar cambios»). El error de
  una contraseña incorrecta se muestra aquí mismo y no se guarda nada.
    state: { value, error } | null
*/
function ConfirmPasswordModal({ state, busy, onChange, onClose, onConfirm }) {
  if (!state) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Confirma tu contraseña actual"
      subtitle="Para cambiar tu correo o tu contraseña necesitamos confirmar que eres tú."
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="confirm-password-form" disabled={busy || !state.value} className={buttonClass("primary", "modal")}>
            {busy ? "Guardando…" : "Confirmar y guardar"}
          </button>
        </>
      }
    >
      <form
        id="confirm-password-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (state.value) onConfirm(state.value);
        }}
        className="flex flex-col gap-2"
      >
        <PasswordField
          label="Contraseña actual"
          name="confirmCurrentPassword"
          value={state.value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        {state.error ? <p className="text-[12.5px] font-medium text-tone-rose-text">{state.error}</p> : null}
      </form>
    </Modal>
  );
}

export default ConfirmPasswordModal;
