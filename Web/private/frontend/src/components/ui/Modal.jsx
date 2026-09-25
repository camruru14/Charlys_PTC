import { useEffect } from "react";
import { IconClose } from "../../lib/icons";

/*
  Modal reutilizable. Se cierra con la tecla Escape o el botón de cerrar (la X
  o el de footer) — clic en el fondo NO cierra, para no perder datos de un
  formulario a medio llenar por un clic accidental fuera del modal.
  Props: open, onClose, title, subtitle, children, footer, size ("md" 470px |
  "lg" 640px, para formularios de 2 columnas).
*/
function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "lg" ? "max-w-[640px]" : "max-w-[470px]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/32 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className={`app-modal relative z-10 flex max-h-[calc(100dvh-32px)] w-full ${width} flex-col gap-4 rounded-2xl bg-surface px-6 py-[22px] shadow-modal`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[17px] font-bold text-ink">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-canvas text-muted transition hover:text-ink"
          >
            <IconClose width={16} height={16} />
          </button>
        </div>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">{children}</div>

        {footer ? <div className="flex items-center justify-end gap-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

export default Modal;
