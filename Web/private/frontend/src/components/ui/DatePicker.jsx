import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dayIndex, fromInput, toInput } from "../../lib/calendar";
import MonthCalendar from "./MonthCalendar";

/*
  Popover con el calendario propio del panel para elegir UNA fecha (reemplaza al <input type="date">
  y su calendario nativo). Mismo estilo que el de DateRangePicker; va con position: fixed contra el
  botón (`anchorRef`) para que ningún contenedor con scroll (como el cuerpo de un Modal) lo recorte:
  se alinea a la izquierda del botón (o a la derecha si no cabe) y se voltea hacia arriba si no
  cabe debajo.
    value        «AAAA-MM-DD» (igual que todayInput()); "" si no hay fecha
    onChange     recibe el nuevo «AAAA-MM-DD»
    min / max    «AAAA-MM-DD»: los días fuera se ven apagados y no se pueden elegir
    shortcuts    [{ label, value }] atajos del pie (value «AAAA-MM-DD»); sin atajos no hay pie
    anchorRef    el botón que lo abre (el clic en él NO cierra por «clic fuera»: lo alterna su dueño)
    open/onClose controlado por quien lo usa
  Clic en un día: elige y cierra. Escape o clic fuera: cierra sin cambiar. Teclado: flechas por día
  y semana, Inicio/Fin, RePág/AvPág para cambiar de mes, Enter elige; el foco entra al día elegido
  al abrir y vuelve al botón al cerrar con Escape o al elegir.
*/

const POPOVER_WIDTH = 300;
const SCREEN_MARGIN = 8;
const GAP = 6;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function DatePickerPanel({ value, onChange, min, max, shortcuts, anchorRef, onClose }) {
  const ref = useRef(null);
  const minDate = fromInput(min);
  const maxDate = fromInput(max);
  const selected = fromInput(value);

  const [focusDate, setFocusDate] = useState(() => {
    let start = selected || startOfDay(new Date());
    if (minDate && start < minDate) start = minDate;
    if (maxDate && start > maxDate) start = maxDate;
    return start;
  });
  const [view, setView] = useState({ year: focusDate.getFullYear(), month: focusDate.getMonth() });
  const [pos, setPos] = useState(null);

  const finish = (returnFocus) => {
    onClose();
    if (returnFocus) anchorRef?.current?.focus();
  };

  // Posición: debajo del botón; si no cabe, por encima. Se mide una vez al abrir (el alto es fijo: 6 semanas).
  useLayoutEffect(() => {
    const rect = anchorRef?.current?.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 0;
    if (!rect) return;
    const fitsRight = rect.left + POPOVER_WIDTH <= window.innerWidth - SCREEN_MARGIN;
    const fitsLeft = rect.right - POPOVER_WIDTH >= SCREEN_MARGIN;
    const left = fitsRight ? rect.left : fitsLeft ? rect.right - POPOVER_WIDTH : Math.max(SCREEN_MARGIN, (window.innerWidth - POPOVER_WIDTH) / 2);
    const below = rect.bottom + GAP + height <= window.innerHeight - SCREEN_MARGIN;
    const top = below ? rect.bottom + GAP : Math.max(SCREEN_MARGIN, rect.top - GAP - height);
    setPos({ top, left });
  }, [anchorRef]);

  // Cerrar con clic fuera, Escape, scroll de la página o cambio de tamaño de la ventana.
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      finish(false);
    };
    // En captura y sin dejar pasar el evento: dentro de un Modal, Escape cierra solo el calendario.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      finish(true);
    };
    const onScroll = (e) => !ref.current?.contains(e.target) && finish(false);
    const onResize = () => finish(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish solo usa onClose y anchorRef, estables mientras está abierto
  }, []);

  const pick = (date) => {
    onChange(toInput(date));
    finish(true);
  };

  const selectedIdx = selected ? dayIndex(selected) : null;
  const items = (shortcuts || []).map((s) => {
    const date = fromInput(s.value);
    const disabled = !date || (minDate && date < minDate) || (maxDate && date > maxDate);
    return { ...s, date, disabled };
  });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Elegir fecha"
      style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, width: POPOVER_WIDTH, opacity: pos ? 1 : 0 }}
      className="z-[60] max-w-[calc(100vw-16px)] rounded-[14px] border border-line bg-surface p-4 shadow-modal"
    >
      <MonthCalendar
        view={view}
        onViewChange={setView}
        startIdx={selectedIdx}
        onPick={pick}
        min={minDate}
        max={maxDate}
        focusDate={focusDate}
        onFocusDate={setFocusDate}
        autoFocus
        weekdayClass="t-label grid h-7 place-items-center"
      />
      {items.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft pt-3">
          {items.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={s.disabled}
              onClick={() => pick(s.date)}
              className="text-[12px] font-semibold text-primary-soft-text transition hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Se monta al abrir: cada vez arranca en el mes y el día del valor actual.
function DatePicker({ open, ...props }) {
  return open ? <DatePickerPanel {...props} /> : null;
}

export default DatePicker;
