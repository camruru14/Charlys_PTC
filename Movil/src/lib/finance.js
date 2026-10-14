// Cálculos de Finanzas (sin React), portados de
// Web/private/frontend/src/lib/finance.js: gastos por categoría contra el
// presupuesto, filtros y agrupación del libro de movimientos y textos de
// vencimiento.
import { budgetFor, monthKey } from "./expenseCategories";
import { calendarDaysAgo, formatDayLong, formatMoney, formatShortDate } from "./format";
import { dayKey, dueDay, inRange, isStoreSale, txDay } from "./transactionFilters";

export const TYPES = ["Ingreso", "Gasto"];
export const OTHER_INCOME = "Otros ingresos";
// Clave interna del filtro «Sin categoría» (los gastos sin categoría): la etiqueta visible es
// «Sin categoría», pero filtrar por ese texto no encontraría nada porque `category` está vacía.
export const UNCATEGORIZED = "__none__";
export const UNCATEGORIZED_LABEL = "Sin categoría";

// Métodos de pago que se eligen a mano («Wompi» es solo de las ventas de la tienda).
export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque"];
// Ícono <Icon /> de cada método.
export const METHOD_ICONS = { Efectivo: "cash", Transferencia: "bank", Cheque: "doc", Wompi: "card" };

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

// Dinero en centavos enteros: sumar y comparar en punto flotante da errores como
// 117.99 + 570.32 = 688.3100000000001 (y un falso «pasó el presupuesto» de $688.31).
export const cents = (value) => Math.round((Number(value) || 0) * 100);
const fromCents = (value) => value / 100;
const num = (value) => Number(value) || 0;
const sum = (list) => fromCents(list.reduce((total, t) => total + cents(t.amount), 0));
const isPaid = (t) => t.status === "Completado";
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// «$450» o «$450.50».
export function money(value) {
  return formatMoney(value, Number.isInteger(value) ? 0 : 2);
}

export function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// El mes calendario en curso como rango «por mes» (del día 1 al último a las
// 23:59:59): la app no tiene la vista «Por mes» del selector, así que los
// presupuestos siempre se leen contra este mes.
export function currentMonthRange(now = new Date()) {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    granularity: "month",
  };
}

// Presupuesto de una categoría en el mes de `range` si viene «por mes».
function budgetOf(category, range) {
  if (range?.granularity !== "month") return null;
  return budgetFor(category, monthKey(range.from));
}

// --- Gastos por categoría -------------------------------------------------------

/*
  Una fila por categoría con gasto en el rango o con presupuesto (las
  archivadas solo si tienen gasto):
    { key, name, icon, color, archived, paid, pending, pendingItems, budget }
  `budget` solo si el rango viene «por mes»; si no, null. Los gastos de un
  nombre que ya no es categoría salen en una fila gris.
*/
export function categoryRows({ transactions, categories, range }) {
  const spent = new Map();
  for (const t of transactions) {
    if (t.type !== "Gasto" || !inRange(t, range)) continue;
    const entry = spent.get(t.category) || { paid: 0, pending: 0, pendingItems: [] };
    if (isPaid(t)) entry.paid += cents(t.amount);
    else {
      entry.pending += cents(t.amount);
      entry.pendingItems.push(t);
    }
    spent.set(t.category, entry);
  }

  const rows = [];
  for (const category of categories) {
    const entry = spent.get(category.name);
    const hasSpent = Boolean(entry && (entry.paid || entry.pending));
    const budget = budgetOf(category, range);
    if (category.archived ? !hasSpent : !(hasSpent || budget > 0)) continue;
    rows.push({
      key: category._id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      archived: Boolean(category.archived),
      filterKey: category.name,
      paid: fromCents(entry?.paid ?? 0),
      pending: fromCents(entry?.pending ?? 0),
      pendingItems: entry?.pendingItems ?? [],
      budget,
    });
    spent.delete(category.name);
  }
  const known = new Set(categories.map((c) => c.name));
  for (const [name, entry] of spent) {
    if (known.has(name) || !(entry.paid || entry.pending)) continue;
    rows.push({
      key: `x:${name}`,
      name: name || UNCATEGORIZED_LABEL,
      filterKey: name || UNCATEGORIZED,
      icon: "tag",
      color: "gray",
      archived: false,
      budget: null,
      ...entry,
      paid: fromCents(entry.paid),
      pending: fromCents(entry.pending),
    });
  }
  return rows;
}

// Nota de una fila contra su presupuesto. level: 3 pasó · 2 se pasa al pagar
// lo pendiente · 1 va más rápido que el mes · 0 normal. dayPct: % de días
// transcurridos del mes (para «va más rápido»).
export function budgetNote(row, { dayPct = 0 } = {}) {
  if (!(row.budget > 0)) return null;
  // En centavos: 688.3100000000001 no es más que 688.31.
  const paid = cents(row.paid);
  const budget = cents(row.budget);
  const pct = Math.round((paid / budget) * 100);
  if (paid > budget) return { level: 3, tone: "rose", text: "Pasó el presupuesto" };
  if (paid + cents(row.pending) > budget) return { level: 2, tone: "amber", text: `${pct}% · se pasa al pagar lo pendiente` };
  if ((paid / budget) * 100 - dayPct > 5) return { level: 1, tone: "amber", text: `${pct}% · va más rápido que el mes` };
  return { level: 0, tone: "gray", text: `${pct}% del presupuesto` };
}

