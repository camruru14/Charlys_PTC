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
    fromDateOnly(d)        -> fecha guardada sin hora (medianoche UTC, p. ej.
                              startDate de un lote) como Date local del mismo día
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

export function fromDateOnly(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
