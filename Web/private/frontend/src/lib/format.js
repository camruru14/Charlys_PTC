/*
  Formato de cifras y fechas del panel (es-SV).
    fmtNumber(1234)        -> "1,234"
    fmtMoney(1234.5)       -> "$1,234.50"
    fmtDate(d)             -> "19 sep"
    fmtDateYear(d)         -> "19 sep 2026"
    fmtDateTime(d)         -> "19 sep · 14:10"
    fmtTime(d)             -> "09:40"
    fmtRelativeDay(d)      -> "hoy" | "ayer" | "19 sep"
*/

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

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
