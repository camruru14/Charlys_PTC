const dailyBatchesController = {};

import dailyBatchModel from "../models/DailyBatch.js";
import batchModel from "../models/ProductionBatch.js";
import { generateBatchNumber } from "./productionBatchesController.js";

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
  const { date, product, color, targetQuantity } = req.body;

  const dailyBatchNumber = await generateDailyBatchNumber();

  const newBatch = new dailyBatchModel({
    dailyBatchNumber,
    date,
    product,
    color,
    targetQuantity,
  });

  await newBatch.save();

  res.json({ message: "Daily batch saved", dailyBatchNumber });
};

// ACTUALIZAR
dailyBatchesController.updateBatch = async (req, res) => {
  const { date, product, color, targetQuantity } = req.body;

  const batch = await dailyBatchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Daily batch not found" });
  }

  batch.set({ date, product, color, targetQuantity });

  await batch.save();

  res.json({ message: "Daily batch updated" });
};

// Eliminar
dailyBatchesController.deleteBatch = async (req, res) => {
  await dailyBatchModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Daily batch deleted" });
};

// Programar - envía el lote diario a Lotes de fabricación (Línea, Producido,
// Residuos y Operario quedan vacíos y se completan después) y lo quita de Lotes Diarios.
dailyBatchesController.scheduleBatch = async (req, res) => {
  const daily = await dailyBatchModel.findById(req.params.id);

  if (!daily) {
    return res.status(404).json({ message: "Daily batch not found" });
  }

  const batchNumber = await generateBatchNumber();

  const newBatch = new batchModel({
    batchNumber,
    product: daily.product,
    color: daily.color,
    targetQuantity: daily.targetQuantity,
    startDate: daily.date,
    status: "Programado",
  });

  await newBatch.save();
  await dailyBatchModel.findByIdAndDelete(req.params.id);

  res.json({ message: "Daily batch scheduled", batchNumber });
};

export default dailyBatchesController;