// --- Libro de movimientos -----------------------------------------------------------

export const LEDGER_TABS = [
  { value: "todos", label: "Todos" },
  { value: "gastos", label: "Gastos" },
  { value: "ingresos", label: "Ingresos" },
  // Lista TODOS los movimientos pendientes (gastos por pagar e ingresos por cobrar).
  { value: "porpagar", label: "Pendientes" },
];

// Movimientos del rango, en la pestaña, la categoría y la búsqueda elegidas.
export function filterLedger(transactions, { range, tab = "todos", category = "", query = "" }) {
  const q = query.trim().toLowerCase();
  return transactions.filter((t) => {
    if (!inRange(t, range)) return false;
    if (tab === "gastos" && t.type !== "Gasto") return false;
    if (tab === "ingresos" && t.type !== "Ingreso") return false;
    if (tab === "porpagar" && t.status !== "Pendiente") return false;
    if (category === UNCATEGORIZED) {
      if (t.type !== "Gasto" || t.category) return false;
    } else if (category && t.category !== category) return false;
    if (q) {
      const haystack = [t.concept, t.reference, t.category, t.relatedOrder?.orderNumber, t.orderNumber].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// Las cuatro cifras del resumen (movimientos del rango).
export function ledgerSummary(transactions, range) {
  const list = transactions.filter((t) => inRange(t, range));
  const sales = list.filter((t) => isStoreSale(t) && t.type === "Ingreso" && isPaid(t));
  const otherIncome = list.filter((t) => !isStoreSale(t) && t.type === "Ingreso" && isPaid(t));
  const expenses = list.filter((t) => t.type === "Gasto" && isPaid(t));
  const pending = list.filter((t) => t.type === "Gasto" && t.status === "Pendiente");
  const income = fromCents(cents(sum(sales)) + cents(sum(otherIncome)));
  const net = fromCents(cents(income) - cents(sum(expenses)));
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
  Días del libro (el más reciente primero), cada uno con sus filas: primero lo
  manual (por creación, lo más nuevo arriba) y al final UNA fila con las
  ventas de la tienda del día.
    [{ key: "2026-10-12", date, net, count, rows: [{ kind: "manual", id, tx } | { kind: "sales", id, sales }] }]
  `net` es el neto del día (lo pagado o cobrado).
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
    if (isPaid(t)) day.net += t.type === "Ingreso" ? cents(t.amount) : -cents(t.amount);
    days.set(key, day);
  }
  for (const day of days.values()) day.net = fromCents(day.net);
  return [...days.values()]
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map((day) => {
      day.manual.sort((a, b) => createdTime(b) - createdTime(a));
      const rows = day.manual.map((tx) => ({ kind: "manual", id: tx._id, tx }));
      if (day.sales.length) rows.push({ kind: "sales", id: `sales:${day.key}`, sales: day.sales, day: day.key });
      return { key: day.key, date: day.date, net: day.net, count: day.manual.length + day.sales.length, rows };
    });
}

// «Hoy · 12 oct», «Ayer · 11 oct» o «Viernes 9 oct».
export function dayLabel(date, now = new Date()) {
  const ago = calendarDaysAgo(date, now);
  if (ago === 0) return `Hoy · ${formatShortDate(date)}`;
  if (ago === 1) return `Ayer · ${formatShortDate(date)}`;
  return `${formatDayLong(date).split(" ")[0]} ${formatShortDate(date)}`;
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
  if (ago >= -6) return { text: `vence el ${formatDayLong(due).split(" ")[0].toLowerCase()} ${due.getDate()}`, overdue: false };
  return { text: `vence el ${formatShortDate(due)}`, overdue: false };
}

// «ORD-2026-0158 a 0161» (pedidos seguidos) o los números separados por « · ».
export function orderRangeText(sales) {
  const numbers = sales.map((t) => t.relatedOrder?.orderNumber || t.orderNumber).filter(Boolean).sort();
  if (!numbers.length) return "";
  if (numbers.length === 1) return numbers[0];
  const suffix = (n) => Number(String(n).split("-").pop());
  const prefix = (n) => n.split("-").slice(0, -1).join("-");
  const consecutive = numbers.every((n, i) => i === 0 || (suffix(n) === suffix(numbers[i - 1]) + 1 && prefix(n) === prefix(numbers[0])));
  if (consecutive) return `${numbers[0]} a ${numbers[numbers.length - 1].split("-").pop()}`;
  return numbers.length <= 3 ? numbers.join(" · ") : `${numbers[0]} · ${numbers[1]} · +${numbers.length - 2}`;
}

// Valida el archivo de una factura (imagen, hasta 10 MB); devuelve el error o null.
export function invoiceError(file) {
  if (file.type && !file.type.startsWith("image/") && file.type !== "application/pdf") return "La factura debe ser una imagen o un PDF";
  if (file.size > MAX_INVOICE_BYTES) return "La factura no puede pesar más de 10 MB";
  return null;
}

export { capitalize };
