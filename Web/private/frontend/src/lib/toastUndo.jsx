import toast from "react-hot-toast";

/*
  Toast con botón «Deshacer» (6 segundos).
    toastUndo("Línea empacada", () => api.del(...));
  Al presionar «Deshacer» se cierra el toast y se llama onUndo.
*/
export function toastUndo(message, onUndo) {
  return toast.custom(
    (t) => (
      <div
        className={`flex items-center gap-4 rounded-[12px] border border-line bg-surface py-2.5 pl-4 pr-2.5 text-[13px] text-ink shadow-modal transition-opacity ${
          t.visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span>{message}</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            onUndo?.();
          }}
          className="h-7 rounded-[8px] bg-primary-soft px-2.5 text-[12.5px] font-semibold text-primary-soft-text hover:bg-select-bg"
        >
          Deshacer
        </button>
      </div>
    ),
    { duration: 6000 },
  );
}

export default toastUndo;
