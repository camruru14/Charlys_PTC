/*
  Tiempo de la empresa: hora de El Salvador (UTC−6 todo el año, sin horario de verano).
  Aquí viven el calendario laboral (domingos y feriados cerrados, sábado hasta el mediodía) y las
  funciones para avanzar por horas de trabajo.
*/
export const SV_OFFSET_H = 6;
const HOUR = 3600000;
const MIN = 60000;
export const DAY = 24 * HOUR;

const pad = (n) => String(n).padStart(2, "0");

// «AAAA-MM-DD» del día de El Salvador de un instante.
export const dayKeyOf = (date) => new Date(date.getTime() - SV_OFFSET_H * HOUR).toISOString().slice(0, 10);

// Instante de las hh:mm (hora de El Salvador) de un día «AAAA-MM-DD».
export function svTime(key, hour = 0, minute = 0, second = 0, ms = 0) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour + SV_OFFSET_H, minute, second, ms));
}

// Medianoche UTC de un día (así guardan las fechas sin hora: Route.date, Transaction.date, asistencia).
export const midnightUTC = (key) => new Date(`${key}T00:00:00.000Z`);

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diffDays = (a, b) => Math.round((midnightUTC(b) - midnightUTC(a)) / DAY);

// 0 = domingo … 6 = sábado
export const dowOf = (key) => midnightUTC(key).getUTCDay();

export const monthOfKey = (key) => key.slice(0, 7);

export function daysBetween(fromKey, toKey) {
  const out = [];
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) out.push(k);
  return out;
}

export const lastDayOfMonth = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return `${monthKey}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};

// Feriados de El Salvador de 2026 (los que pidió la empresa): 1 ene, Jueves/Viernes/Sábado Santo
// (Pascua es el 5 de abril), 1 may, 10 may, 17 jun, 6 ago, 15 sep y 2 nov.
export const HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-05-01",
  "2026-05-10",
  "2026-06-17",
  "2026-08-06",
  "2026-09-15",
  "2026-11-02",
]);
export const isHoliday = (key) => HOLIDAYS_2026.has(key);

// Semana Santa 2026 (para la estacionalidad de las compras de la tienda).
export const HOLY_WEEK_START = "2026-03-30";
export const HOLY_WEEK_END = "2026-04-12";

// Ventana de trabajo del día [hora inicio, hora fin] o null si está cerrado.
// Lunes a viernes 07:00–17:00, sábado 07:00–12:00, domingo y feriados cerrado.
export function workWindow(key) {
  const dow = dowOf(key);
  if (dow === 0 || isHoliday(key)) return null;
  return dow === 6 ? [7, 12] : [7, 17];
}
// ¿Es día laborable de oficina (lunes a viernes sin feriado)? La asistencia se registra solo así
// (más los sábados de quien trabaja ese día).
export const isWeekday = (key) => {
  const dow = dowOf(key);
  return dow >= 1 && dow <= 5 && !isHoliday(key);
};

// Primer instante >= ts dentro de una ventana de trabajo.
export function nextOpenTime(ts) {
  let key = dayKeyOf(ts);
  for (let guard = 0; guard < 40; guard += 1) {
    const w = workWindow(key);
    if (w) {
      const start = svTime(key, w[0]);
      const end = svTime(key, w[1]);
      if (ts < start) return start;
      if (ts < end) return ts;
    }
    key = addDays(key, 1);
    ts = svTime(key, 0);
  }
  throw new Error("nextOpenTime: sin días hábiles");
}

// Avanza `minutes` minutos de trabajo desde ts (saltando noches, domingos y feriados).
export function addWorkMinutes(ts, minutes) {
  let t = nextOpenTime(ts);
  let remaining = minutes;
  for (let guard = 0; guard < 400; guard += 1) {
    const key = dayKeyOf(t);
    const end = svTime(key, workWindow(key)[1]);
    const available = (end - t) / MIN;
    if (remaining <= available) return new Date(t.getTime() + remaining * MIN);
    remaining -= available;
    t = nextOpenTime(end);
  }
  throw new Error("addWorkMinutes: demasiado lejos");
}

export const minutes = (n) => n * MIN;
export const hours = (n) => n * HOUR;
export { pad };
