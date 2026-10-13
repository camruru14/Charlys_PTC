import { Schema, model } from "mongoose";

// Categorías de gasto de Finanzas. Se administran en Configuración › Categorías
// de gasto (antes estaban escritas en el código). El `name` es el que guardan
// las transacciones de gasto en su campo `category`.

// Sin distinguir mayúsculas (strength 2): "Servicios" y "servicios" son el
// mismo nombre (mismo criterio que el nombre de los productos).
export const NAME_COLLATION = { locale: "es", strength: 2 };

export const ICONS = ["box", "bag", "truck", "bolt", "wrench", "doc", "people", "cash", "tag"];
export const COLORS = ["blue", "green", "amber", "purple", "teal", "rose", "gray"];

// Nombres que usan las transacciones automáticas o de ingreso: no pueden ser
// categorías de gasto.
export const RESERVED_NAMES = ["Ventas", "Otros ingresos"];

// Recorta y colapsa los espacios del nombre.
export const normalizeName = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// ¿Es un mes "AAAA-MM" válido?
export const isMonth = (value) => typeof value === "string" && MONTH_PATTERN.test(value);

// Mes actual "AAAA-MM" en la zona horaria de la empresa (El Salvador), igual que
// el resto del backend, para que el servidor (UTC en Render) no adelante el mes
// en las últimas horas del último día.
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit" }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}`;
}

// Presupuesto mensual de una categoría: la entrada con el `month` más alto que
// sea <= al mes pedido ("AAAA-MM"). Devuelve el monto, o null si no hay
// ninguna entrada, o si esa entrada es null (presupuesto quitado). Así cambiar
// el presupuesto en octubre no altera septiembre.
export function budgetFor(category, month) {
  let found = null;
  for (const entry of category?.budgets || []) {
    if (entry.month <= month && (!found || entry.month > found.month)) found = entry;
  }
  return found && typeof found.amount === "number" ? found.amount : null;
}

const budgetSchema = new Schema(
  {
    month: { type: String, required: true, match: MONTH_PATTERN }, // "AAAA-MM": vigente desde ese mes
    amount: { type: Number, min: 0, default: null }, // null = sin presupuesto desde ese mes
  },
  { _id: false },
);

const expenseCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, set: normalizeName },
    icon: { type: String, enum: ICONS, default: "tag" },
    color: { type: String, enum: COLORS, default: "gray" },
    archived: { type: Boolean, default: false },
    order: { type: Number }, // orden de la lista
    budgets: { type: [budgetSchema], default: [] },
  },
  { timestamps: true },
);

// Nombre único sin distinguir mayúsculas (strength 2).
expenseCategorySchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION });

export default model("ExpenseCategory", expenseCategorySchema);
