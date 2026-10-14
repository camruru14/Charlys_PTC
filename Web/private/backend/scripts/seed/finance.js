import * as T from "./time.js";
import { employedOn } from "./people.js";

/*
  Asistencia, planilla y movimientos de Finanzas (además de las ventas de la tienda).
  La asistencia se calcula como lo hace el sistema: horas = salida − entrada; extra = lo que pase de
  workdayHours; «tarde» = entrada después de startTime.
*/

const r2 = (n) => Math.round(n * 100) / 100;
const roundTo = (n, step) => Math.round(n / step) * step;
const MIN = 60000;

// ---- Asistencia -----------------------------------------------------------------------------

export function generateAttendance({ rng, employees, startKey, todayKey, now, schedule }) {
  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const workday = schedule.workdayHours;
  const days = T.daysBetween(startKey, todayKey);
  for (const emp of employees) {
    // Una semana de vacaciones para casi todos (entre mayo y septiembre).
    let vacation = null;
    if (rng.chance(0.7)) {
      const start = T.addDays("2026-05-04", 7 * rng.int(0, 20));
      vacation = { from: start, to: T.addDays(start, 4) };
    }
    const saturdayWorker = /operari|auxiliar|motorista/i.test(emp.position) && rng.chance(0.55);
    const records = [];
    for (const key of days) {
      if (!employedOn(emp, key)) continue;
      const dow = T.dowOf(key);
      const weekday = T.isWeekday(key);
      const saturday = dow === 6 && !T.isHoliday(key) && saturdayWorker && rng.chance(0.4);
      if (!weekday && !saturday) continue;
      if (vacation && key >= vacation.from && key <= vacation.to) continue;
      if (weekday && rng.chance(0.035)) continue; // falta
      const late = rng.chance(0.2);
      const inMinutes = late ? sh * 60 + sm + Math.round(1 + Math.abs(rng.normal(0, 14))) : sh * 60 + sm - rng.int(0, 22);
      const checkIn = T.svTime(key, 0, 0, rng.int(0, 59));
      checkIn.setTime(checkIn.getTime() + (inMinutes + 6 * 60) * MIN);
      let hoursWorked;
      if (saturday) hoursWorked = 5 + rng.range(-0.1, 0.2);
      else if (rng.chance(0.17)) hoursWorked = workday + rng.range(0.5, 3);
      else if (rng.chance(0.05)) hoursWorked = workday - rng.range(0.5, 1.5);
      else hoursWorked = workday + rng.range(-0.1, 0.25);
      const checkOut = new Date(checkIn.getTime() + Math.round(hoursWorked * 60) * MIN);
      if (checkOut > now) continue; // la marcación de hoy solo existe una vez que ya salió
      const workedHours = Number(((checkOut - checkIn) / 3600000).toFixed(2));
      const overtimeHours = Number(Math.max(0, workedHours - workday).toFixed(2));
      records.push({ date: T.midnightUTC(key), checkIn, checkOut, overtimeHours, workedHours });
    }
    emp.attendance = records;
  }
}

// ---- Planilla ---------------------------------------------------------------------------------

// Fecha de pago: el 15 y el último día del mes; si cae en fin de semana o feriado, el día hábil anterior.
function payday(key) {
  let k = key;
  while (!T.isWeekday(k)) k = T.addDays(k, -1);
  return k;
}

