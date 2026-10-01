import { createContext, useContext, useMemo, useState } from "react";

// Contexto global del rango de fechas — equivalente móvil de
// Web/private/frontend/src/context/DateRangeContext.jsx. Lo comparten el
// botón de rango en el header (DateRangeButton) y las pantallas que filtran
// por fecha: DashboardScreen, FabricacionScreen, FinanzasScreen,
// BatchHistoryScreen, HistorialTransaccionesScreen. InventarioScreen NO lo
// usa — Inventario.jsx tampoco lo usa en la web.
const DateRangeContext = createContext(null);

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Lunes de esta semana a las 00:00 (igual que «Esta semana» de la web).
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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

const PRESETS = {
  all: { label: "Todo" },
  week: { week: true, label: "Esta semana" },
  "7d": { days: 7, label: "Últimos 7 días" },
  "30d": { days: 30, label: "Últimos 30 días" },
  "3m": { months: 3, label: "Últimos 3 meses" },
  "6m": { months: 6, label: "Últimos 6 meses" },
  "365d": { days: 365, label: "Últimos 12 meses" },
};

// Etiqueta legible del rango actual (para el botón del header).
export function rangeLabel(range) {
  if (range.preset && PRESETS[range.preset]) return PRESETS[range.preset].label;
  const opts = { day: "2-digit", month: "short" };
  const f = range.from?.toLocaleDateString("es-SV", opts);
  const t = range.to?.toLocaleDateString("es-SV", opts);
  return `${f} – ${t}`;
}

// Rango con el que arranca la app (y al que vuelve reset): esta semana, como
// en la web (DEFAULT_PRESET de context/dateRange.js). No es «Todo».
function weekRange() {
  return { from: startOfWeek(), to: endOfToday(), preset: "week" };
}

export function DateRangeProvider({ children }) {
  const [range, setRange] = useState(weekRange);

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
        const from = p.week ? startOfWeek() : p.months ? monthsAgo(p.months) : daysAgo(p.days);
        setRange({ from, to: endOfToday(), preset });
      },
      // from/to son objetos Date (inicio y fin de día).
      setCustom: (from, to) => setRange({ from, to, preset: null }),
      reset: () => setRange(weekRange()),
    }),
    [range],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within a DateRangeProvider");
  return ctx;
}

export default DateRangeContext;
