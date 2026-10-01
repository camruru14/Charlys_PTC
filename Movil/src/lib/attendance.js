import { formatClock, formatMonth, fromDateOnly } from "./format";

// Asistencia de empleados (Employee.attendance), portado de
// Web/private/frontend/src/lib/attendance.js. Todo cálculo recibe el horario
// laboral { startTime: "HH:MM", workdayHours } de GET /settings/work-schedule
// (hooks/useWorkSchedule.js).
//   Tarde     -> la entrada es posterior a startTime
//   Con extra -> trabajó más de workdayHours
//   Completo  -> ninguno de los anteriores
//   Ausente   -> día con marcaciones de otros empleados, pero no de este
//                (solo empleados activos y ya contratados ese día)

// Iguales a los del backend (models/WorkSchedule.js).
export const DEFAULT_WORK_SCHEDULE = { startTime: "07:00", workdayHours: 8 };

// Franja de la línea de tiempo del equipo: 06:00 a 18:00.
export const TIMELINE_START = 6 * 60;
export const TIMELINE_END = 18 * 60;

const pad = (n) => String(n).padStart(2, "0");

export function timeToMinutes(value) {
  const [h, m] = String(value || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// `date` se guarda como fecha sin hora (medianoche UTC).
export function recordDay(record) {
  return fromDateOnly(record.date) || validDate(record.checkIn);
}

// Horas trabajadas (de la entrada y la salida; si faltan, lo guardado) y
// horas extra por encima de la jornada.
export function recordHours(record, schedule) {
  const checkIn = validDate(record.checkIn);
  const checkOut = validDate(record.checkOut);
  const worked =
    checkIn && checkOut && checkOut > checkIn ? (checkOut - checkIn) / 3600000 : Number(record.workedHours) || 0;
  const overtime = Math.max(0, worked - schedule.workdayHours);
  return { worked, overtime };
}

export function attendanceStatus(record, schedule) {
  const checkIn = validDate(record.checkIn);
  const start = timeToMinutes(schedule.startTime);
  if (checkIn && start != null && minutesOfDay(checkIn) > start) return "Tarde";
  if (recordHours(record, schedule).overtime > 0.005) return "Con extra";
  return "Completo";
}

// 8 -> "8", 8.5 -> "8.5", 7.333 -> "7.3"
export function fmtHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 10) / 10;
  const decimals = Number.isInteger(rounded) ? 0 : 1;
  return rounded.toLocaleString("es-SV", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function monthDate(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

// "septiembre" (o "septiembre 2025" si no es el año en curso)
export function monthLabel(key, { withYear = false } = {}) {
  const d = monthDate(key);
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${formatMonth(d)} ${d.getFullYear()}` : formatMonth(d);
}

// Meses con marcaciones, del más reciente al más antiguo.
export function attendanceMonths(employees) {
  const keys = new Set();
  employees.forEach((emp) =>
    (emp.attendance || []).forEach((r) => {
      const d = recordDay(r);
      if (d) keys.add(monthKey(d));
    }),
  );
  return [...keys].sort().reverse();
}

// Mes en curso si tiene marcaciones; si no, el último mes con datos.
export function defaultMonth(employees) {
  const current = monthKey(new Date());
  const months = attendanceMonths(employees);
  return months.includes(current) || months.length === 0 ? current : months[0];
}

export const fullName = (emp) => `${emp?.name || ""} ${emp?.lastName || ""}`.trim();

function hiredBy(emp, day) {
  const hire = validDate(emp.hireDate);
  if (!hire) return true;
  hire.setHours(0, 0, 0, 0);
  return hire <= day;
}

// Días del mes con al menos una marcación, del más reciente al más antiguo:
//   [{ key, date, entries: [{ key, employee, record }], absent: [employee] }]
export function attendanceDays(employees, month) {
  const days = new Map();
  employees.forEach((employee) =>
    (employee.attendance || []).forEach((record, idx) => {
      const date = recordDay(record);
      if (!date || monthKey(date) !== month) return;
      const key = dayKey(date);
      if (!days.has(key)) days.set(key, { key, date, entries: [], absent: [] });
      days.get(key).entries.push({ key: `${employee._id}-${idx}`, employee, record });
    }),
  );

  const byName = (a, b) => fullName(a).localeCompare(fullName(b), "es");
  return [...days.values()]
    .sort((a, b) => b.date - a.date)
    .map((day) => {
      const present = new Set(day.entries.map((e) => String(e.employee._id)));
      day.entries.sort((a, b) => byName(a.employee, b.employee));
      day.absent = employees
        .filter((emp) => emp.isActive !== false && !present.has(String(emp._id)) && hiredBy(emp, day.date))
        .sort(byName);
      return day;
    });
}

// Filas de la ficha de un empleado en el mes: sus marcaciones y sus días ausentes.
export function employeeMonthRows(employee, days) {
  const id = String(employee._id);
  const rows = [];
  days.forEach((day) => {
    day.entries
      .filter((e) => String(e.employee._id) === id)
      .forEach((e) => rows.push({ key: e.key, date: day.date, record: e.record }));
    if (day.absent.some((emp) => String(emp._id) === id)) rows.push({ key: `${id}-${day.key}-ausente`, date: day.date, record: null });
  });
  return rows;
}

// Barra de la franja 06:00–18:00 (porcentajes del ancho). El tramo de jornada
// va de la entrada hasta workdayHours después (o la salida, si es antes) y el
// de hora extra desde ahí hasta la salida. null si falta entrada o salida.
export function timelineBar(record, schedule) {
  const checkIn = validDate(record.checkIn);
  const checkOut = validDate(record.checkOut);
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;

  const span = TIMELINE_END - TIMELINE_START;
  const clamp = (m) => Math.min(TIMELINE_END, Math.max(TIMELINE_START, m));
  const pct = (m) => ((clamp(m) - TIMELINE_START) / span) * 100;

  const start = minutesOfDay(checkIn);
  const end = start + (checkOut - checkIn) / 60000;
  const workdayEnd = Math.min(end, start + schedule.workdayHours * 60);

  return {
    left: pct(start),
    workday: pct(workdayEnd) - pct(start),
    extra: pct(end) - pct(workdayEnd),
    checkIn: formatClock(checkIn),
    checkOut: formatClock(checkOut),
  };
}

// --- Solo de la app -----------------------------------------------------------

// Totales del mes de un empleado (sus filas de employeeMonthRows).
export function monthTotals(rows, schedule) {
  return rows.reduce(
    (acc, r) => {
      if (!r.record) return acc;
      const { worked, overtime } = recordHours(r.record, schedule);
      return { worked: acc.worked + worked, overtime: acc.overtime + overtime };
    },
    { worked: 0, overtime: 0 },
  );
}

// Horas de un registro calculadas como las guarda la web al registrar una
// marcación (2 decimales).
export function hoursPayload(checkIn, checkOut, schedule) {
  const workedHours = Number(((checkOut - checkIn) / 3600000).toFixed(2));
  const overtimeHours = Number(Math.max(0, workedHours - schedule.workdayHours).toFixed(2));
  return { workedHours, overtimeHours };
}
