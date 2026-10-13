// Utilidades de los movimientos de Finanzas (transacciones), portadas de
// Web/private/frontend/src/lib/transactionFilters.js: reconocer una venta de
// la tienda, el estado que se ve en pantalla y las fechas.
import { fromDateOnly } from "./format";

// Venta de la tienda: la crea sola el checkout (lleva el pedido o su N°). No
// se edita, no se borra y no admite facturas desde la app.
export function isStoreSale(t) {
  return Boolean(t?.relatedOrder || t?.orderNumber);
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Día de calendario de un movimiento, a las 00:00 locales. Un movimiento
// manual guarda "date" como medianoche UTC (fecha sin hora): se pasa a la
// medianoche local del mismo día. Una venta de la tienda guarda el instante
// real del pago: se lee en hora local.
export function txDay(t) {
  const raw = t.date || t.createdAt;
  if (!raw) return null;
  if (isStoreSale(t) || !t.date) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : startOfDay(d);
  }
  return fromDateOnly(t.date);
}

// «2026-10-12» del día de calendario (hora local), para agrupar y comparar.
export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Fecha de un movimiento para compararla con el rango (hora local). null si
// no hay fecha válida.
export function txRangeDate(t) {
  if (isStoreSale(t) && t.date) {
    const d = new Date(t.date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return txDay(t);
}

// ¿El movimiento cae dentro del rango? Sin rango («Todo») o sin fecha válida,
// cuenta.
export function inRange(t, range) {
  if (!range?.from || !range?.to) return true;
  const d = txRangeDate(t);
  return !d || (d >= range.from && d <= range.to);
}

// Vencimiento de un movimiento pendiente (a las 00:00 locales), o null.
export function dueDay(t) {
  return t.dueDate ? fromDateOnly(t.dueDate) : null;
}

// Estado que se ve en pantalla (en la base siguen siendo Pendiente y
// Completado): Completado -> «Pagado» · Pendiente -> «Por pagar» (gasto) o
// «Por cobrar» (ingreso) · Pendiente con el vencimiento pasado -> «Vencido».
export function statusLabel(t, now = new Date()) {
  if (t.status !== "Pendiente") return "Pagado";
  const due = dueDay(t);
  if (due && due < startOfDay(now)) return "Vencido";
  return t.type === "Ingreso" ? "Por cobrar" : "Por pagar";
}
