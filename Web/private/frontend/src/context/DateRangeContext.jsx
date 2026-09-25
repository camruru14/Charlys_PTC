import { useMemo, useState } from "react";
import { DateRangeContext, PRESETS } from "./dateRange";

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

function monthsAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function DateRangeProvider({ children }) {
  const [range, setRange] = useState({
    from: null,
    to: null,
    preset: "all",
  });

  const value = useMemo(
    () => ({
      ...range,
      presets: PRESETS,
      setPreset: (preset) => {
        const p = PRESETS[preset];
        if (!p) return;
        // "Todo" desactiva el rango: from/to null = sin filtrar por fecha.
        if (preset === "all") {
          setRange({ from: null, to: null, preset });
          return;
        }
        const from = p.months ? monthsAgo(p.months) : daysAgo(p.days);
        setRange({ from, to: endOfToday(), preset });
      },
      // from/to son objetos Date (inicio y fin de día).
      setCustom: (from, to) => setRange({ from, to, preset: null }),
      reset: () => setRange({ from: null, to: null, preset: "all" }),
    }),
    [range],
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export default DateRangeProvider;
