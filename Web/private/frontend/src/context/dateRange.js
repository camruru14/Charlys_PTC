import { createContext, useContext } from "react";

/*
  Contexto global del rango de fechas. Lo comparten el DateRangePicker (en
  las acciones del PageHeader) y las páginas que filtran por fecha
  (Dashboard, Fabricación, Finanzas y los historiales). El Provider vive en
  DateRangeContext.jsx.
*/
export const DateRangeContext = createContext(null);

export const PRESETS = {
  all: { label: "Todo" },
  week: { week: true, label: "Esta semana" },
  "7d": { days: 7, label: "Últimos 7 días" },
  "30d": { days: 30, label: "Últimos 30 días" },
  "3m": { months: 3, label: "Últimos 3 meses" },
  "6m": { months: 6, label: "Últimos 6 meses" },
  "365d": { days: 365, label: "Últimos 12 meses" },
};

// Etiqueta legible del rango actual (para el botón del selector).
export function rangeLabel(range) {
  if (range.preset && PRESETS[range.preset]) return PRESETS[range.preset].label;
  const opts = { day: "2-digit", month: "short" };
  const f = range.from?.toLocaleDateString("es-SV", opts);
  const t = range.to?.toLocaleDateString("es-SV", opts);
  return `${f} – ${t}`;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within a DateRangeProvider");
  return ctx;
}
