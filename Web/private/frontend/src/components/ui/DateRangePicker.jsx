import { useEffect, useRef, useState } from "react";
import { useDateRange, rangeLabel } from "../../context/dateRange";
import { IconCalendar } from "../../lib/icons";

// Date -> "yyyy-mm-dd" para el <input type="date">
function toInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

/*
  Control de 38px + popover para elegir el rango de fechas. Va en las
  acciones del PageHeader de Dashboard, Fabricación, Finanzas y los dos
  historiales. Ofrece presets (7/30 días, 3/6/12 meses) y un rango
  personalizado (desde/hasta). Escribe en el DateRangeContext global.
*/
function DateRangePicker() {
  const range = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toInput(range.from));
  const [to, setTo] = useState(toInput(range.to));
  const ref = useRef(null);

  // Al abrir, los inputs arrancan con el rango vigente (ej. tras elegir un preset)
  const toggle = () => {
    if (!open) {
      setFrom(toInput(range.from));
      setTo(toInput(range.to));
    }
    setOpen((v) => !v);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const applyCustom = () => {
    if (!from || !to) return;
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T23:59:59`);
    if (f > t) return;
    range.setCustom(f, t);
    setOpen(false);
  };

  const inputClass =
    "h-9 w-full rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] text-ink outline-none focus:border-select-bar";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-ink-2 transition hover:bg-surface-2"
      >
        <IconCalendar width={16} height={16} className="text-subtle" />
        <span>{rangeLabel(range)}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-[14px] border border-line bg-surface p-4 shadow-modal">
          <p className="t-label mb-2">Rangos rápidos</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(range.presets).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  range.setPreset(key);
                  setOpen(false);
                }}
                className={`h-[26px] rounded-[8px] px-2.5 text-[11.5px] font-semibold transition ${
                  range.preset === key ? "bg-primary text-white" : "bg-tone-gray text-tone-gray-text hover:text-ink"
                }`}
              >
                {p.label.replace("Últimos ", "")}
              </button>
            ))}
          </div>

          <div className="my-3 h-px bg-line-soft" />

          <p className="t-label mb-2">Rango personalizado</p>
          <div className="space-y-2">
            <label className="block">
              <span className="t-aux mb-1 block">Desde</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="t-aux mb-1 block">Hasta</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                range.reset();
                setOpen(false);
              }}
              className="text-[12px] font-semibold text-muted hover:text-ink"
            >
              Restablecer
            </button>
            <button
              type="button"
              onClick={applyCustom}
              className="h-[30px] rounded-[8px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-primary-hover"
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DateRangePicker;
