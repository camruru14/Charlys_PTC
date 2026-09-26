import { useMemo, useState } from "react";
import { DateRangeContext, PRESETS, DEFAULT_PRESET } from "./dateRange";

/*
  Provider del rango de fechas global (ver context/dateRange.js para el
  contexto, los presets, rangeLabel y el hook useDateRange).
*/

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Primer día del mes que abre los últimos n meses calendario, contando el
// actual (6 meses en septiembre = desde el 1 de abril: «Abr – sep»).
function monthsAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return d;
}

// Lunes de esta semana a las 00:00.
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function presetRange(preset) {
  const p = PRESETS[preset];
  // "Todo" desactiva el rango: from/to null = sin filtrar por fecha.
  if (preset === "all") return { from: null, to: null, preset };
  const from = p.week ? startOfWeek() : p.months ? monthsAgo(p.months) : daysAgo(p.days);
  return { from, to: endOfToday(), preset };
}

// Rango por defecto (al entrar y al «Restablecer»): DEFAULT_PRESET, esta semana.
function defaultRange() {
  return presetRange(DEFAULT_PRESET);
}

export function DateRangeProvider({ children }) {
  const [range, setRange] = useState(defaultRange);

  const value = useMemo(
    () => ({
      ...range,
      presets: PRESETS,
      setPreset: (preset) => {
        if (!PRESETS[preset]) return;
        setRange(presetRange(preset));
      },
      // from/to son objetos Date (inicio y fin de día).
      setCustom: (from, to) => setRange({ from, to, preset: null }),
      reset: () => setRange(defaultRange()),
    }),
    [range],
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export default DateRangeProvider;
