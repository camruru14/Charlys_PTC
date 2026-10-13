/*
  Cálculos de la página Finanzas (sin React): gastos por categoría contra el
  presupuesto, comparación con el período anterior, filtros y agrupación del
  libro de movimientos, textos de vencimiento y el CSV.
*/
import { budgetFor, monthKey } from "./expenseCategories";
import { calendarDaysAgo, fmtDate, fmtDayLong, fmtMoney } from "./format";
import { dayKey, dueDay, inRange, isStoreSale, txDay, txRangeDate } from "./transactionFilters";

export const OTHER_INCOME = "Otros ingresos";
export const SALES_CATEGORY = "Ventas";

const num = (value) => Number(value) || 0;
const sum = (list) => list.reduce((total, t) => total + num(t.amount), 0);
const isPaid = (t) => t.status === "Completado";
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// «$450» o «$450.50».
export function money(value) {
  return fmtMoney(value, Number.isInteger(value) ? 0 : 2);
}

export function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Meses «AAAA-MM» que toca un rango, del primero al último.
export function monthsInRange(from, to) {
  const months = [];
  const last = to.getFullYear() * 12 + to.getMonth();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor.getFullYear() * 12 + cursor.getMonth() <= last && months.length < 600) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/*
  Cómo se leen los presupuestos según el rango del selector:
    months: los meses del rango si viene de «Por mes» (granularity "month"); null si no
    currentMonthOnly: es un solo mes y es el actual (marca del día, «va más rápido»)
*/
export function rangeInfo(range, now = new Date()) {
  const hasRange = Boolean(range?.from && range?.to);
  const months = hasRange && range.granularity === "month" ? monthsInRange(range.from, range.to) : null;
  return { hasRange, months, currentMonthOnly: Boolean(months && months.length === 1 && months[0] === monthKey(now)) };
}

// Presupuesto de una categoría en esos meses: la suma de budgetFor de cada uno
// (null si ninguno tiene presupuesto).
export function budgetForMonths(category, months) {
  const values = months.map((month) => budgetFor(category, month)).filter((value) => value != null);
  return values.length ? sum(values.map((amount) => ({ amount }))) : null;
}

// --- Gastos por categoría -------------------------------------------------------

/*
  Una fila por categoría con gasto en el rango o con presupuesto (las archivadas
  solo si tienen gasto):
    { key, name, icon, color, archived, paid, pending, pendingItems, budget }
  `budget` solo si el rango viene de «Por mes»; si no, null (la fila muestra lo gastado).
  Los gastos de un nombre que ya no es categoría salen en una fila gris.
*/
export function categoryRows({ transactions, categories, range, now = new Date() }) {
  const { months } = rangeInfo(range, now);
  const spent = new Map();
  for (const t of transactions) {
    if (t.type !== "Gasto" || !inRange(t, range)) continue;
    const entry = spent.get(t.category) || { paid: 0, pending: 0, pendingItems: [] };
    if (isPaid(t)) entry.paid += num(t.amount);
    else {
      entry.pending += num(t.amount);
      entry.pendingItems.push(t);
    }
    spent.set(t.category, entry);
  }

  const rows = [];
  for (const category of categories) {
    const entry = spent.get(category.name);
    const hasSpent = Boolean(entry && (entry.paid || entry.pending));
    const budget = months ? budgetForMonths(category, months) : null;
    if (category.archived ? !hasSpent : !(hasSpent || budget > 0)) continue;
    rows.push({
      key: category._id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      archived: Boolean(category.archived),
      paid: entry?.paid ?? 0,
      pending: entry?.pending ?? 0,
      pendingItems: entry?.pendingItems ?? [],
      budget,
    });
    spent.delete(category.name);
  }
  const known = new Set(categories.map((c) => c.name));
  for (const [name, entry] of spent) {
    if (known.has(name) || !(entry.paid || entry.pending)) continue;
    rows.push({ key: `x:${name}`, name: name || "Sin categoría", icon: "tag", color: "gray", archived: false, budget: null, ...entry });
  }
  return rows;
}

