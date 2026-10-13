import { useEffect, useRef, useState } from "react";
import { useDateRange, rangeLabel } from "../../context/dateRange";
import { fmtDate, fmtDateYear } from "../../lib/format";
import { capitalize, dayIndex, formatInput, MONTHS_LONG, parseInput } from "../../lib/calendar";
import { IconCalendar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight } from "../../lib/icons";
import Button from "./Button";
import MonthCalendar, { NavButton } from "./MonthCalendar";

const POPOVER_WIDTH = 330;
const SCREEN_MARGIN = 8;

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const TABS = [
  { key: "rapido", label: "Rápido" },
  { key: "mes", label: "Por mes" },
  { key: "personalizado", label: "Personalizado" },
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Índice de mes (año * 12 + mes) para comparar y recorrer meses de varios años.
const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();
const monthOf = (index) => ({ year: Math.floor(index / 12), month: index % 12 });

function monthsSummary(lo, hi) {
  const a = monthOf(lo);
  const b = monthOf(hi);
  let label;
  if (lo === hi) label = `${capitalize(MONTHS_LONG[a.month])} ${a.year}`;
  else if (a.year === b.year) label = `${capitalize(MONTHS_LONG[a.month])} – ${MONTHS_LONG[b.month]} ${b.year}`;
  else label = `${capitalize(MONTHS_LONG[a.month])} ${a.year} – ${MONTHS_LONG[b.month]} ${b.year}`;
  return `${label} · ${plural(hi - lo + 1, "mes", "meses")}`;
}

function daysSummary(from, to) {
  const days = dayIndex(to) - dayIndex(from) + 1;
  const label =
    days === 1
      ? fmtDateYear(from)
      : from.getFullYear() === to.getFullYear()
        ? `${fmtDate(from)} – ${fmtDateYear(to)}`
        : `${fmtDateYear(from)} – ${fmtDateYear(to)}`;
  return `${label} · ${plural(days, "día", "días")}`;
}

// Pie de «Por mes» y «Personalizado»: Restablecer a la izquierda, Aplicar a la derecha.
function Footer({ onReset, onApply, canApply }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <button type="button" onClick={onReset} className="text-[12px] font-semibold text-muted hover:text-ink">
        Restablecer
      </button>
      <Button size="row" onClick={onApply} disabled={!canApply}>
        Aplicar
      </Button>
    </div>
  );
}

function Summary({ children }) {
  return (
    <div className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2 text-[12.5px] font-semibold text-ink">{children}</div>
  );
}

// RÁPIDO: los PRESETS en lista vertical; al tocar uno se aplica y se cierra.
function QuickPanel({ range, onPick }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(range.presets).map(([key, preset]) => {
        const active = range.preset === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(key)}
            className={`flex h-[34px] items-center justify-between rounded-[8px] px-2.5 text-[13px] transition ${
              active ? "bg-primary-soft font-bold text-primary-soft-text" : "font-medium text-ink-2 hover:bg-surface-2"
            }`}
          >
            <span>{preset.label}</span>
            {active ? <IconCheck width={15} height={15} /> : null}
          </button>
        );
      })}
    </div>
  );
}

