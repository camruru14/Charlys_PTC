/*
  Utilidades de búsqueda y filtrado para las transacciones (Finanzas).
  Se usan en la card de Finanzas y en la página Historial de Transacciones.
*/
import { fromDateOnly } from "./format";

export const defaultTransactionFilters = {
  q: "", // texto: concepto, referencia, categoría
  type: "", // Ingreso | Gasto
  category: "", // categoría exacta
  status: "", // estado exacto
  minAmount: "", // monto mínimo
  maxAmount: "", // monto máximo
};

// Fecha efectiva de una transacción.
export function txDate(t) {
  return t.date || t.createdAt;
}

// Componentes de fecha (año/mes/día) de una transacción, para agrupar por
// día/mes (ej. gráficas de Finanzas) sin correrla un día en husos detrás de UTC.
// "date" se guarda como medianoche UTC (fecha sin hora), así que se lee en UTC.
// "createdAt" (fallback) sí es un instante real, por eso ese se lee en hora local.
export function txDateParts(t) {
  const raw = txDate(t);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (t.date) {
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), time: d.getTime() };
  }
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), time: d.getTime() };
}

// Fecha de una transacción para compararla con un rango del selector (que
// está en hora local). "date" es medianoche UTC (fecha sin hora): leída tal
// cual, en El Salvador (UTC-6) cae el día anterior a las 18:00, así que se
// pasa a la medianoche local del mismo día. "createdAt" (fallback) es un
// instante real y se usa tal cual. null si no hay fecha válida.
export function txRangeDate(t) {
  if (t.date) return fromDateOnly(t.date);
  const d = new Date(t.createdAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ¿La transacción cae dentro del rango? Sin rango («Todo») o sin fecha
// válida, cuenta (mismo criterio que antes).
export function inRange(t, range) {
  if (!range?.from || !range?.to) return true;
  const d = txRangeDate(t);
  return !d || (d >= range.from && d <= range.to);
}

// Opciones únicas presentes (para los desplegables de filtro).
export function transactionFilterOptions(list = []) {
  const uniq = (key) => [...new Set(list.map((t) => t[key]).filter(Boolean))].sort();
  return {
    types: uniq("type"),
    categories: uniq("category"),
    statuses: uniq("status"),
  };
}

/*
  Filtra por rango de fechas (opcional) + filtros de texto/campos.
*/
export function filterTransactions(list = [], filters = defaultTransactionFilters, range = null) {
  return list.filter((t) => {
    if (!inRange(t, range)) return false;

    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = [t.concept, t.reference, t.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.status && t.status !== filters.status) return false;

    if (filters.minAmount !== "" && (t.amount || 0) < Number(filters.minAmount)) return false;
    if (filters.maxAmount !== "" && (t.amount || 0) > Number(filters.maxAmount)) return false;

    return true;
  });
}
