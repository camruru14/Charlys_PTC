import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { MONTHS_LONG } from "../lib/dashboard";

// Contexto global del rango de fechas — equivalente móvil de
// Web/private/frontend/src/context/DateRangeContext.jsx. Lo comparten el
// botón de rango en el header (DateRangeButton) y las pantallas que filtran
// por fecha: DashboardScreen, FabricacionScreen, FinanzasScreen,
// BatchHistoryScreen. InventarioScreen NO lo
// usa — Inventario.jsx tampoco lo usa en la web.
//
// Se guarda la ELECCIÓN, no las fechas: un preset («Este mes», «Últimos 7
// días»…) guarda solo { preset } y sus fechas se calculan con el día de hoy;
// un rango personalizado guarda { from, to } (esas sí son fijas). `today` es la
// clave del día local («2026-10-14»): cambia sola a la medianoche y al volver a
// la app (AppState «active»), y con ella se recalcula el rango. Así, con la app
// abierta pasada la medianoche, «hasta hoy» sigue siendo hoy.
const DateRangeContext = createContext(null);

// Clave «AAAA-MM-DD» del día local de `date`.
function localDayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Medianoche local de una clave «AAAA-MM-DD».
function keyToDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Hace n días a las 00:00 (`today` ya está a las 00:00).
function daysAgo(today, n) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
}

// Día 1 del mes actual a las 00:00 (igual que «Este mes» de la web).
function startOfMonth(today) {
  const d = new Date(today);
  d.setDate(1);
  return d;
}

// Lunes de esta semana a las 00:00 (igual que «Esta semana» de la web).
function startOfWeek(today) {
  const d = new Date(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Primer día del mes que abre los últimos n meses calendario, contando el
// actual (6 meses en septiembre = desde el 1 de abril). Igual que la web.
function monthsAgo(today, n) {
  const d = new Date(today);
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return d;
}

function endOfDay(today) {
  const d = new Date(today);
  d.setHours(23, 59, 59, 999);
  return d;
}

const PRESETS = {
  all: { label: "Todo" },
  month: { month: true, label: "Este mes" },
  week: { week: true, label: "Esta semana" },
  "7d": { days: 7, label: "Últimos 7 días" },
  "30d": { days: 30, label: "Últimos 30 días" },
  "3m": { months: 3, label: "Últimos 3 meses" },
  "6m": { months: 6, label: "Últimos 6 meses" },
  "365d": { days: 365, label: "Últimos 12 meses" },
};

// Rango con el que arranca la app (y al que vuelve reset): el mes en curso,
// como en la web (DEFAULT_PRESET de context/dateRange.js). No es «Todo».
const DEFAULT_PRESET = "month";

function presetRange(preset, today) {
  // "Todo" desactiva el rango: from/to null = sin filtrar por fecha.
  if (preset === "all") return { from: null, to: null, preset };
  const p = PRESETS[preset];
  // «Últimos n días» cuenta n días calendario contando hoy (7 días el 14-oct: del 8 al 14).
  const from = p.month ? startOfMonth(today) : p.week ? startOfWeek(today) : p.months ? monthsAgo(today, p.months) : daysAgo(today, p.days - 1);
  return { from, to: endOfDay(today), preset };
}

// Etiqueta legible del rango actual (para el botón del header). «Este mes» muestra
// el mes y el año («Octubre 2026»), como en la web.
export function rangeLabel(range) {
  if (range.preset === "month" && range.from) {
    const name = MONTHS_LONG[range.from.getMonth()];
    return `${name[0].toUpperCase()}${name.slice(1)} ${range.from.getFullYear()}`;
  }
  if (range.preset && PRESETS[range.preset]) return PRESETS[range.preset].label;
  const opts = { day: "2-digit", month: "short" };
  const f = range.from?.toLocaleDateString("es-SV", opts);
  const t = range.to?.toLocaleDateString("es-SV", opts);
  return `${f} – ${t}`;
}

export function DateRangeProvider({ children }) {
  // Elección: { preset } o { from, to, preset: null }.
  const [selection, setSelection] = useState({ preset: DEFAULT_PRESET });
  const [today, setToday] = useState(() => localDayKey());

  // El día cambia: a la próxima medianoche local (se reprograma cada día) y al volver a la
  // app (con la app en segundo plano el timer no corre a tiempo).
  useEffect(() => {
    let timer;
    const sync = () =>
      setToday((prev) => {
        const key = localDayKey();
        return key === prev ? prev : key;
      });
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        sync();
        schedule();
      }, nextMidnight - now);
    };
    schedule();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      sync();
      // El timer pudo quedar dormido: se reprograma con la hora actual.
      clearTimeout(timer);
      schedule();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  // from/to: un preset se calcula con `today`; un rango elegido a mano se conserva tal cual.
  const range = useMemo(
    () => (selection.preset ? presetRange(selection.preset, keyToDate(today)) : selection),
    [selection, today],
  );

  const value = useMemo(
    () => ({
      ...range,
      presets: PRESETS,
      setPreset: (preset) => {
        if (!PRESETS[preset]) return;
        setSelection((prev) => (prev.preset === preset ? prev : { preset }));
      },
      // from/to son objetos Date (inicio y fin de día).
      setCustom: (from, to) => setSelection({ from, to, preset: null }),
      reset: () => setSelection({ preset: DEFAULT_PRESET }),
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