// Nota de una fila contra su presupuesto. level: 3 pasó · 2 se pasa al pagar
// lo pendiente · 1 va más rápido que el mes · 0 normal.
export function budgetNote(row, { currentMonthOnly = false, dayPct = 0 } = {}) {
  if (!(row.budget > 0)) return null;
  const pct = Math.round((row.paid / row.budget) * 100);
  if (row.paid > row.budget) return { level: 3, tone: "rose", text: "Pasó el presupuesto" };
  if (row.paid + row.pending > row.budget) return { level: 2, tone: "amber", text: `${pct}% · se pasa al pagar lo pendiente` };
  if (currentMonthOnly && (row.paid / row.budget) * 100 - dayPct > 5) return { level: 1, tone: "amber", text: `${pct}% · va más rápido que el mes` };
  return { level: 0, tone: "gray", text: `${pct}% del presupuesto` };
}

// El aviso más importante de las filas (uno solo): ya pasó su presupuesto >
// se pasará al pagar lo pendiente > va más rápido que el mes. null si no hay.
export function budgetAlert(rows, { currentMonthOnly = false, now = new Date() } = {}) {
  const dayPct = currentMonthOnly ? (now.getDate() / daysInMonth(now)) * 100 : 0;
  const noted = rows.map((row) => ({ row, note: budgetNote(row, { currentMonthOnly, dayPct }) })).filter((r) => r.note && r.note.level > 0);
  const top = (level, score) => noted.filter((r) => r.note.level === level).sort((a, b) => score(b.row) - score(a.row))[0];

  const over = top(3, (r) => r.paid - r.budget);
  if (over) {
    const { row } = over;
    return { level: 3, text: `${row.name} ya pasó su presupuesto de ${money(row.budget)}: llevas ${money(row.paid)}.` };
  }
  const will = top(2, (r) => r.paid + r.pending - r.budget);
  if (will) {
    const { row } = will;
    const when =
      row.pendingItems.length === 1
        ? `cuando se pague «${row.pendingItems[0].concept}» (${money(num(row.pendingItems[0].amount))})`
        : `cuando se paguen ${row.pendingItems.length} pendientes (${money(row.pending)})`;
    return { level: 2, text: `${row.name} pasará su presupuesto de ${money(row.budget)} ${when}.` };
  }
  const fast = top(1, (r) => r.paid / r.budget);
  if (fast) {
    const { row } = fast;
    return {
      level: 1,
      text: `${row.name} va más rápido que el mes: ${Math.round((row.paid / row.budget) * 100)}% del presupuesto en el día ${now.getDate()} de ${daysInMonth(now)}.`,
    };
  }
  return null;
}

// --- Total pagado y comparación con el período anterior ---------------------------

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept.", "oct", "nov", "dic"];

// Gastos pagados con fecha entre from y to (inclusive).
export function paidExpenses(transactions, from, to) {
  return sum(
    transactions.filter((t) => {
      if (t.type !== "Gasto" || !isPaid(t)) return false;
      const d = txRangeDate(t);
      return d && d >= from && d <= to;
    }),
  );
}

