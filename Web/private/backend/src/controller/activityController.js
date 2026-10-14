const activityController = {};

import mongoose from "mongoose";
import activityModel from "../models/Activity.js";
import activitySeenModel from "../models/ActivitySeen.js";
import employeeModel from "../models/Employee.js";
import { ACTIVITY_KEYS, KEY_MODULES, moduleOfKey } from "../lib/activityKeys.js";
import { employeeModules } from "../lib/permissions.js";
import { HttpError, sendError } from "../lib/stock.js";

// Punto de partida de quien nunca marcó nada, si no se conoce su fecha de alta
// (lo normal es usar el createdAt del empleado): así no le llueve todo el
// historial al estrenar las novedades.
const FALLBACK_START = new Date();

// Máximo de ids sin ver que se devuelven por pestaña (el conteo sí es completo).
const MAX_UNSEEN_IDS = 200;
// Máximo de registros que se pueden marcar vistos en una sola llamada (entityIds).
const MAX_SEEN_BATCH = 200;

// Pestañas a las que tiene acceso el empleado: las de sus módulos (lib/permissions.js).
const accessibleKeys = (employee) => {
  const modules = new Set(employeeModules(employee));
  return ACTIVITY_KEYS.filter((key) => modules.has(KEY_MODULES[key]));
};

/*
  { counts: { key: n }, modules: { modulo: n }, unseen: { key: [entityId, …] } }
  del empleado. Un registro (entityId) está sin ver en una pestaña si tiene
  actividad en esa clave posterior a su `seenAt` por registro Y a la base del
  empleado en esa clave (ver models/ActivitySeen.js). Se cuentan registros
  DISTINTOS, no acciones. Una sola agregación.
*/
async function countsFor(employeeId) {
  const employee = await employeeModel.findById(employeeId).lean();
  if (!employee?.isActive) throw new HttpError(404, "No se encontró tu cuenta");

  const keys = accessibleKeys(employee);
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  const unseen = Object.fromEntries(keys.map((k) => [k, []]));

  if (keys.length) {
    const bases = await activitySeenModel.find({ employee: employee._id, key: { $in: keys }, entityId: null }).lean();
    const baseOf = new Map(bases.map((b) => [b.key, b.seenAt]));
    const start = employee.createdAt || FALLBACK_START;
    const since = Object.fromEntries(keys.map((k) => [k, new Date(baseOf.get(k) || start)]));
    const earliest = new Date(Math.min(...Object.values(since).map((d) => d.getTime())));

    const rows = await activityModel.aggregate([
      { $match: { keys: { $in: keys }, at: { $gt: earliest } } },
      { $unwind: "$keys" },
      { $match: { keys: { $in: keys } } },
      { $group: { _id: { key: "$keys", entity: "$entityId" }, last: { $max: "$at" } } },
      {
        $lookup: {
          from: activitySeenModel.collection.name,
          let: { key: "$_id.key", entity: "$_id.entity" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$employee", employee._id] }, { $eq: ["$key", "$$key"] }, { $eq: ["$entityId", "$$entity"] }] } } },
            { $project: { _id: 0, seenAt: 1 } },
          ],
          as: "seen",
        },
      },
      {
        $addFields: {
          seenAt: { $max: "$seen.seenAt" },
          base: { $switch: { branches: keys.map((k) => ({ case: { $eq: ["$_id.key", k] }, then: since[k] })), default: earliest } },
        },
      },
      {
        $match: {
          $expr: { $and: [{ $gt: ["$last", "$base"] }, { $or: [{ $eq: [{ $ifNull: ["$seenAt", null] }, null] }, { $gt: ["$last", "$seenAt"] }] }] },
        },
      },
      { $sort: { last: -1 } },
      { $group: { _id: "$_id.key", count: { $sum: 1 }, ids: { $push: "$_id.entity" } } },
      { $project: { count: 1, ids: { $slice: ["$ids", MAX_UNSEEN_IDS] } } },
    ]);
    rows.forEach((r) => {
      counts[r._id] = r.count;
      unseen[r._id] = r.ids.map(String);
    });
  }

  const modules = {};
  for (const [key, count] of Object.entries(counts)) {
    const name = moduleOfKey(key);
    modules[name] = (modules[name] || 0) + count;
  }
  return { counts, modules, unseen };
}

function sessionEmployee(req) {
  if (!mongoose.isValidObjectId(req.user?.id)) throw new HttpError(401, "Sesión inválida");
  return new mongoose.Types.ObjectId(req.user.id);
}

// GET /activity/counts
activityController.getCounts = async (req, res) => {
  try {
    res.json(await countsFor(sessionEmployee(req)));
  } catch (error) {
    sendError(res, error);
  }
};

// El «visto» nunca queda antes de la última actividad que ya existe: la tienda
// registra sus pedidos desde otro servidor (otro reloj), y si el suyo va
// adelantado una actividad con `at` > ahora dejaría el registro sin ver aunque
// el empleado lo acabe de abrir. Por eso seenAt = max(ahora, última actividad).
const later = (now, at) => (at && at > now ? at : now);

// Marca vistos los registros `ids` (ObjectId) de la pestaña `key`: una sola
// consulta con la última actividad de cada uno y un solo bulkWrite.
async function markRecordsSeen(employee, key, ids) {
  const now = new Date();
  const rows = await activityModel.aggregate([
    { $match: { keys: key, entityId: { $in: ids } } },
    { $group: { _id: "$entityId", last: { $max: "$at" } } },
  ]);
  const lastOf = new Map(rows.map((r) => [String(r._id), r.last]));
  await activitySeenModel.bulkWrite(
    ids.map((entityId) => ({
      updateOne: {
        filter: { employee, key, entityId },
        update: { $set: { seenAt: later(now, lastOf.get(String(entityId))) } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

// POST /activity/seen: el empleado vio algo (solo se limpia para él).
//   { key, entityId }    un registro que abrió en esa pestaña
//   { key, entityIds }   varios registros a la vez (hasta 200), p. ej. las ventas de un día
//   { key, all: true }   TODO lo de la pestaña (mueve su base a ahora)
// Responde los conteos actualizados.
activityController.markSeen = async (req, res) => {
  try {
    const employee = sessionEmployee(req);
    const { key, entityId, entityIds, all } = req.body || {};
    if (!ACTIVITY_KEYS.includes(key)) throw new HttpError(400, "Pestaña inválida");

    if (all === true) {
      const now = new Date();
      const newest = await activityModel.findOne({ keys: key }).sort({ at: -1 }).select("at").lean();
      await activitySeenModel.updateOne({ employee, key, entityId: null }, { $set: { seenAt: later(now, newest?.at) } }, { upsert: true });
      // Lo anterior a la base ya está visto: los «vistos» por registro sobran.
      await activitySeenModel.deleteMany({ employee, key, entityId: { $ne: null } });
    } else {
      const raw = Array.isArray(entityIds) ? entityIds : [entityId];
      if (!raw.length || !raw.every((id) => mongoose.isValidObjectId(id))) throw new HttpError(400, "Registro inválido");
      const ids = [...new Set(raw.map(String))];
      if (ids.length > MAX_SEEN_BATCH) throw new HttpError(400, `Máximo ${MAX_SEEN_BATCH} registros por llamada`);
      await markRecordsSeen(employee, key, ids.map((id) => new mongoose.Types.ObjectId(id)));
    }
    res.json(await countsFor(employee));
  } catch (error) {
    sendError(res, error);
  }
};

export default activityController;
