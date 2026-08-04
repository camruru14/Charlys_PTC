const productionBatchesController = {};

import batchModel from "../models/ProductionBatch.js";

// Genera el siguiente número de lote correlativo del año (LOTE-2026-0001, LOTE-2026-0002, ...)
export async function generateBatchNumber() {
  const prefix = `LOTE-${new Date().getFullYear()}-`;
  const last = await batchModel
    .findOne({ batchNumber: { $regex: `^${prefix}` } })
    .sort({ batchNumber: -1 });

  const lastNumber = last ? parseInt(last.batchNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

// SELECT - todos los lotes
productionBatchesController.getBatches = async (req, res) => {
  const batches = await batchModel
    .find()
    .populate("operator", "name lastName")
    .sort({ createdAt: -1 });
  res.json(batches);
};

// SELECT - un lote por id
productionBatchesController.getBatch = async (req, res) => {
  const batch = await batchModel
    .findById(req.params.id)
    .populate("operator", "name lastName");
  res.json(batch);
};

// INSERT
productionBatchesController.insertBatch = async (req, res) => {
  const {
    product,
    color,
    productionLine,
    targetQuantity,
    producedQuantity,
    wasteQuantity,
    status,
    operator,
    rawMaterials,
    startDate,
  } = req.body;

  const batchNumber = await generateBatchNumber();

  const newBatch = new batchModel({
    batchNumber,
    product,
    color,
    productionLine,
    targetQuantity,
    producedQuantity,
    wasteQuantity,
    status,
    operator,
    rawMaterials,
    startDate,
  });

  await newBatch.save();

  res.json({ message: "Batch saved", batchNumber });
};

// ACTUALIZAR
productionBatchesController.updateBatch = async (req, res) => {
  const {
    product,
    color,
    productionLine,
    targetQuantity,
    producedQuantity,
    wasteQuantity,
    status,
    qualityCheck,
    operator,
    rawMaterials,
    startDate,
    endDate,
  } = req.body;

  const batch = await batchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Batch not found" });
  }

  batch.set({
    product,
    color,
    productionLine,
    targetQuantity,
    producedQuantity,
    wasteQuantity,
    status,
    qualityCheck,
    operator,
    rawMaterials,
    startDate,
    endDate,
  });

  await batch.save();

  res.json({ message: "Batch updated" });
};

// Registro manual de producción reportada por el empleado
productionBatchesController.reportProduction = async (req, res) => {
  const { producedQuantity, wasteQuantity } = req.body;

  const batch = await batchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Batch not found" });
  }

  // Acumulamos lo reportado sobre lo ya producido
  batch.producedQuantity += Number(producedQuantity || 0);
  batch.wasteQuantity += Number(wasteQuantity || 0);

  if (batch.status === "Programado") {
    batch.status = "En Proceso";
  }

  await batch.save();

  res.json({ message: "Production reported", wastePercentage: batch.wastePercentage });
};

//Eliminar
productionBatchesController.deleteBatch = async (req, res) => {
  await batchModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Batch deleted" });
};

export default productionBatchesController;
