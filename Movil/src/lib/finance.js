// Constantes y cálculos de Finanzas, portados de
// Web/private/frontend/src/pages/Finanzas.jsx.
import { txDateParts } from "./transactionFilters";

export const TYPES = ["Ingreso", "Gasto"];
export const STATUSES = ["Pendiente", "Completado"];
export const CATEGORIES = ["Materia Prima", "Logística", "Mantenimiento", "Planilla", "Servicios", "Ventas", "Otros"];
const CHART_MONTHS = 6;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Vista previa del próximo N° de transacción (el backend genera el
// definitivo al guardar).
export function previewReference(list) {
  const prefix = `TRAN-${new Date().getFullYear()}-`;
  const lastNumber = list.reduce((max, t) => {
    if (!t.reference?.startsWith(prefix)) return max;
    const n = parseInt(t.reference.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

// Ingresos y gastos de los últimos seis meses calendario (el actual
// incluido), sin importar el rango elegido.
//   [{ key, label: "Sep", title: "Septiembre 2026", income, expense, current }]
export function lastMonths(list) {
  const now = new Date();
  return Array.from({ length: CHART_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    let income = 0;
    let expense = 0;
    for (const t of list) {
      const parts = txDateParts(t);
      if (!parts || parts.y !== y || parts.m !== m) continue;
      if (t.type === "Ingreso") income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    }
    return {
      key: `${y}-${m}`,
      label: capitalize(MONTHS[m].slice(0, 3)),
      title: `${capitalize(MONTHS[m])} ${y}`,
      income,
      expense,
      current: i === CHART_MONTHS - 1,
    };
  });
}

// KPIs de Finanzas sobre las transacciones del rango: ingresos, gastos,
// neto y lo pendiente (por cobrar / pagar) con cuántos pedidos distintos.
export function financeKpis(list) {
  const sum = (items) => items.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const income = sum(list.filter((t) => t.type === "Ingreso"));
  const expense = sum(list.filter((t) => t.type === "Gasto"));
  const pendingList = list.filter((t) => t.status === "Pendiente");
  const pendingOrders = new Set(
    pendingList.map((t) => t.relatedOrder?._id || t.relatedOrder).filter(Boolean).map(String),
  );
  return { income, expense, net: income - expense, pending: sum(pendingList), pendingOrders: pendingOrders.size };
}
