const expenseCategoriesController = {};

import mongoose from "mongoose";
import expenseCategoryModel, {
  COLORS,
  ICONS,
  NAME_COLLATION,
  RESERVED_NAMES,
  budgetFor,
  currentMonth,
  isMonth,
  normalizeName,
} from "../models/ExpenseCategory.js";
import transactionModel from "../models/Transaction.js";
import { withTransaction } from "../lib/stock.js";

const sameName = (a, b) => normalizeName(a).localeCompare(normalizeName(b), "es", { sensitivity: "accent" }) === 0;

const isBudget = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

// Primer y último instante (UTC) del mes "AAAA-MM": `date` de las
// transacciones es medianoche UTC (fecha sin hora).
function monthRange(month) {
  const [year, number] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, number - 1, 1)), end: new Date(Date.UTC(year, number, 1)) };
}

// $sum de la base suma en punto flotante (117.99 + 570.32 = 688.3100000000001): se redondea a centavos.
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Todas las categorías (activas y archivadas) por `order` y luego por nombre.
// Con `month`, cada una trae usage: { paid, pending, count, budget } de los
// gastos de ese mes.
async function listCategories(month) {
  const categories = await expenseCategoryModel.find().sort({ order: 1, name: 1 }).collation(NAME_COLLATION);
  if (!month) return categories;

  const { start, end } = monthRange(month);
  const rows = await transactionModel.aggregate([
    { $match: { type: "Gasto", date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$category",
        paid: { $sum: { $cond: [{ $eq: ["$status", "Completado"] }, "$amount", 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "Pendiente"] }, "$amount", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);
  const byName = new Map(rows.map((r) => [r._id, r]));
  return categories.map((category) => {
    const row = byName.get(category.name);
    return {
      ...category.toObject(),
      usage: { paid: round2(row?.paid), pending: round2(row?.pending), count: row?.count ?? 0, budget: budgetFor(category, month) },
    };
  });
}

// Busca una categoría con ese nombre (sin distinguir mayúsculas), distinta de `exceptId`.
const findByName = (name, exceptId) =>
  expenseCategoryModel.findOne({ name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).collation(NAME_COLLATION);

// Valida los campos que vengan en el body. Devuelve { error } o { values }
// con solo los campos presentes (name ya normalizado).
function parseFields(body = {}) {
  const values = {};
  if ("name" in body) {
    const name = normalizeName(body.name);
    if (!name) return { error: "Escribe el nombre de la categoría" };
    if (RESERVED_NAMES.some((reserved) => sameName(reserved, name))) {
      return { error: `«${name}» es un nombre reservado; elige otro` };
    }
    values.name = name;
  }
  if ("icon" in body) {
    if (!ICONS.includes(body.icon)) return { error: "El icono no es válido" };
    values.icon = body.icon;
  }
  if ("color" in body) {
    if (!COLORS.includes(body.color)) return { error: "El color no es válido" };
    values.color = body.color;
  }
  if ("archived" in body) {
    if (typeof body.archived !== "boolean") return { error: "archived debe ser verdadero o falso" };
    values.archived = body.archived;
  }
  if ("order" in body) {
    if (typeof body.order !== "number" || !Number.isFinite(body.order)) return { error: "El orden debe ser un número" };
    values.order = body.order;
  }
  return { values };
}

const duplicateName = (res) => res.status(409).json({ message: "Ya existe una categoría con ese nombre" });

// GET /?usage=AAAA-MM
expenseCategoriesController.getCategories = async (req, res) => {
  const { usage } = req.query;
  if (usage !== undefined && !isMonth(usage)) {
    return res.status(400).json({ message: "El mes debe tener el formato AAAA-MM" });
  }
  res.json(await listCategories(usage));
};

// POST / { name, icon, color, budget }. Un presupuesto >= 0 queda vigente
// desde el mes actual.
expenseCategoriesController.insertCategory = async (req, res) => {
  const body = req.body || {};
  if (!("name" in body)) return res.status(400).json({ message: "Escribe el nombre de la categoría" });
  const { error, values } = parseFields({ name: body.name, ...(body.icon !== undefined && { icon: body.icon }), ...(body.color !== undefined && { color: body.color }) });
  if (error) return res.status(400).json({ message: error });

  const { budget } = body;
  if (budget !== undefined && budget !== null && !isBudget(budget)) {
    return res.status(400).json({ message: typeof budget === "number" ? "El presupuesto no puede ser negativo" : "El presupuesto debe ser un número" });
  }
  if (await findByName(values.name)) return duplicateName(res);

  const last = await expenseCategoryModel.findOne().sort({ order: -1 }).select("order");
  try {
    const created = await expenseCategoryModel.create({
      ...values,
      order: (last?.order ?? -1) + 1,
      budgets: isBudget(budget) ? [{ month: currentMonth(), amount: budget }] : [],
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000) return duplicateName(res);
    throw error;
  }
};

// PUT /:id { name?, icon?, color?, archived?, order? }. Si cambia el nombre,
// los gastos que tenían el nombre anterior pasan al nuevo (todo o nada).
expenseCategoriesController.updateCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Identificador inválido" });
  const { error, values } = parseFields(req.body);
  if (error) return res.status(400).json({ message: error });
  if (values.name && (await findByName(values.name, req.params.id))) return duplicateName(res);

  try {
    const updated = await withTransaction(async (session) => {
      const category = await expenseCategoryModel.findById(req.params.id).session(session);
      if (!category) return null;
      const previousName = category.name;
      category.set(values);
      await category.save({ session });
      if (category.name !== previousName) {
        await transactionModel.updateMany({ type: "Gasto", category: previousName }, { $set: { category: category.name } }, { session });
      }
      return category;
    });
    if (!updated) return res.status(404).json({ message: "Categoría no encontrada" });
    res.json(updated);
  } catch (error) {
    if (error.code === 11000) return duplicateName(res);
    throw error;
  }
};

// PUT /budgets { month: "AAAA-MM", items: [{ id, amount }] }. Guarda todos los
// presupuestos juntos («Guardar cambios»): `amount` >= 0, o null para quitar el
// presupuesto desde ese mes. Solo el mes actual o uno futuro.
expenseCategoriesController.saveBudgets = async (req, res) => {
  const { month, items } = req.body || {};
  if (!isMonth(month)) return res.status(400).json({ message: "El mes debe tener el formato AAAA-MM" });
  if (month < currentMonth()) return res.status(400).json({ message: "No se puede cambiar el presupuesto de un mes pasado" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "No hay presupuestos que guardar" });

  const ids = new Set();
  for (const item of items) {
    if (!mongoose.isValidObjectId(item?.id)) return res.status(400).json({ message: "Categoría no válida" });
    if (item.amount !== null && !isBudget(item.amount)) {
      return res.status(400).json({ message: typeof item.amount === "number" ? "El presupuesto no puede ser negativo" : "El presupuesto debe ser un número o null" });
    }
    if (ids.has(String(item.id))) return res.status(400).json({ message: "Hay una categoría repetida" });
    ids.add(String(item.id));
  }

  const missing = await withTransaction(async (session) => {
    const categories = await expenseCategoryModel.find({ _id: { $in: [...ids] } }).session(session);
    if (categories.length !== ids.size) return true;
    const amountById = new Map(items.map((item) => [String(item.id), item.amount]));
    for (const category of categories) {
      const budgets = category.budgets.filter((entry) => entry.month !== month);
      budgets.push({ month, amount: amountById.get(String(category._id)) });
      budgets.sort((a, b) => a.month.localeCompare(b.month));
      category.budgets = budgets;
      await category.save({ session });
    }
    return false;
  });
  if (missing) return res.status(404).json({ message: "Categoría no encontrada" });

  res.json(await listCategories(month));
};

export default expenseCategoriesController;
