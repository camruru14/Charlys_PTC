import { useEffect, useRef, useState } from "react";
import { IconMore } from "../../lib/icons";
import { buttonClass } from "../../lib/buttonStyles";

/*
  Menú «…» con acciones secundarias (normalmente las destructivas, que piden
  confirmación en quien las llama).
    items = [{ label, onClick, danger, disabled, hint }]
            (hint: motivo que se muestra al pasar sobre una acción desactivada)
    size  = "detail" (34×34, encabezado de detalle) | "row" (30×30, fila)
            | "card" (32×32 con borde, pie de tarjeta)
*/

const TRIGGERS = {
  row: "flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink",
  card: `${buttonClass("secondary", "row")} !h-8 w-8 !px-0`,
  detail: `${buttonClass("secondary", "detail")} w-[34px] !px-0`,
};
function ActionsMenu({ items, size = "detail", label = "Más acciones" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger = TRIGGERS[size] || TRIGGERS.detail;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={label} title={label} aria-expanded={open} className={trigger}>
        <IconMore width={size === "detail" ? 17 : 16} height={size === "detail" ? 17 : 16} />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 w-48 rounded-[12px] border border-line bg-surface p-1.5 shadow-modal">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              title={item.disabled ? item.hint : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                item.danger ? "text-tone-rose-text enabled:hover:bg-tone-rose" : "text-ink-2 enabled:hover:bg-surface-2"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ActionsMenu;
