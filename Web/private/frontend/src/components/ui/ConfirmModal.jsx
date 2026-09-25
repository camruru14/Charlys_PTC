import Modal from "./Modal";
import Button from "./Button";

/*
  Modal de confirmación genérico: reemplaza los window.confirm() de todo el
  sistema (ver hooks/useConfirm.js, que arma estas props a partir de un
  simple `await confirm(mensaje, opciones)`).
  `danger` pinta el botón y el mensaje en rosa, para acciones destructivas
  (eliminar) — el resto usa el tono normal de marca.
*/
function ConfirmModal({ open, title, message, confirmLabel, cancelLabel = "Cancelar", danger, loading, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="modal" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="modal" onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className={`rounded-[11px] px-3.5 py-2.5 text-[13px] ${danger ? "bg-tone-rose text-tone-rose-text" : "bg-surface-2 text-ink-2"}`}>{message}</p>
    </Modal>
  );
}

export default ConfirmModal;
