import { useMemo } from "react";
import { useFetch } from "../hooks/useFetch";
import { IconBolt, IconBox, IconCash, IconDoc, IconOrders, IconTag, IconTruck, IconUsers, IconWrench } from "./icons";

/*
  Categorías de gasto de Finanzas (colección del backend, administrada en
  Configuración › Categorías de gasto). Aquí viven los íconos y colores con los
  que se dibujan, el presupuesto de un mes y el hook que las lee.
*/

// Íconos del backend (ICONS de ExpenseCategory.js) -> ícono del panel.
export const CATEGORY_ICONS = {
  box: IconBox,
  bag: IconOrders,
  truck: IconTruck,
  bolt: IconBolt,
  wrench: IconWrench,
  doc: IconDoc,
  people: IconUsers,
  cash: IconCash,
  tag: IconTag,
};
export const ICON_KEYS = Object.keys(CATEGORY_ICONS);
export const categoryIcon = (icon) => CATEGORY_ICONS[icon] || IconTag;

// Colores del backend (COLORS) -> clases tone-* (literales, para que Tailwind las vea).
//   soft: fondo + texto · dot: color sólido (puntos y barras) · border: borde del chip elegido
//   cssVar: el mismo color sólido para los degradados de las barras rayadas
export const COLOR_KEYS = ["blue", "green", "amber", "purple", "teal", "rose", "gray"];
const TONES = {
  blue: { soft: "bg-tone-blue text-tone-blue-text", dot: "bg-tone-blue-dot", border: "border-tone-blue-dot", cssVar: "var(--color-tone-blue-dot)" },
  green: { soft: "bg-tone-green text-tone-green-text", dot: "bg-tone-green-dot", border: "border-tone-green-dot", cssVar: "var(--color-tone-green-dot)" },
  amber: { soft: "bg-tone-amber text-tone-amber-text", dot: "bg-tone-amber-dot", border: "border-tone-amber-dot", cssVar: "var(--color-tone-amber-dot)" },
  purple: { soft: "bg-tone-purple text-tone-purple-text", dot: "bg-tone-purple-dot", border: "border-tone-purple-dot", cssVar: "var(--color-tone-purple-dot)" },
  teal: { soft: "bg-tone-teal text-tone-teal-text", dot: "bg-tone-teal-dot", border: "border-tone-teal-dot", cssVar: "var(--color-tone-teal-dot)" },
  rose: { soft: "bg-tone-rose text-tone-rose-text", dot: "bg-tone-rose-dot", border: "border-tone-rose-dot", cssVar: "var(--color-tone-rose-dot)" },
  gray: { soft: "bg-tone-gray text-tone-gray-text", dot: "bg-tone-gray-dot", border: "border-tone-gray-dot", cssVar: "var(--color-tone-gray-dot)" },
};
export const categoryTone = (color) => TONES[color] || TONES.gray;

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

/*
  Categorías de gasto (activas y archivadas, ordenadas por el backend).
    const { categories, loading, error, refetch, mutate } = useExpenseCategories();
  Con { usage: "2026-10" } cada una trae además usage { paid, pending, count, budget }
  de ese mes (Configuración).
*/
export function useExpenseCategories({ usage } = {}) {
  const { data, loading, error, refetch, mutate } = useFetch(usage ? `/expense-categories?usage=${usage}` : "/expense-categories");
  const categories = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  return { categories, loading, error, refetch, mutate };
}

// Texto de un campo de presupuesto -> monto (>= 0) o null si está vacío. NaN si no es válido.
export function parseBudget(text) {
  const clean = String(text ?? "").trim();
  if (clean === "") return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

/*
  Presupuestos editados en Configuración y todavía sin guardar. `draft` es
  { [id]: texto del campo }; el presupuesto guardado del mes en curso viene en
  usage.budget (GET /expense-categories?usage=AAAA-MM). Devuelve
  [{ category, from, to }] solo con los que cambiaron (to puede ser null = quitar).
*/
export function budgetChanges(categories, draft) {
  const changes = [];
  for (const category of categories) {
    if (draft[category._id] === undefined) continue;
    const from = category.usage?.budget ?? null;
    const to = parseBudget(draft[category._id]);
    if (Number.isNaN(to) || to !== from) changes.push({ category, from, to });
  }
  return changes;
}
