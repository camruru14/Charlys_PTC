import { useEffect, useRef, useState } from "react";
import { useDateRange, rangeLabel } from "../../context/DateRangeContext";
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
  Botón + popover para elegir el rango de fechas.
  Ofrece presets (7/30 días, 3/6/12 meses) y un rango personalizado (desde/hasta).
  Escribe en el DateRangeContext global.
*/
function DateRangePicker() {
  const range = useDateRange();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toInput(range.from));
  const [to, setTo] = useState(toInput(range.to));
  const ref = useRef(null);

  // Sincroniza los inputs cuando cambia el rango (ej. al elegir un preset)
  useEffect(() => {
    setFrom(toInput(range.from));
    setTo(toInput(range.to));
  }, [range.from, range.to]);

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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300"
      >
        <IconCalendar width={18} height={18} className="text-slate-400" />
        <span>{rangeLabel(range)}</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rangos rápidos
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(range.presets).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  range.setPreset(key);
                  setOpen(false);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range.preset === key
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label.replace("Últimos ", "")}
              </button>
            ))}
          </div>

          <div className="my-3 h-px bg-slate-100" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rango personalizado
          </p>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Desde</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Hasta</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                range.reset();
                setOpen(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Restablecer
            </button>
            <button
              type="button"
              onClick={applyCustom}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
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
