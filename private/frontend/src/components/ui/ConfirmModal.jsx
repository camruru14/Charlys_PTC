import Modal from "./Modal";

/*
  Modal de confirmación genérico: reemplaza los window.confirm() de todo el
  sistema (ver hooks/useConfirm.js, que arma estas props a partir de un
  simple `await confirm(mensaje, opciones)`).
  `danger` pinta el botón y el mensaje en rojo, para acciones destructivas
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
          <button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className={`rounded-xl px-3.5 py-2.5 text-sm ${danger ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"}`}>{message}</p>
    </Modal>
  );
}

export default ConfirmModal;
