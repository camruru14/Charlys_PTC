// Textos y cálculos del Dashboard (sin React), portados de
// Web/private/frontend/src/lib/dashboard.js: comparación contra el período anterior, el rango
// como «mes», etiquetas de las etapas de pedido y formato de dinero. Los datos vienen de
// GET /dashboard (Web/private/backend/src/controller/dashboardController.js).
import { formatMoney, formatNumber } from "./format";

const MONTHS_DOT = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];
export const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const lastDayOf = (year, month) => new Date(year, month + 1, 0).getDate();

// Rango que se manda a GET /dashboard. «Este mes» llega hasta hoy, pero el backend reconoce el
// mes en curso cuando el rango es el mes calendario completo (día 1 al último día) y entonces lo
// compara con los mismos días del mes anterior: por eso se pide hasta el fin de mes (lo que aún no
// pasó no tiene datos).
export function dashboardRange(range) {
  const { from, to } = range || {};
  if (range?.preset === "month" && from) {
    return { from, to: new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999) };
  }
  return { from, to };
}

// Si el rango del selector es UN mes calendario completo (o «Este mes», que el Dashboard trata
// como tal): { year, month }; si no, null.
export function monthOfRange(range) {
  const { from, to } = dashboardRange(range);
  if (!from || !to) return null;
  if (from.getFullYear() !== to.getFullYear() || from.getMonth() !== to.getMonth()) return null;
  return from.getDate() === 1 && to.getDate() === lastDayOf(to.getFullYear(), to.getMonth())
    ? { year: from.getFullYear(), month: from.getMonth() }
    : null;
}

// «este mes» (mes en curso), «en septiembre» (otro mes) o «en el rango».
export function rangeWhen(range, now = new Date()) {
  const m = monthOfRange(range);
  if (!m) return "en el rango";
  if (m.year === now.getFullYear() && m.month === now.getMonth()) return "este mes";
  return `en ${MONTHS_LONG[m.month]}`;
}

// «de este mes», «de septiembre» o «del rango» (subtítulo de «Ventas por producto»).
export function rangeOf(range, now = new Date()) {
  const when = rangeWhen(range, now);
  if (when === "en el rango") return "del rango";
  return when === "este mes" ? "de este mes" : when.replace("en ", "de ");
}

// «vs. sept. al día 12», «vs. sept.» (mes completo) o «vs. 6 – 12 oct»; "" sin período anterior.
export function previousLabel(range) {
  if (!range?.previousFrom || !range?.previousTo) return "";
  const a = new Date(range.previousFrom);
  const b = new Date(range.previousTo);
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === 1) {
    const name = MONTHS_DOT[a.getMonth()];
    return b.getDate() === lastDayOf(b.getFullYear(), b.getMonth()) ? `vs. ${name}` : `vs. ${name} al día ${b.getDate()}`;
  }
  const sameYear = a.getFullYear() === b.getFullYear();
  const start = a.getMonth() === b.getMonth() && sameYear ? String(a.getDate()) : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
  return `vs. ${start} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}${sameYear ? "" : ` ${b.getFullYear()}`}`;
}

// Variación contra el período anterior: { text: "+8%", tone: "up" | "down" | "flat" } o null.
export function change(current, previous) {
  if (previous == null) return null;
  if (!(previous > 0)) return current > 0 ? { text: "nuevo", tone: "up" } : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`, tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

// Dinero: sin centavos si es entero o pasa de mil.
export const money = (value) => formatMoney(value, Number.isInteger(value) || Math.abs(value) >= 1000 ? 0 : 2);

// Unidades: «26,000» o, de 10 000 en adelante, «26k» / «45.5k» (tarjetas angostas).
export function units(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) <= 10000) return formatNumber(n);
  const k = Math.round((n / 1000) * 10) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

// Etapas de los pedidos activos y la clave de grupo de Pedidos (lib/orderList.js PEDIDO_GROUPS).
export const ORDER_STAGES = {
  Pendiente: { label: "Pendiente", key: "pendiente" },
  Procesando: { label: "Procesando", key: "procesando" },
  "En Fabricación": { label: "En fabricación", key: "fabricacion" },
  Empacado: { label: "Empacado", key: "empacado" },
  "En Tránsito": { label: "En tránsito", key: "transito" },
};

// «2026-10-12» -> Date local de ese día; «2026-10» -> día 1 de ese mes.
export const dayDate = (key) => new Date(`${key}T00:00:00`);
export const monthDate = (key) => new Date(`${key}-01T00:00:00`);