// POR MES: cuadrícula 4×3 de meses; dos toques = rango de meses (también entre años).
function MonthsPanel({ range, onApply, onReset }) {
  const now = new Date();
  const maxIndex = monthIndex(now);
  const initial =
    range.granularity === "month" && range.from && range.to ? [monthIndex(range.from), monthIndex(range.to)] : [null, null];
  const [selection, setSelection] = useState(initial);
  const [year, setYear] = useState(initial[0] != null ? monthOf(initial[0]).year : now.getFullYear());

  // Primer toque: inicio. Segundo: fin (si es anterior, se intercambian; el mismo mes = solo ese mes).
  const pick = (index) => {
    setSelection(([a, b]) => (a == null || b != null ? [index, null] : [Math.min(a, index), Math.max(a, index)]));
  };

  const lo = selection[0];
  const hi = selection[1] ?? selection[0];

  const apply = () => {
    const start = monthOf(lo);
    const end = monthOf(hi);
    onApply(new Date(start.year, start.month, 1, 0, 0, 0), new Date(end.year, end.month + 1, 0, 23, 59, 59));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <NavButton label="Año anterior" onClick={() => setYear((y) => y - 1)}>
          <IconChevronLeft width={16} height={16} />
        </NavButton>
        <span className="text-[13px] font-bold tabular-nums text-ink">{year}</span>
        <NavButton label="Año siguiente" onClick={() => setYear((y) => y + 1)} disabled={year >= now.getFullYear()}>
          <IconChevronRight width={16} height={16} />
        </NavButton>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MONTHS_SHORT.map((name, month) => {
          const index = year * 12 + month;
          const future = index > maxIndex;
          const edge = lo != null && (index === lo || index === hi);
          const between = lo != null && index > lo && index < hi;
          return (
            <button
              key={name}
              type="button"
              disabled={future}
              aria-pressed={edge || between}
              aria-label={`${capitalize(MONTHS_LONG[month])} de ${year}`}
              onClick={() => pick(index)}
              className={`h-10 rounded-[10px] text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:text-faint ${
                edge
                  ? "bg-primary text-white"
                  : between
                    ? "bg-primary-soft text-primary-soft-text"
                    : "text-ink-2 hover:bg-surface-2 disabled:hover:bg-transparent"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <p className="t-aux mt-3">Toca un mes, o dos para elegir un rango de meses.</p>
      <Summary>{lo != null ? monthsSummary(lo, hi) : "Sin meses elegidos"}</Summary>
      <Footer onReset={onReset} onApply={apply} canApply={lo != null} />
    </div>
  );
}

// PERSONALIZADO: campos Desde/Hasta (dd/mm/aaaa) + calendario de un mes.
function CustomPanel({ range, onApply, onReset }) {
  const today = new Date();
  const hasRange = Boolean(range.from && range.to);
  const [fromText, setFromText] = useState(hasRange ? formatInput(new Date(range.from)) : "");
  const [toText, setToText] = useState(hasRange ? formatInput(new Date(range.to)) : "");
  const [active, setActive] = useState("from");
  const [view, setView] = useState(() => {
    const base = hasRange ? new Date(range.from) : today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const toRef = useRef(null);

  const fromDate = parseInput(fromText);
  const toDate = parseInput(toText);
  // Una fecha a medio escribir no se marca en rojo hasta completarla o salir del campo.
  const fromInvalid = fromText !== "" && !fromDate && (fromText.length >= 10 || active !== "from");
  const toInvalid =
    toText !== "" &&
    ((!toDate && (toText.length >= 10 || active !== "to")) || Boolean(toDate && fromDate && dayIndex(toDate) < dayIndex(fromDate)));
  const canApply = Boolean(fromDate && toDate && !fromInvalid && !toInvalid);

  const onText = (field) => (e) => {
    const previous = field === "from" ? fromText : toText;
    let value = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
    // Al escribir hacia adelante, las barras se completan solas.
    if (value.length > previous.length && /^\d{2}(\/\d{2})?$/.test(value)) value += "/";
    if (field === "from") setFromText(value);
    else setToText(value);
    const date = parseInput(value);
    if (date) setView({ year: date.getFullYear(), month: date.getMonth() });
  };

  // Primer clic: «Desde» y el foco pasa a «Hasta». Segundo: «Hasta» (si es anterior, se intercambian).
  const pickDay = (date) => {
    const text = formatInput(date);
    if (active === "to" && fromDate) {
      if (dayIndex(date) < dayIndex(fromDate)) {
        setToText(formatInput(fromDate));
        setFromText(text);
      } else {
        setToText(text);
      }
      setActive("from");
    } else {
      setFromText(text);
      setToText("");
      setActive("to");
      toRef.current?.focus();
    }
  };

  const startIdx = fromDate ? dayIndex(fromDate) : null;
  const endIdx = fromDate && toDate && !toInvalid ? dayIndex(toDate) : startIdx;

  const apply = () =>
    onApply(
      new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0),
      new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59),
    );

  const field = (id, label, text, invalid, inputRef) => (
    <label className="block">
      <span className="t-aux mb-1 block">{label}</span>
      <span
        className={`flex h-9 items-center gap-1.5 rounded-[10px] border bg-surface-2 px-2.5 transition ${
          invalid ? "border-tone-rose-dot" : active === id ? "border-select-bar" : "border-line"
        }`}
      >
        <IconCalendar width={14} height={14} className="shrink-0 text-subtle" />
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={text}
          aria-invalid={invalid}
          onFocus={() => setActive(id)}
          onChange={onText(id)}
          className={`min-w-0 flex-1 bg-transparent text-[13px] tabular-nums !outline-none placeholder:text-faint ${
            invalid ? "text-tone-rose-text" : "text-ink"
          }`}
        />
      </span>
    </label>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {field("from", "Desde", fromText, fromInvalid)}
        {field("to", "Hasta", toText, toInvalid, toRef)}
      </div>

      <MonthCalendar className="mt-3" view={view} onViewChange={setView} startIdx={startIdx} endIdx={endIdx} onPick={pickDay} />

      <Summary>
        {canApply ? daysSummary(fromDate, toDate) : <span className="font-medium text-muted">Elige «Desde» y «Hasta».</span>}
      </Summary>
      <Footer onReset={onReset} onApply={apply} canApply={canApply} />
    </div>
  );
}

/*
  Control de 38px + popover para elegir el rango de fechas. Va en las
  acciones del PageHeader de Dashboard, Fabricación, Finanzas, Logística,
  Inventario, Pedidos y los historiales. El popover tiene tres pestañas:
    · Rápido: los PRESETS (Todo, Esta semana —el predeterminado—, 7/30 días,
      3/6/12 meses); al tocar uno se aplica y se cierra.
    · Por mes: cuadrícula de meses; uno o dos toques (rango de meses).
    · Personalizado: campos Desde/Hasta y calendario propio de un mes.
  Escribe en el DateRangeContext global (setPreset, setMonths, setCustom, reset).
*/
function DateRangePicker() {
  const range = useDateRange();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("rapido");
  const [align, setAlign] = useState("left");
  const ref = useRef(null);
  const buttonRef = useRef(null);

  // Al abrir, la pestaña activa sigue al rango vigente y el popover se alinea
  // al borde izquierdo del botón (o al derecho si no cabe en la ventana).
  const toggle = () => {
    if (!open) {
      setTab(range.granularity === "month" ? "mes" : range.preset ? "rapido" : "personalizado");
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const fitsRight = rect.left + POPOVER_WIDTH <= window.innerWidth - SCREEN_MARGIN;
        const fitsLeft = rect.right - POPOVER_WIDTH >= SCREEN_MARGIN;
        setAlign(fitsRight || !fitsLeft ? "left" : "right");
      }
    }
    setOpen((v) => !v);
  };

  // Cerrar con clic fuera y con Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (setter) => (from, to) => {
    setter(from, to);
    setOpen(false);
  };
  const reset = () => {
    range.reset();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex h-[38px] items-center gap-2 rounded-[10px] border bg-surface px-3.5 text-[12.5px] font-semibold text-ink-2 transition ${
          open ? "border-select-bar ring-2 ring-primary-soft" : "border-line hover:bg-surface-2"
        }`}
      >
        <IconCalendar width={16} height={16} className="text-subtle" />
        <span>{rangeLabel(range)}</span>
        <IconChevronDown width={14} height={14} className={`text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Rango de fechas"
          style={{ width: POPOVER_WIDTH }}
          className={`absolute top-full z-30 mt-2 max-w-[calc(100vw-16px)] rounded-[14px] border border-line bg-surface p-4 shadow-modal ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div role="tablist" aria-label="Tipo de rango" className="mb-3 grid grid-cols-3 gap-0.5 rounded-[10px] bg-surface-2 p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`h-8 rounded-[8px] text-[12.5px] font-semibold transition ${
                  tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === "rapido" ? (
              <QuickPanel
                range={range}
                onPick={(key) => {
                  range.setPreset(key);
                  setOpen(false);
                }}
              />
            ) : tab === "mes" ? (
              <MonthsPanel range={range} onApply={apply(range.setMonths)} onReset={reset} />
            ) : (
              <CustomPanel range={range} onApply={apply(range.setCustom)} onReset={reset} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DateRangePicker;
