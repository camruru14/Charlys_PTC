import { useEffect, useMemo, useState } from "react";
import { DateRangeContext, PRESETS, DEFAULT_PRESET } from "./dateRange";

/*
  Provider del rango de fechas global (ver context/dateRange.js para el
  contexto, los presets, rangeLabel y el hook useDateRange).

  Se guarda la ELECCIÓN, no las fechas: un preset («Esta semana», «Últimos 7
  días»…) guarda solo { preset } y sus fechas se calculan con el día de hoy;
  un rango personalizado o por meses guarda { from, to } (esas sí son fijas).
  `today` es la clave del día local («2026-10-14»): cambia sola a la medianoche
  y al volver a la pestaña, y con ella se recalcula el rango. Así, con el panel
  abierto pasada la medianoche, «hasta hoy» sigue siendo hoy.
*/

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

// Primer día del mes que abre los últimos n meses calendario, contando el
// actual (6 meses en septiembre = desde el 1 de abril: «Abr – sep»).
function monthsAgo(today, n) {
  const d = new Date(today);
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return d;
}

// Lunes de esta semana a las 00:00.
function startOfWeek(today) {
  const d = new Date(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function endOfDay(today) {
  const d = new Date(today);
  d.setHours(23, 59, 59, 999);
  return d;
}

function presetRange(preset, today) {
  // "Todo" desactiva el rango: from/to null = sin filtrar por fecha.
  if (preset === "all") return { from: null, to: null, preset };
  const p = PRESETS[preset];
  // «Últimos n días» cuenta n días calendario contando hoy (7 días el 14-oct: del 8 al 14).
  const from = p.week ? startOfWeek(today) : p.months ? monthsAgo(today, p.months) : daysAgo(today, p.days - 1);
  return { from, to: endOfDay(today), preset };
}

export function DateRangeProvider({ children }) {
  // Elección: { preset } o { from, to, preset: null, granularity? }.
  const [selection, setSelection] = useState({ preset: DEFAULT_PRESET });
  const [today, setToday] = useState(() => localDayKey());

  // El día cambia: a la próxima medianoche local (se reprograma cada día) y al volver a la
  // pestaña o a la ventana (un equipo suspendido o una pestaña dormida no disparan el timer a tiempo).
  useEffect(() => {
    let timer;
    const sync = () => setToday((prev) => {
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
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
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
      // Rango por meses (pestaña «Por mes»): del 1.º del primer mes al último
      // día del último. Igual que un rango personalizado (preset null) pero
      // marcado con granularity "month" para la etiqueta y para reabrir el
      // selector en la pestaña correcta.
      setMonths: (from, to) => setSelection({ from, to, preset: null, granularity: "month" }),
      reset: () => setSelection({ preset: DEFAULT_PRESET }),
    }),
    [range],
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export default DateRangeProvider;
