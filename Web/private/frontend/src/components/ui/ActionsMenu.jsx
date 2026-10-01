import { useEffect, useRef, useState } from "react";
import { IconMore } from "../../lib/icons";
import { buttonClass } from "../../lib/buttonStyles";

/*
  Menú «…» con acciones secundarias (normalmente las destructivas, que piden
  confirmación en quien las llama).
    items = [{ label, onClick, danger, disabled, hint }]
    El menú se posiciona con `position: fixed` contra el botón (y se abre hacia
    arriba si abajo no cabe), así una tarjeta con scroll o overflow no lo recorta.
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
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    const onScroll = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const menuHeight = items.length * 38 + 14;
      const fitsBelow = window.innerHeight - r.bottom >= menuHeight + 12;
      setPos({ right: Math.max(8, window.innerWidth - r.right), ...(fitsBelow ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
    }
    setOpen((v) => !v);
  }

  const trigger = TRIGGERS[size] || TRIGGERS.detail;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggle} aria-label={label} title={label} aria-expanded={open} className={trigger}>
        <IconMore width={size === "detail" ? 17 : 16} height={size === "detail" ? 17 : 16} />
      </button>
      {open ? (
        <div style={{ position: "fixed", ...pos }} className="z-30 w-48 rounded-[12px] border border-line bg-surface p-1.5 shadow-modal">
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
