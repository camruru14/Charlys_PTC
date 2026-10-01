import { createContext, useContext } from "react";
import { fmtRange } from "../lib/format";

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

// Rango con el que arrancan Dashboard, Fabricación, Finanzas y los
// historiales (y al que vuelve «Restablecer»). No es «Todo».
export const DEFAULT_PRESET = "week";

// Etiqueta legible del rango actual (botón del selector): las fechas reales
// («1 – 19 sep 2026»; por meses «Abr – sep 2026»); «Todo» sin rango.
export function rangeLabel(range) {
  if (!range.from || !range.to) return PRESETS.all.label;
  return fmtRange(range.from, range.to, { months: Boolean(PRESETS[range.preset]?.months) });
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within a DateRangeProvider");
  return ctx;
}
