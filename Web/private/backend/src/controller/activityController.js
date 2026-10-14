const activityController = {};

import mongoose from "mongoose";
import activityModel from "../models/Activity.js";
import activitySeenModel from "../models/ActivitySeen.js";
import employeeModel from "../models/Employee.js";
import { ACTIVITY_KEYS, KEY_MODULES, moduleOfKey } from "../lib/activityKeys.js";
import { employeeModules } from "../lib/permissions.js";
import { HttpError, sendError } from "../lib/stock.js";

// Punto de partida de quien nunca abrió una pestaña, si no se conoce su fecha
// de alta (lo normal es usar el createdAt del empleado): así no le llueve todo
// el historial al estrenar las burbujas.
const FALLBACK_START = new Date();

// Pestañas a las que tiene acceso el empleado: las de sus módulos (lib/permissions.js).
const accessibleKeys = (employee) => {
  const modules = new Set(employeeModules(employee));
  return ACTIVITY_KEYS.filter((key) => modules.has(KEY_MODULES[key]));
};

// { counts: { "fabricacion.pedidos": 1, … }, modules: { fabricacion: 1, … } } del
// empleado: por cada pestaña suya, los elementos DISTINTOS (entityId) con
// actividad posterior a su «visto». Una sola agregación.
async function countsFor(employeeId) {
  const employee = await employeeModel.findById(employeeId).lean();
  if (!employee?.isActive) throw new HttpError(404, "No se encontró tu cuenta");

  const keys = accessibleKeys(employee);
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  if (keys.length) {
    const seen = await activitySeenModel.find({ employee: employee._id, key: { $in: keys } }).lean();
    const seenAt = new Map(seen.map((s) => [s.key, s.seenAt]));
    const start = employee.createdAt || FALLBACK_START;
    const since = Object.fromEntries(keys.map((k) => [k, seenAt.get(k) || start]));
    const earliest = new Date(Math.min(...Object.values(since).map((d) => new Date(d).getTime())));

    const rows = await activityModel.aggregate([
      { $match: { keys: { $in: keys }, at: { $gt: earliest } } },
      { $unwind: "$keys" },
      { $match: { keys: { $in: keys } } },
      {
        $addFields: {
          since: { $switch: { branches: keys.map((k) => ({ case: { $eq: ["$keys", k] }, then: new Date(since[k]) })), default: earliest } },
        },
      },
      { $match: { $expr: { $gt: ["$at", "$since"] } } },
      { $group: { _id: { key: "$keys", entity: "$entityId" } } },
      { $group: { _id: "$_id.key", count: { $sum: 1 } } },
    ]);
    rows.forEach((r) => {
      counts[r._id] = r.count;
    });
  }

  const modules = {};
  for (const [key, count] of Object.entries(counts)) {
    const name = moduleOfKey(key);
    modules[name] = (modules[name] || 0) + count;
  }
  return { counts, modules };
}

// GET /activity/counts
activityController.getCounts = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user?.id)) throw new HttpError(401, "Sesión inválida");
    res.json(await countsFor(req.user.id));
  } catch (error) {
    sendError(res, error);
  }
};

// POST /activity/seen { key }: el empleado abrió esa pestaña; su contador vuelve
// a 0 (solo el suyo). Responde los conteos actualizados.
activityController.markSeen = async (req, res) => {
  try {
    const key = req.body?.key;
    if (!ACTIVITY_KEYS.includes(key)) throw new HttpError(400, "Pestaña inválida");
    if (!mongoose.isValidObjectId(req.user?.id)) throw new HttpError(401, "Sesión inválida");
    await activitySeenModel.updateOne({ employee: req.user.id, key }, { $set: { seenAt: new Date() } }, { upsert: true });
    res.json(await countsFor(req.user.id));
  } catch (error) {
    sendError(res, error);
  }
};

export default activityController;
