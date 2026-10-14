const dailyBatchesController = {};

import dailyBatchModel from "../models/DailyBatch.js";
import batchModel from "../models/ProductionBatch.js";
import { generateBatchNumber } from "./productionBatchesController.js";
import { assertProductName } from "../lib/productName.js";
import { HttpError, sendError, withTransaction } from "../lib/stock.js";
import { recordFor, resolveActivity } from "../lib/activity.js";

// Genera el siguiente número de lote diario correlativo (LTE-DIARIO-0001, LTE-DIARIO-0002, ...)
async function generateDailyBatchNumber() {
  const prefix = "LTE-DIARIO-";
  const last = await dailyBatchModel
    .findOne({ dailyBatchNumber: { $regex: `^${prefix}` } })
    .sort({ dailyBatchNumber: -1 });

  const lastNumber = last ? parseInt(last.dailyBatchNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

const MAX_TARGET = 9999999;

// Valida la meta (unidades a producir): entero entre 1 y 9 999 999. Acepta un
// número o un string numérico. Devuelve { value } o { error } con el mensaje del 400.
function parseTarget(raw) {
  const text = typeof raw === "string" ? raw.trim() : raw;
  if (text === undefined || text === null || text === "") return { error: "Escribe la meta del lote (unidades)." };
  const value = typeof text === "string" ? (/^\d+$/.test(text) ? Number(text) : NaN) : text;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_TARGET) {
    return { error: "La meta debe ser un número entero entre 1 y 9 999 999." };
  }
  return { value };
}

// SELECT - todos los lotes diarios
dailyBatchesController.getBatches = async (req, res) => {
  const batches = await dailyBatchModel.find().sort({ createdAt: -1 });
  res.json(batches);
};

// SELECT - un lote diario por id
dailyBatchesController.getBatch = async (req, res) => {
  const batch = await dailyBatchModel.findById(req.params.id);
  res.json(batch);
};

// INSERT
dailyBatchesController.insertBatch = async (req, res) => {
  const { date, product, color } = req.body;

  const target = parseTarget(req.body.targetQuantity);
  if (target.error) return res.status(400).json({ message: target.error });

  // El producto es el nombre de un producto del Catálogo.
  const productName = await assertProductName(product, { required: true });

  const dailyBatchNumber = await generateDailyBatchNumber();

  const newBatch = new dailyBatchModel({
    dailyBatchNumber,
    date,
    product: productName,
    color,
    targetQuantity: target.value,
  });

  await newBatch.save();
  await recordFor(req, { keys: ["fabricacion.diaria"], entityType: "dailyBatch", entityId: newBatch._id, action: "created" });

  res.json({ message: "Daily batch saved", dailyBatchNumber });
};

// ACTUALIZAR
dailyBatchesController.updateBatch = async (req, res) => {
  const { date, product, color } = req.body;

  const batch = await dailyBatchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Daily batch not found" });
  }

  // Al editar la meta también es obligatoria (los lotes anteriores sin meta se completan aquí).
  const target = parseTarget(req.body.targetQuantity);
  if (target.error) return res.status(400).json({ message: target.error });

  // Conserva el producto que ya tenía aunque se haya renombrado o eliminado después.
  const productName = await assertProductName(product, { current: batch.product });

  // Los campos que no llegan no se tocan (un PUT parcial no borra el color ni pisa la fecha).
  const changes = { date, product: productName, color, targetQuantity: target.value };
  batch.set(Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));

  await batch.save();
  await recordFor(req, { keys: ["fabricacion.diaria"], entityType: "dailyBatch", entityId: batch._id, action: "updated" });

  res.json({ message: "Daily batch updated" });
};

// Eliminar
dailyBatchesController.deleteBatch = async (req, res) => {
  await dailyBatchModel.findByIdAndDelete(req.params.id);
  await resolveActivity({ keys: ["fabricacion.diaria"], entityId: req.params.id });
  res.json({ message: "Daily batch deleted" });
};

// Programar - envía el lote diario a Lotes de fabricación (Línea, Producido
// y Operario quedan vacíos y se completan después) y lo quita de Lotes Diarios.
// El lote diario debe tener meta: pasa a targetQuantity del lote de fabricación.
// Todo en una transacción y borrando el lote diario PRIMERO: si dos clics (o dos usuarios)
// programan el mismo lote a la vez, solo uno lo encuentra para borrarlo y el otro recibe 409.
dailyBatchesController.scheduleBatch = async (req, res) => {
  try {
    const daily = await dailyBatchModel.findById(req.params.id);

    if (!daily) {
      return res.status(404).json({ message: "Daily batch not found" });
    }

    if (!daily.targetQuantity) {
      return res.status(400).json({ message: `Agrega la meta de ${daily.dailyBatchNumber} antes de programarlo.` });
    }

    // El número se reserva antes (contador atómico): nunca se reutiliza.
    const batchNumber = await generateBatchNumber();

    const newBatch = await withTransaction(async (session) => {
      const taken = await dailyBatchModel.findOneAndDelete({ _id: req.params.id }, { session });
      if (!taken) throw new HttpError(409, "Ese lote ya se programó");
      const [created] = await batchModel.create(
        [
          {
            batchNumber,
            product: taken.product,
            color: taken.color,
            targetQuantity: taken.targetQuantity,
            startDate: taken.date,
            status: "Programado",
          },
        ],
        { session },
      );
      return created;
    });

    // El lote diario sale de Lotes diarios (pasa a Lotes): su novedad de ahí ya no se puede abrir.
    await resolveActivity({ keys: ["fabricacion.diaria"], entityId: req.params.id });
    // Programar crea un lote de stock (no de un pedido): su novedad va en Lotes.
    await recordFor(req, { keys: ["fabricacion.lotes"], entityType: "batch", entityId: newBatch._id, action: "scheduled" });

    res.json({ message: "Daily batch scheduled", batchNumber });
  } catch (error) {
    sendError(res, error);
  }
};

export default dailyBatchesController;