/*
  Gastos pagados del rango y su variación contra el período anterior:
    · mes en curso (del día 1 a hoy): los mismos días del mes anterior
      («vs. sept. al día 12»);
    · cualquier otro rango: el período anterior de la misma duración.
  Sin rango («Todo») no hay comparación. pct es null si el período anterior no tuvo gasto.
*/
export function expenseTotal(transactions, range, now = new Date()) {
  if (!range?.from || !range?.to) return { total: paidExpenses(transactions, new Date(0), new Date(8.64e15)), pct: null, label: "" };
  const today = endOfDay(now);
  const from = range.from;
  const to = range.to > today ? today : range.to;
  const total = paidExpenses(transactions, from, range.to);

  const inCurrentMonth = !range.preset && from.getDate() === 1 && from.getFullYear() === now.getFullYear() && from.getMonth() === now.getMonth() && range.to >= startOfToday(now);
  let previous;
  let label;
  if (inCurrentMonth) {
    const prevStart = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const day = to.getDate();
    previous = paidExpenses(transactions, prevStart, endOfDay(new Date(prevStart.getFullYear(), prevStart.getMonth(), Math.min(day, daysInMonth(prevStart)))));
    label = `vs. ${SHORT_MONTHS[prevStart.getMonth()]} al día ${day}`;
  } else {
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - (to.getTime() - from.getTime()));
    previous = paidExpenses(transactions, prevFrom, prevTo);
    label = "vs. período anterior";
  }
  return { total, pct: previous > 0 ? ((paidExpenses(transactions, from, to) - previous) / previous) * 100 : null, label };
}

