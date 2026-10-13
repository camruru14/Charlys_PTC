import { useEffect, useRef } from "react";
import { IconChevronLeft, IconChevronRight } from "../../lib/icons";
import { capitalize, dayIndex, longDateLabel, MONTHS_LONG, WEEKDAYS } from "../../lib/calendar";

/*
  Cuadrícula de UN mes (lunes a domingo, 6 semanas fijas para que el alto no cambie), con el nombre
  del mes y los botones anterior/siguiente. La comparten el «Personalizado» de DateRangePicker
  (rango) y DatePicker (un solo día): un día elegido es un rango de un día (startIdx === endIdx).
    view / onViewChange   { year, month } visible
    startIdx / endIdx     números de día (dayIndex) del rango o día elegido; null si no hay
    onPick(date)          clic en un día (los fuera de min/max no responden)
    min / max             Date | null: los días fuera se ven apagados y con aria-disabled
    focusDate / onFocusDate  opcional: activa el teclado (flechas, PageUp/PageDown, Home/End) con el
                          foco «rodante» en un solo día; autoFocus lo enfoca al montar
    weekdayClass          estilo de la fila L M M J V S D
*/

export function NavButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

const WEEKDAY_DEFAULT = "grid h-7 place-items-center text-[11px] font-bold text-subtle";
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function MonthCalendar({
  view,
  onViewChange,
  startIdx = null,
  endIdx = startIdx,
  onPick,
  min = null,
  max = null,
  focusDate = null,
  onFocusDate,
  autoFocus = false,
  weekdayClass = WEEKDAY_DEFAULT,
  className = "",
}) {
  const gridRef = useRef(null);
  const wantFocus = useRef(autoFocus);
  const focusIdx = focusDate ? dayIndex(focusDate) : null;
  const minIdx = min ? dayIndex(min) : null;
  const maxIdx = max ? dayIndex(max) : null;
  const todayIdx = dayIndex(new Date());

  // Con el teclado, el foco sigue al día activo (también si cambia el mes visible).
  useEffect(() => {
    if (!wantFocus.current || focusIdx == null) return;
    const button = gridRef.current?.querySelector(`[data-idx="${focusIdx}"]`);
    if (!button) return;
    wantFocus.current = false;
    button.focus();
  }, [focusIdx, view.year, view.month]);

  const shiftMonth = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    onViewChange({ year: d.getFullYear(), month: d.getMonth() });
  };
  const viewIdx = view.year * 12 + view.month;
  const prevDisabled = min != null && viewIdx <= min.getFullYear() * 12 + min.getMonth();
  const nextDisabled = max != null && viewIdx >= max.getFullYear() * 12 + max.getMonth();

  function onKeyDown(e) {
    if (!focusDate || !onFocusDate || e.ctrlKey || e.metaKey || e.altKey) return;
    const y = focusDate.getFullYear();
    const m = focusDate.getMonth();
    const d = focusDate.getDate();
    const weekday = (focusDate.getDay() + 6) % 7;
    let next = null;
    if (e.key === "ArrowLeft") next = new Date(y, m, d - 1);
    else if (e.key === "ArrowRight") next = new Date(y, m, d + 1);
    else if (e.key === "ArrowUp") next = new Date(y, m, d - 7);
    else if (e.key === "ArrowDown") next = new Date(y, m, d + 7);
    else if (e.key === "Home") next = new Date(y, m, d - weekday);
    else if (e.key === "End") next = new Date(y, m, d + (6 - weekday));
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const target = new Date(y, m + (e.key === "PageUp" ? -1 : 1), 1);
      next = new Date(target.getFullYear(), target.getMonth(), Math.min(d, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    }
    if (!next) return;
    e.preventDefault();
    if (min && next < startOfDay(min)) next = startOfDay(min);
    if (max && next > startOfDay(max)) next = startOfDay(max);
    wantFocus.current = true;
    if (next.getMonth() !== view.month || next.getFullYear() !== view.year) onViewChange({ year: next.getFullYear(), month: next.getMonth() });
    onFocusDate(next);
  }

  // 6 semanas fijas (lunes a domingo).
  const firstOffset = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, k) => new Date(view.year, view.month, 1 - firstOffset + k));

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between">
        <NavButton label="Mes anterior" onClick={() => shiftMonth(-1)} disabled={prevDisabled}>
          <IconChevronLeft width={16} height={16} />
        </NavButton>
        <span className="text-[13px] font-bold text-ink" aria-live="polite">
          {capitalize(MONTHS_LONG[view.month])} {view.year}
        </span>
        <NavButton label="Mes siguiente" onClick={() => shiftMonth(1)} disabled={nextDisabled}>
          <IconChevronRight width={16} height={16} />
        </NavButton>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className={weekdayClass}>
            {d}
          </span>
        ))}
      </div>
      <div ref={gridRef} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date) => {
          const idx = dayIndex(date);
          const inMonth = date.getMonth() === view.month;
          const isStart = idx === startIdx;
          const isEnd = idx === endIdx;
          const edge = isStart || isEnd;
          const between = startIdx != null && idx > startIdx && idx < endIdx;
          const disabled = (minIdx != null && idx < minIdx) || (maxIdx != null && idx > maxIdx);
          // Franja continua: de medio día de inicio a medio día de fin.
          const band = between ? "inset-x-0" : endIdx > startIdx && isStart ? "left-1/2 right-0" : endIdx > startIdx && isEnd ? "left-0 right-1/2" : null;
          return (
            <div key={idx} className="relative flex h-9 items-center justify-center">
              {band ? <span className={`absolute inset-y-0 bg-primary-soft ${band}`} /> : null}
              <button
                type="button"
                data-idx={idx}
                aria-pressed={edge || between}
                aria-disabled={disabled || undefined}
                aria-label={longDateLabel(date)}
                tabIndex={focusDate ? (idx === focusIdx ? 0 : -1) : undefined}
                onClick={() => !disabled && onPick(date)}
                className={`relative h-9 w-9 rounded-full text-[12.5px] tabular-nums transition ${
                  disabled
                    ? "cursor-not-allowed text-faint opacity-50"
                    : edge
                      ? "bg-primary font-semibold text-white"
                      : `${idx === todayIdx ? "font-semibold text-primary ring-[1.5px] ring-inset ring-primary" : inMonth ? "text-ink-2" : "text-faint"} ${
                          between ? "hover:bg-white/70" : "hover:bg-surface-2"
                        }`
                }`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MonthCalendar;