export function payPeriods(startKey, todayKey) {
  const out = [];
  const months = [];
  for (let m = startKey.slice(0, 7); m <= todayKey.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  for (const m of months) {
    const last = T.lastDayOfMonth(m);
    out.push({ from: `${m}-01`, to: `${m}-15`, pay: payday(`${m}-15`) });
    out.push({ from: `${m}-16`, to: last, pay: payday(last) });
  }
  return out.filter((p) => p.from <= todayKey);
}

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Planilla de una quincena con la asistencia y el valor por hora (extra al 150 %).
// Si la quincena no ha terminado, se proyecta con la jornada completa de los días que faltan.
export function payrollFor(period, employees, todayKey) {
  let total = 0;
  for (const emp of employees) {
    for (const rec of emp.attendance) {
      const key = rec.date.toISOString().slice(0, 10);
      if (key < period.from || key > period.to) continue;
      const regular = rec.workedHours - rec.overtimeHours;
      total += regular * emp.hourlyRate + rec.overtimeHours * emp.hourlyRate * 1.5;
    }
    if (period.to > todayKey) {
      for (let k = T.addDays(todayKey, 1); k <= period.to; k = T.addDays(k, 1)) {
        if (T.isWeekday(k) && employedOn(emp, k)) total += 8 * emp.hourlyRate;
      }
    }
  }
  return r2(total);
}

// ---- Movimientos de Finanzas ------------------------------------------------------------------

export function generateFinance({ rng, employees, routes, sales, startKey, todayKey, now, categories, categoryNames }) {
  const cat = (key) => categoryNames[key];
  const manual = []; // { concept, type, category, amount, status, dateKey, paymentMethod, dueKey, paidAt, createdAt }

  const months = [];
  for (let m = startKey.slice(0, 7); m <= todayKey.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const salesByMonth = new Map(months.map((m) => [m, 0]));
  for (const s of sales) {
    const m = T.dayKeyOf(s.createdAt).slice(0, 7);
    salesByMonth.set(m, (salesByMonth.get(m) || 0) + s.order.total);
  }

  const addManual = (item) => manual.push(item);
  const inRange = (key) => key >= startKey && key <= todayKey;
  const nextWeekday = (key) => {
    let k = key;
    while (!T.isWeekday(k)) k = T.addDays(k, 1);
    return k;
  };

  // --- Planilla quincenal
  const payroll = [];
  for (const period of payPeriods(startKey, todayKey)) {
    const amount = payrollFor(period, employees, todayKey);
    const [y, mo] = period.from.split("-").map(Number);
    const half = period.from.endsWith("-01") ? `1 al 15` : `16 al ${period.to.slice(8)}`;
    const concept = `Planilla quincenal ${half} de ${MONTH_NAMES[mo - 1]} de ${y}`;
    const paid = period.pay <= todayKey;
    const dateKey = paid ? period.pay : todayKey;
    payroll.push({ concept, type: "Gasto", category: cat("payroll"), amount, status: paid ? "Completado" : "Pendiente", dateKey, dueKey: paid ? undefined : period.pay, paymentMethod: "Transferencia", hour: 16 });
  }

  // --- Partidas fijas (alquiler, servicios, empaques, mantenimiento) y combustible
  const fixed = [];
  const addFixed = (item) => fixed.push(item);
  for (const m of months) {
    const first = nextWeekday(`${m}-01`);
    addFixed({ concept: `Alquiler de bodega (${MONTH_NAMES[Number(m.slice(5)) - 1]})`, category: cat("other"), amount: 1200, dateKey: first, paymentMethod: "Cheque", hour: 10 });
    addFixed({ concept: "Internet y telefonía", category: cat("services"), amount: r2(rng.range(92, 118)), dateKey: nextWeekday(`${m}-05`), paymentMethod: "Transferencia", hour: 11, bill: true });
    addFixed({ concept: "Agua (ANDA)", category: cat("services"), amount: r2(rng.range(140, 240)), dateKey: nextWeekday(`${m}-12`), paymentMethod: "Transferencia", hour: 11, bill: true });
    addFixed({ concept: "Energía eléctrica", category: cat("services"), amount: r2(rng.range(1850, 2750)), dateKey: nextWeekday(`${m}-24`), paymentMethod: "Transferencia", hour: 11, bill: true });
    addFixed({ concept: "Empaques: bolsas y cajas", category: cat("other"), amount: r2(rng.range(180, 420)), dateKey: nextWeekday(`${m}-08`), paymentMethod: "Transferencia", hour: 14 });
    addFixed({ concept: "Empaques: bolsas y cajas", category: cat("other"), amount: r2(rng.range(180, 420)), dateKey: nextWeekday(`${m}-22`), paymentMethod: "Transferencia", hour: 14 });
    const maint = rng.int(1, 3);
    const options = [
      ["Mantenimiento de extrusora", 300, 900],
      ["Cambio de aceite y llantas del camión", 150, 420],
      ["Reparación y afilado de moldes", 200, 650],
      ["Mantenimiento de compresor de aire", 120, 380],
      ["Revisión eléctrica de planta", 140, 340],
    ];
    for (const [concept, lo, hi] of rng.shuffle(options).slice(0, maint)) {
      addFixed({ concept, category: cat("maintenance"), amount: r2(rng.range(lo, hi)), dateKey: nextWeekday(`${m}-${String(rng.int(3, 27)).padStart(2, "0")}`), paymentMethod: "Transferencia", hour: 15 });
    }
  }
  // Combustible: cada viernes, según las rutas de la semana.
  const routeDays = new Map();
  for (const r of routes) {
    const k = T.dayKeyOf(r.createdAt);
    routeDays.set(k, (routeDays.get(k) || 0) + 1);
  }
  for (let k = startKey; k <= todayKey; k = T.addDays(k, 1)) {
    if (T.dowOf(k) !== 5) continue;
    let count = 0;
    for (let i = 0; i < 6; i += 1) count += routeDays.get(T.addDays(k, -i)) || 0;
    const date = T.isWeekday(k) ? k : T.addDays(k, -1);
    addFixed({ concept: "Combustible de la flota", category: cat("logistics"), amount: r2(40 + count * rng.range(26, 38)), dateKey: date, paymentMethod: "Efectivo", hour: 9 });
  }

  // --- Materia prima: compra semanal (martes); el monto se ajusta para que el gasto del mes quede entre 65 % y 80 % de las ventas.
  const purchases = [];
  for (let k = startKey; k <= todayKey; k = T.addDays(k, 1)) {
    if (T.dowOf(k) !== 2) continue;
    const date = nextWeekday(k);
    purchases.push({ concept: "Resina y colorantes (compra semanal)", category: cat("rawMaterial"), dateKey: date, paymentMethod: "Transferencia", hour: 10, weight: rng.range(0.7, 1.3), amount: 0 });
  }
  const ratios = {};
  for (const m of months) {
    const monthSales = salesByMonth.get(m) || 0;
    const ratio = rng.range(0.67, 0.77);
    ratios[m] = ratio;
    const target = ratio * monthSales;
    const payrollSum = payroll.filter((p) => p.dateKey.startsWith(m)).reduce((s, p) => s + p.amount, 0);
    const fixedItems = fixed.filter((f) => f.dateKey.startsWith(m) && inRange(f.dateKey));
    let fixedSum = fixedItems.reduce((s, f) => s + f.amount, 0);
    const mine = purchases.filter((p) => p.dateKey.startsWith(m));
    if (!mine.length) {
      // Mes sin martes hábil todavía: una compra el primer día hábil.
      const date = nextWeekday(`${m}-01`);
      if (inRange(date)) {
        const extra = { concept: "Resina y colorantes (compra semanal)", category: cat("rawMaterial"), dateKey: date, paymentMethod: "Transferencia", hour: 10, weight: 1, amount: 0 };
        purchases.push(extra);
        mine.push(extra);
      }
    }
    let rawTotal = target - payrollSum - fixedSum;
    const floor = 0.12 * target;
    if (rawTotal < floor) {
      const scale = Math.max(0.3, (target - payrollSum - floor) / Math.max(fixedSum, 1));
      for (const f of fixedItems) f.amount = r2(f.amount * scale);
      fixedSum = fixedItems.reduce((s, f) => s + f.amount, 0);
      rawTotal = Math.max(floor, target - payrollSum - fixedSum);
    }
    const weightSum = mine.reduce((s, p) => s + p.weight, 0) || 1;
    mine.forEach((p) => {
      p.amount = Math.max(50, roundTo((rawTotal * p.weight) / weightSum, 5));
    });
  }

  // --- Pendientes (por pagar): facturas de proveedores a crédito y recibos recientes.
  const dueIn = (days) => T.addDays(todayKey, days);
  for (const p of purchases) {
    const age = T.diffDays(p.dateKey, todayKey);
    if (age >= 0 && age <= 28 && rng.chance(0.5)) {
      p.status = "Pendiente";
      p.dueKey = T.addDays(p.dateKey, 30);
    }
  }
  const aged = purchases.filter((p) => {
    const age = T.diffDays(p.dateKey, todayKey);
    return age >= 32 && age <= 48;
  });
  for (const p of aged.slice(0, 2)) {
    p.status = "Pendiente";
    p.dueKey = T.addDays(p.dateKey, 30); // vencida
  }
  for (const f of fixed) {
    if (!f.bill) continue;
    const due = T.addDays(f.dateKey, 14);
    if (due > todayKey) {
      f.status = "Pendiente";
      f.dueKey = due;
    } else {
      f.paidAt = new Date(T.svTime(T.addDays(f.dateKey, rng.int(3, 13)), rng.int(9, 15), rng.int(0, 59)));
      if (f.paidAt > now) f.paidAt = new Date(now.getTime() - 3600000);
    }
  }
  // Un recibo extra vencido (por pagar).
  addManual({ concept: "Seguro de vehículos (cuota trimestral)", type: "Gasto", category: cat("other"), amount: 612.5, status: "Pendiente", dateKey: dueIn(-24), dueKey: dueIn(-4), paymentMethod: "Transferencia", hour: 11 });
  // Una factura de resina pagada con retraso (con paidAt).
  for (const p of purchases) {
    if (p.status === "Pendiente") continue;
    if (rng.chance(0.2)) p.paidAt = new Date(T.svTime(T.addDays(p.dateKey, rng.int(8, 25)), 11, rng.int(0, 59)));
    if (p.paidAt && p.paidAt > now) p.paidAt = undefined;
  }

  // --- Ingresos manuales
  const incomes = [
    ["Venta de material reciclado (scrap)", 180, 640],
    ["Venta directa en planta", 220, 1400],
    ["Servicio de maquila", 400, 1350],
    ["Reintegro de proveedor", 120, 320],
    ["Alquiler de montacargas a vecino", 150, 300],
  ];
  const incomeDays = T.daysBetween(startKey, todayKey).filter((k) => T.isWeekday(k));
  for (let i = 0; i < 14; i += 1) {
    const [concept, lo, hi] = rng.pick(incomes);
    addManual({
      concept,
      type: "Ingreso",
      category: categoryNames.otherIncome,
      amount: r2(rng.range(lo, hi)),
      status: "Completado",
      dateKey: rng.pick(incomeDays),
      paymentMethod: rng.pick(["Efectivo", "Transferencia", "Cheque"]),
      hour: rng.int(9, 16),
    });
  }
  addManual({ concept: "Maquila pendiente de cobro (cliente corporativo)", type: "Ingreso", category: categoryNames.otherIncome, amount: 980, status: "Pendiente", dateKey: dueIn(-9), dueKey: dueIn(6), paymentMethod: "Transferencia", hour: 12 });

  const toManual = (item, type = "Gasto") => ({
    concept: item.concept,
    type: item.type || type,
    category: item.category,
    amount: item.amount,
    status: item.status || "Completado",
    dateKey: item.dateKey,
    dueKey: item.dueKey,
    paidAt: item.paidAt,
    paymentMethod: item.paymentMethod,
    hour: item.hour ?? 10,
  });
  const all = [
    ...payroll.map((p) => toManual(p)),
    ...fixed.filter((f) => inRange(f.dateKey)).map((f) => toManual(f)),
    ...purchases.filter((p) => inRange(p.dateKey)).map((p) => toManual(p)),
    ...manual.map((m) => toManual(m)),
  ];
  for (const t of all) {
    t.amount = r2(t.amount);
    const created = T.svTime(t.dateKey, t.hour, rng.int(0, 59), rng.int(0, 59));
    t.createdAt = created > now ? new Date(now.getTime() - rng.int(1, 30) * MIN) : created;
    t.hour = undefined;
  }
  return { transactions: all, ratios, salesByMonth, months };
}

// ---- Presupuestos -----------------------------------------------------------------------------

// Presupuestos por categoría: uno desde 2026-01 (un poco por encima del promedio mensual generado,
// redondeado) y 1 o 2 ajustes durante el año. Solo 1 o 2 categorías se pasan en algún mes: las demás
// quedan por encima de su gasto más alto de cada tramo.
export function generateBudgets({ rng, transactions, categories, todayKey }) {
  const currentMonth = todayKey.slice(0, 7);
  const nextMonth = (m) => {
    const [y, mo] = m.split("-").map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  };
  const full = [];
  for (let m = "2026-01"; m < currentMonth; m = nextMonth(m)) full.push(m);
  const spend = new Map(); // categoría -> mes -> total
  for (const t of transactions) {
    if (t.type !== "Gasto") continue;
    const m = t.dateKey.slice(0, 7);
    if (!spend.has(t.category)) spend.set(t.category, new Map());
    spend.get(t.category).set(m, (spend.get(t.category).get(m) || 0) + t.amount);
  }
  const monthly = (name, m) => spend.get(name)?.get(m) || 0;
  const step = (avg) => (avg >= 3000 ? 250 : avg >= 800 ? 100 : 50);
  const ceilTo = (v, s) => Math.ceil(v / s) * s;
  const months = full.length ? full : [currentMonth];
  const live = categories.filter((c) => !c.archived && months.some((m) => monthly(c.name, m) > 0));
  const chosen = new Set(rng.shuffle(live.map((c) => c.name)).slice(0, Math.min(rng.int(1, 2), live.length)));

  const result = new Map();
  const overspent = [];
  for (const c of live) {
    const name = c.name;
    const adjustMonths = rng.shuffle(["2026-04", "2026-06", "2026-08"].filter((m) => m <= currentMonth)).slice(0, rng.int(1, 2)).sort();
    const starts = ["2026-01", ...adjustMonths];
    const entries = starts.map((from, i) => {
      const to = starts[i + 1];
      const segment = months.filter((m) => m >= from && (!to || m < to));
      const use = segment.length ? segment : months;
      const avg = use.reduce((sum, m) => sum + monthly(name, m), 0) / use.length;
      const peak = Math.max(...use.map((m) => monthly(name, m)));
      const s = step(avg);
      return { month: from, amount: ceilTo(chosen.has(name) ? avg * 1.08 : Math.max(avg * 1.08, peak * 1.02), s) };
    });
    result.set(name, entries.filter((e, i) => i === 0 || e.amount !== entries[i - 1].amount));
  }
  // Las categorías elegidas se pasan en su mes de mayor gasto: ese mes el presupuesto queda por debajo.
  for (const name of chosen) {
    if (!full.length) break;
    const m = [...full].sort((a, b) => monthly(name, b) - monthly(name, a))[0];
    const entries = result.get(name);
    const base = budgetAt(entries, m);
    const lower = Math.floor((monthly(name, m) * 0.86) / 50) * 50;
    if (!(lower > 0 && lower < monthly(name, m))) continue;
    const next = nextMonth(m);
    const out = entries.filter((e) => e.month !== m && e.month !== next);
    out.push({ month: m, amount: lower });
    if (next <= currentMonth) out.push({ month: next, amount: budgetAt(entries, next) ?? base });
    out.sort((a, b) => (a.month < b.month ? -1 : 1));
    result.set(name, out);
  }
  for (const [name, entries] of result) {
    if (full.some((m) => monthly(name, m) > (budgetAt(entries, m) ?? Infinity))) overspent.push(name);
  }
  return { budgets: result, overspent, spend };
}

export function budgetAt(entries, month) {
  let found = null;
  for (const e of entries || []) if (e.month <= month && (!found || e.month > found.month)) found = e;
  return found ? found.amount : null;
}
