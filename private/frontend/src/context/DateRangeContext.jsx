import { createContext, useContext, useMemo, useState } from "react";

/*
  Contexto global del rango de fechas.
  Lo comparten el TopBar (selector) y las páginas que filtran por fecha
  (Dashboard, Finanzas e Historial de Lotes).
*/
const DateRangeContext = createContext(null);

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

const PRESETS = {
  "7d": { days: 7, label: "Últimos 7 días" },
  "30d": { days: 30, label: "Últimos 30 días" },
  "90d": { days: 90, label: "Últimos 90 días" },
  "365d": { days: 365, label: "Últimos 12 meses" },
};

// Etiqueta legible del rango actual (para el botón del TopBar).
export function rangeLabel(range) {
  if (range.preset && PRESETS[range.preset]) return PRESETS[range.preset].label;
  const opts = { day: "2-digit", month: "short" };
  const f = range.from?.toLocaleDateString("es-SV", opts);
  const t = range.to?.toLocaleDateString("es-SV", opts);
  return `${f} – ${t}`;
}

export function DateRangeProvider({ children }) {
  const [range, setRange] = useState({
    from: daysAgo(30),
    to: endOfToday(),
    preset: "30d",
  });

  const value = useMemo(
    () => ({
      ...range,
      presets: PRESETS,
      setPreset: (preset) => {
        const p = PRESETS[preset];
        if (!p) return;
        setRange({ from: daysAgo(p.days), to: endOfToday(), preset });
      },
      // from/to son objetos Date (inicio y fin de día).
      setCustom: (from, to) => setRange({ from, to, preset: null }),
      reset: () => setRange({ from: daysAgo(30), to: endOfToday(), preset: "30d" }),
    }),
    [range],
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within a DateRangeProvider");
  return ctx;
}

export default DateRangeContext;
