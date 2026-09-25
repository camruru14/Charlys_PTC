import { useEffect, useRef, useState } from "react";
import { IconMore } from "../../lib/icons";
import { buttonClass } from "../../lib/buttonStyles";

/*
  Menú «…» con acciones secundarias (normalmente las destructivas, que piden
  confirmación en quien las llama).
    items = [{ label, onClick, danger }]
    size  = "detail" (34×34, encabezado de detalle) | "row" (30×30, fila)
*/
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

  const trigger =
    size === "row"
      ? "flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink"
      : `${buttonClass("secondary", "detail")} w-[34px] !px-0`;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={label} title={label} aria-expanded={open} className={trigger}>
        <IconMore width={size === "row" ? 16 : 17} height={size === "row" ? 16 : 17} />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1.5 w-48 rounded-[12px] border border-line bg-surface p-1.5 shadow-modal">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13px] font-semibold transition ${
                item.danger ? "text-tone-rose-text hover:bg-tone-rose" : "text-ink-2 hover:bg-surface-2"
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
