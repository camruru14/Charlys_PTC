const productionBatchesController = {};

import batchModel from "../models/ProductionBatch.js";
import inventoryModel from "../models/InventoryItem.js";

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

// Registro manual de producción reportada por el empleado. Reporta la misma
// cantidad que ya está guardada como producción del lote (no se acumula ni
// se recalcula aparte), así el número que llega a Inventario siempre
// coincide con el que se ve en la columna "Producido" de Fabricación.
productionBatchesController.reportProduction = async (req, res) => {
  const { producedQuantity, warehouse } = req.body;

  const batch = await batchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Batch not found" });
  }

  batch.producedQuantity = Number(producedQuantity || 0);
  batch.lastReportedAt = new Date();

  if (batch.status === "Programado") {
    batch.status = "En Proceso";
  }

  await batch.save();

  // Reportar el lote también lo agrega/actualiza en Inventario como Producto
  // Terminado. El artículo se llama "Producto - Color" (o solo "Producto" si
  // el lote no tiene color). Un mismo lote (mismo batchNumber) actualiza
  // siempre el mismo artículo en vez de crear uno nuevo en cada reporte.
  const articleName = batch.color ? `${batch.product} - ${batch.color}` : batch.product;

  await inventoryModel.findOneAndUpdate(
    { batchNumber: batch.batchNumber },
    {
      name: articleName,
      category: "Producto Terminado",
      color: batch.color,
      stock: batch.producedQuantity,
      batchNumber: batch.batchNumber,
      location: warehouse,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  res.json({ message: "Production reported", wastePercentage: batch.wastePercentage });
};

// Revierte un lote a "no reportado": solo se limpia lastReportedAt (para que
// vuelva a mostrar el botón "Reportar"). Producción, residuos y estado no se
// tocan, el lote queda igual que estaba antes de deshacer el reporte. No
// guarda el documento, eso queda a cargo de quien llama (así se puede reusar
// sobre un batch ya cargado).
export function resetBatchToUnreported(batch) {
  batch.lastReportedAt = undefined;
}

// Libera el artículo de Inventario vinculado a un lote reportado: si ya se
// había enviado a almacén, se conserva ahí (sigue contando como stock real)
// pero se desvincula del lote; si nunca se envió, se borra por completo ya
// que nunca llegó a ser stock real de almacén.
export async function releaseReportedItem(item) {
  if (!item) return;
  if (item.sentToWarehouse) {
    await inventoryModel.updateOne({ _id: item._id }, { $unset: { batchNumber: "" } });
  } else {
    await inventoryModel.deleteOne({ _id: item._id });
  }
}

// Deshace el reporte de un lote (botón "Reportado" en Fabricación, o
// "Eliminar" en Inventario > Lotes Reportados).
productionBatchesController.undoReport = async (req, res) => {
  const batch = await batchModel.findById(req.params.id);

  if (!batch) {
    return res.status(404).json({ message: "Batch not found" });
  }

  const item = await inventoryModel.findOne({ batchNumber: batch.batchNumber });

  resetBatchToUnreported(batch);
  await batch.save();
  await releaseReportedItem(item);

  res.json({ message: "Report undone" });
};

//Eliminar
productionBatchesController.deleteBatch = async (req, res) => {
  await batchModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Batch deleted" });
};

export default productionBatchesController;
