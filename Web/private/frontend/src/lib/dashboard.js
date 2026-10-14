/*
  Textos y cálculos del Dashboard (sin React): comparación contra el período anterior, el rango como
  «mes», etiquetas de las etapas de pedido y formato de dinero. Los datos vienen de GET /dashboard
  (ver backend/src/controller/dashboardController.js).
*/
import { fmtMoney, fmtRange } from "./format";

const MONTHS_DOT = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

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
  return from.getDate() === 1 && to.getDate() === lastDayOf(to.getFullYear(), to.getMonth()) ? { year: from.getFullYear(), month: from.getMonth() } : null;
}

// «este mes» (mes en curso), «en septiembre» (otro mes) o «en el rango».
export function rangeWhen(range, now = new Date()) {
  const m = monthOfRange(range);
  if (!m) return "en el rango";
  if (m.year === now.getFullYear() && m.month === now.getMonth()) return "este mes";
  return `en ${new Date(m.year, m.month, 1).toLocaleDateString("es-SV", { month: "long" })}`;
}

// «vs. sept. al día 12», «vs. sept.» (mes completo) o «vs. 6 – 12 oct 2026»; "" sin período anterior.
export function previousLabel(range) {
  if (!range?.previousFrom || !range?.previousTo) return "";
  const a = new Date(range.previousFrom);
  const b = new Date(range.previousTo);
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (sameMonth && a.getDate() === 1) {
    const name = MONTHS_DOT[a.getMonth()];
    return b.getDate() === lastDayOf(b.getFullYear(), b.getMonth()) ? `vs. ${name}` : `vs. ${name} al día ${b.getDate()}`;
  }
  return `vs. ${fmtRange(a, b)}`;
}

// Variación contra el período anterior: { text: "+8%", tone: "up" | "down" | "flat" } o null si no se puede calcular.
export function change(current, previous) {
  if (previous == null) return null;
  if (!(previous > 0)) return current > 0 ? { text: "nuevo", tone: "up" } : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`, tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

// Dinero para barras y tarjetas: sin centavos si es entero o pasa de mil.
export const money = (value) => fmtMoney(value, Number.isInteger(value) || Math.abs(value) >= 1000 ? 0 : 2);

// Etapas de los pedidos activos y el valor de ?estado= que abre /pedidos en esa etapa.
export const ORDER_STAGES = {
  Pendiente: { label: "Pendiente", key: "pendiente" },
  Procesando: { label: "Procesando", key: "procesando" },
  "En Fabricación": { label: "En fabricación", key: "fabricacion" },
  Empacado: { label: "Empacado", key: "empacado" },
  "En Tránsito": { label: "En tránsito", key: "transito" },
};

// «2026-10-12» -> Date local de ese día.
export const dayDate = (key) => new Date(`${key}T00:00:00`);

// «2026-10» -> Date local del día 1 de ese mes.
export const monthDate = (key) => new Date(`${key}-01T00:00:00`);
