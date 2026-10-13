// Categorías de gasto de Finanzas (colección del backend, administrada en
// Configuración › Categorías de gasto). Portado de
// Web/private/frontend/src/lib/expenseCategories.js: íconos y colores con los
// que se dibujan y el presupuesto de un mes.
import { tones } from "./theme";

// Íconos del backend (ICONS de ExpenseCategory.js) -> nombre de <Icon />.
export const CATEGORY_ICONS = {
  box: "box",
  bag: "orders",
  truck: "truck",
  bolt: "bolt",
  wrench: "wrench",
  doc: "doc",
  people: "users",
  cash: "cash",
  tag: "tag",
};
export const ICON_KEYS = Object.keys(CATEGORY_ICONS);
export const categoryIconName = (icon) => CATEGORY_ICONS[icon] || "tag";

// Colores del backend (COLORS) -> tono de lib/theme.js (gris si no existe).
export const COLOR_KEYS = ["blue", "green", "amber", "purple", "teal", "rose", "gray"];
export const categoryTone = (color) => tones[color] || tones.gray;

// «AAAA-MM» de una fecha (hora local).
export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Presupuesto mensual de una categoría en el mes «AAAA-MM»: la entrada de
// `budgets` con el `month` más alto que sea <= al mes pedido (misma regla que
// el backend). Devuelve el monto, o null si no hay entrada o su monto es null
// (sin presupuesto). Cambiar el presupuesto en octubre no altera septiembre.
export function budgetFor(category, month) {
  let found = null;
  for (const entry of category?.budgets || []) {
    if (entry.month <= month && (!found || entry.month > found.month)) found = entry;
  }
  return found && typeof found.amount === "number" ? found.amount : null;
}

// Texto de un campo de presupuesto -> monto (>= 0) o null si está vacío. NaN si no es válido.
export function parseBudget(text) {
  const clean = String(text ?? "").trim();
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}