function startOfToday(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// --- Libro de movimientos -----------------------------------------------------------

export const LEDGER_TABS = [
  { key: "todos", label: "Todos" },
  { key: "gastos", label: "Gastos" },
  { key: "ingresos", label: "Ingresos" },
  { key: "porpagar", label: "Por pagar" },
];

// Movimientos del rango, en la pestaña, la categoría y la búsqueda elegidas.
export function filterLedger(transactions, { range, tab = "todos", category = "", query = "" }) {
  const q = query.trim().toLowerCase();
  return transactions.filter((t) => {
    if (!inRange(t, range)) return false;
    if (tab === "gastos" && t.type !== "Gasto") return false;
    if (tab === "ingresos" && t.type !== "Ingreso") return false;
    if (tab === "porpagar" && t.status !== "Pendiente") return false;
    if (category && t.category !== category) return false;
    if (q) {
      const haystack = [t.concept, t.reference, t.category, t.relatedOrder?.orderNumber, t.orderNumber].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// Las cuatro cifras de la franja de resumen (movimientos del rango).
export function ledgerSummary(transactions, range) {
  const list = transactions.filter((t) => inRange(t, range));
  const sales = list.filter((t) => isStoreSale(t) && t.type === "Ingreso" && isPaid(t));
  const otherIncome = list.filter((t) => !isStoreSale(t) && t.type === "Ingreso" && isPaid(t));
  const expenses = list.filter((t) => t.type === "Gasto" && isPaid(t));
  const pending = list.filter((t) => t.type === "Gasto" && t.status === "Pendiente");
  const income = sum(sales) + sum(otherIncome);
  const net = income - sum(expenses);
  return {
    sales: sum(sales),
    salesCount: sales.length,
    otherIncome: sum(otherIncome),
    expensesPaid: sum(expenses),
    net,
    netPct: income > 0 ? (net / income) * 100 : null,
    pending: sum(pending),
    pendingCount: pending.length,
  };
}

const createdTime = (t) => new Date(t.createdAt || t.date || 0).getTime();

/*
  Filas del libro, por día (el más reciente primero): primero lo manual (por
  creación, lo más nuevo arriba) y al final UNA fila con las ventas de la tienda
  del día. rows: { kind: "manual" | "sales", id, day, tx | sales }.
  days: Map «AAAA-MM-DD» -> { date, net } (neto del día: lo pagado/cobrado).
*/
export function buildLedger(list) {
  const days = new Map();
  for (const t of list) {
    const date = txDay(t);
    if (!date) continue;
    const key = dayKey(date);
    const day = days.get(key) || { key, date, manual: [], sales: [], net: 0 };
    if (isStoreSale(t)) day.sales.push(t);
    else day.manual.push(t);
    if (isPaid(t)) day.net += t.type === "Ingreso" ? num(t.amount) : -num(t.amount);
    days.set(key, day);
  }
  const ordered = [...days.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
  const rows = [];
  for (const day of ordered) {
    day.manual.sort((a, b) => createdTime(b) - createdTime(a));
    for (const tx of day.manual) rows.push({ kind: "manual", id: tx._id, day: day.key, tx });
    if (day.sales.length) rows.push({ kind: "sales", id: `sales:${day.key}`, day: day.key, sales: day.sales });
  }
  return { rows, days };
}

// «Hoy · 12 oct», «Ayer · 11 oct» o «Viernes 9 oct».
export function dayLabel(date, now = new Date()) {
  const ago = calendarDaysAgo(date, now);
  if (ago === 0) return `Hoy · ${fmtDate(date)}`;
  if (ago === 1) return `Ayer · ${fmtDate(date)}`;
  return `${fmtDayLong(date).split(" ")[0]} ${fmtDate(date)}`;
}

// «ORD-2026-0158 a 0161» (pedidos seguidos) o «ORD-2026-0158 · ORD-2026-0162».
export function orderRangeText(sales) {
  const numbers = sales.map((t) => t.relatedOrder?.orderNumber || t.orderNumber).filter(Boolean).sort();
  if (!numbers.length) return "";
  if (numbers.length === 1) return numbers[0];
  const suffix = (n) => Number(String(n).split("-").pop());
  const consecutive = numbers.every((n, i) => i === 0 || (suffix(n) === suffix(numbers[i - 1]) + 1 && n.split("-").slice(0, -1).join("-") === numbers[0].split("-").slice(0, -1).join("-")));
  if (consecutive) return `${numbers[0]} a ${numbers[numbers.length - 1].split("-").pop()}`;
  return numbers.length <= 3 ? numbers.join(" · ") : `${numbers[0]} · ${numbers[1]} · +${numbers.length - 2}`;
}

// Texto del vencimiento de un movimiento pendiente: «vence el jueves 15»,
// «venció hace 2 días» (overdue: true). null si no tiene vencimiento.
export function dueText(t, now = new Date()) {
  const due = dueDay(t);
  if (!due || t.status !== "Pendiente") return null;
  const ago = calendarDaysAgo(due, now);
  if (ago > 0) return { text: ago === 1 ? "venció ayer" : `venció hace ${ago} días`, overdue: true };
  if (ago === 0) return { text: "vence hoy", overdue: false };
  if (ago === -1) return { text: "vence mañana", overdue: false };
  if (ago >= -6) return { text: `vence el ${fmtDayLong(due).split(" ")[0].toLowerCase()} ${due.getDate()}`, overdue: false };
  return { text: `vence el ${fmtDate(due)}`, overdue: false };
}

export { plural, capitalize };

// CSV de los movimientos (con BOM para que Excel lea las tildes): fecha,
// referencia, concepto, categoría, método, estado y monto con signo.
export function transactionsCsv(list, statusOf) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [...list]
    .filter((t) => txDay(t))
    .sort((a, b) => (dayKey(txDay(a)) < dayKey(txDay(b)) ? 1 : -1))
    .map((t) =>
      [dayKey(txDay(t)), t.reference, t.concept, t.category, t.paymentMethod, statusOf(t), (t.type === "Gasto" ? -num(t.amount) : num(t.amount)).toFixed(2)].map(cell).join(","),
    );
  return `\uFEFF${[["Fecha", "Referencia", "Concepto", "Categoría", "Método", "Estado", "Monto"].map(cell).join(","), ...rows].join("\r\n")}`;
}

// Métodos de pago que se eligen a mano («Wompi» es solo de las ventas de la tienda).
export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque"];

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

// Valida el archivo de una factura (imagen o PDF, hasta 10 MB); devuelve el error o null.
export function invoiceError(file) {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") return "La factura debe ser una imagen o un PDF";
  if (file.size > MAX_INVOICE_BYTES) return "La factura no puede pesar más de 10 MB";
  return null;
}
