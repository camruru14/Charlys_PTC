/*
  Formato de cifras y fechas del panel (es-SV).
    fmtNumber(1234)        -> "1,234"
    fmtMoney(1234.5)       -> "$1,234.50"
    fmtDate(d)             -> "19 sep"
    fmtDateYear(d)         -> "19 sep 2026"
    fmtDateTime(d)         -> "19 sep · 14:10"
    fmtTime(d)             -> "09:40"
    fmtRelativeDay(d)      -> "hoy" | "ayer" | "19 sep"
    fmtElapsed(d)          -> "hace 2 h 10 min"
    fmtDay2(d)           -> "02 sep" (día con dos dígitos, ejes de gráficas)
    fmtMonth(d)            -> "septiembre"
    fmtWeekdayDate(d)      -> "vie 19 sep"
    fmtDayLong(d)          -> "Viernes 19 de septiembre"
    fromDateOnly(d)        -> fecha guardada sin hora (medianoche UTC, p. ej.
                              startDate de un lote) como Date local del mismo día
    fmtRange(a, b)         -> "1 – 19 sep 2026" | "22 sep – 3 oct 2026"
    fmtRange(a, b, { months: true }) -> "Abr – sep 2026"
    fmtCompactMoney(20000) -> "$20k" (ejes de gráficas)
    fmtPercent(0.123)      -> "+12%"
*/

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtNumber(value, decimals = 0) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-SV", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtMoney(value, decimals = 2) {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${fmtNumber(Math.abs(n), decimals)}`;
}

export function fmtDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateYear(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${fmtDate(d)} ${d.getFullYear()}`;
}

export function fmtTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}

export function fmtDay2(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

export function fmtMonth(value) {
  const d = toDate(value);
  if (!d) return "—";
  return MONTHS_LONG[d.getMonth()];
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function fmtWeekdayDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${fmtDate(d)}`;
}

export function fmtDayLong(value) {
  const d = toDate(value);
  if (!d) return "—";
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

export function fromDateOnly(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Rango de fechas legible. Omite lo que se repite (mes y/o año del inicio).
export function fmtRange(fromValue, toValue, { months = false } = {}) {
  const a = toDate(fromValue);
  const b = toDate(toValue);
  if (!a || !b) return "—";
  const sameYear = a.getFullYear() === b.getFullYear();
  if (months) {
    const start = sameYear ? MONTHS[a.getMonth()] : `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    if (sameYear && a.getMonth() === b.getMonth()) return `${capitalize(MONTHS[b.getMonth()])} ${b.getFullYear()}`;
    return `${capitalize(start)} – ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  let start;
  if (!sameYear) start = fmtDateYear(a);
  else if (a.getMonth() !== b.getMonth()) start = fmtDate(a);
  else start = String(a.getDate());
  if (sameYear && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()) return fmtDateYear(b);
  return `${start} – ${fmtDateYear(b)}`;
}

export function fmtCompactMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const short = (v, unit) => `${sign}$${fmtNumber(v, Number.isInteger(v) ? 0 : 1)}${unit}`;
  if (abs >= 1e6) return short(Math.round((abs / 1e6) * 10) / 10, "M");
  if (abs >= 1e3) return short(Math.round((abs / 1e3) * 10) / 10, "k");
  return `${sign}$${fmtNumber(abs)}`;
}

export function fmtPercent(ratio) {
  const pct = Math.round((Number(ratio) || 0) * 100);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${fmtNumber(Math.abs(pct))}%`;
}

// Tiempo transcurrido: "hace 2 h 10 min", "hace 5 min", "hace un momento".
export function fmtElapsed(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return "—";
  const minutes = Math.max(0, Math.floor((now - d.getTime()) / 60000));
  if (minutes < 1) return "hace un momento";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `hace ${m} min`;
  return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
}

export function fmtRelativeDay(value) {
  const d = toDate(value);
  if (!d) return "—";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start - day) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  return fmtDate(d);
}
