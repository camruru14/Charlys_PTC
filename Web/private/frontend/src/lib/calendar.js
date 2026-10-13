/*
  Utilidades de calendario compartidas por DateRangePicker, MonthCalendar y DatePicker (sin React).
  Las fechas «de un día» viajan como texto «AAAA-MM-DD» (el mismo formato de todayInput() y del
  <input type="date"> que reemplazan) y se leen siempre en el calendario LOCAL.
*/

export const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
// De lunes a domingo (la semana del calendario empieza en lunes).
export const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
// Indexado como Date#getDay(): domingo = 0.
export const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Número de día (sin horas ni husos) para comparar y contar días.
export const dayIndex = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);

// «martes 13 de octubre de 2026», para los aria-label de los días.
export const longDateLabel = (date) => `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;

// "dd/mm/aaaa" -> Date local a las 00:00, o null si no es una fecha real.
export function parseInput(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900) return null;
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 ? date : null;
}

export function formatInput(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// Date local -> «AAAA-MM-DD».
export function toInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// «AAAA-MM-DD» -> Date local a las 00:00, o null si está vacío o no es una fecha real.
export function fromInput(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text || "");
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.getMonth() === Number(m[2]) - 1 ? date : null;
}

// «AAAA-MM-DD» de hoy más `days` días.
export function inDays(days, from = new Date()) {
  return toInput(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}

// «AAAA-MM-DD» del último día del mes de `from`.
export function endOfMonthInput(from = new Date()) {
  return toInput(new Date(from.getFullYear(), from.getMonth() + 1, 0));
}
