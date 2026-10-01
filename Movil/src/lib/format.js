// Utilidades de formato compartidas por las pantallas de la Fase 2, para no
// repetir Intl.NumberFormat/Date en cada pantalla. Mismo criterio ("es-SV")
// que Web/private/frontend/src/pages/Dashboard.jsx.
export function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-SV");
}

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("es-SV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Utilidades para los date pickers de la Fase 3 (startDate/endDate de lotes,
// date de lotes diarios y transacciones): el valor de formulario se guarda
// como "yyyy-mm-dd" (mismo criterio que todayInput()/toDateInput() de
// Web/private/frontend/src/hooks/useBatchForm.js), y se manda tal cual al
// backend, que lo castea a medianoche UTC de ese día calendario.
// "Hoy" en el calendario LOCAL del dispositivo -> "yyyy-mm-dd".
export function todayInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

// Fecha ya guardada (instante UTC) -> "yyyy-mm-dd" para precargar el
// formulario. Se lee en UTC (no en el huso local) porque así fue guardada:
// evita correrla un día hacia atrás en husos detrás de UTC (ej. El Salvador).
export function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Hora local (ej. "07:32 a. m."), usada por Marcar Asistencia (Fase 4) para
// mostrar checkIn/checkOut. A diferencia de formatDate, estos sí son
// instantes reales (new Date() al marcar), así que se leen en el huso local.
export function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" });
}

// ---- Formatos portados de Web/private/frontend/src/lib/format.js ----
// Se escriben a mano (sin Intl de fechas) para que den lo mismo en el panel
// y en el celular.
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// formatMoney(1234.5) -> "$1,234.50"; formatMoney(1234.5, 0) -> "$1,235"
export function formatMoney(value, decimals = 2) {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("es-SV", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// 0.123 -> "+12%"
export function formatPercent(ratio) {
  const pct = Math.round((Number(ratio) || 0) * 100);
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${formatNumber(Math.abs(pct))}%`;
}

// "19 sep"
export function formatShortDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// "19 sep 2026"
export function formatDateYear(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatShortDate(d)} ${d.getFullYear()}`;
}

// "09:40" (24 h)
export function formatClock(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "19 sep · 14:10"
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatShortDate(d)} · ${formatClock(d)}`;
}

// Fecha guardada sin hora (medianoche UTC, ej. startDate de un lote) como
// Date local del mismo día.
export function fromDateOnly(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// "hoy" | "ayer" | "19 sep"
export function formatRelativeDay(value) {
  const d = toDate(value);
  if (!d) return "—";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((start - day) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  return formatShortDate(d);
}

// Antigüedad para listas: "hace 5 min", "hace 3 h", "ayer", "hace 4 días",
// y la fecha ("19 sep") pasada una semana.
export function formatAge(value, now = new Date()) {
  const d = toDate(value);
  if (!d) return "";
  const minutes = Math.max(0, Math.floor((now - d) / 60000));
  const relative = formatRelativeDay(d);
  if (relative === "hoy") {
    if (minutes < 1) return "hace un momento";
    if (minutes < 60) return `hace ${minutes} min`;
    return `hace ${Math.floor(minutes / 60)} h`;
  }
  if (relative === "ayer") return "ayer";
  const days = Math.floor(minutes / 1440);
  return days < 7 ? `hace ${days} días` : formatShortDate(d);
}

// Formatea un DUI de 9 dígitos guardados sin guión (ver
// EmpleadoFormScreen.handleDuiChange) al formato "########-#" que usa el
// panel web. Si no son 9 dígitos, se muestra tal cual.
export function formatDui(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 9) return value;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}
