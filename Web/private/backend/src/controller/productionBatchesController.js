const productionBatchesController = {};

import batchModel from "../models/ProductionBatch.js";
import inventoryModel from "../models/InventoryItem.js";
import { HttpError, sendError, withTransaction } from "../lib/stock.js";
import {
  startBatch,
  stopBatch,
  resumeBatch,
  completeBatch,
  reopenBatch,
  sendBatchToWarehouse,
  undoBatchSend,
  stampStatusChange,
} from "../lib/batchFlow.js";
import { packCompletedBatches } from "../lib/orderLines.js";

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

const populateOperator = (query) => query.populate("operator", "name lastName");

// SELECT - todos los lotes
productionBatchesController.getBatches = async (req, res) => {
  try {
    const batches = await populateOperator(batchModel.find()).sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT - un lote por id
productionBatchesController.getBatch = async (req, res) => {
  try {
    const batch = await populateOperator(batchModel.findById(req.params.id));
    res.json(batch);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// INSERT
productionBatchesController.insertBatch = async (req, res) => {
  try {
    const {
      product,
      color,
      productionLine,
      producedQuantity,
      targetQuantity,
      status,
      operator,
      startDate,
    } = req.body;

    const batchNumber = await generateBatchNumber();

    const newBatch = new batchModel({
      batchNumber,
      product,
      color,
      productionLine,
      producedQuantity,
      targetQuantity,
      status,
      operator,
      startDate,
    });
    stampStatusChange(newBatch, "Programado");

    await newBatch.save();

    res.json({ message: "Batch saved", batchNumber });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// ACTUALIZAR. Un lote ya enviado a bodega no cambia producto, color,
// producido ni estado: esas unidades ya están en Inventario (primero se
// deshace el envío).
productionBatchesController.updateBatch = async (req, res) => {
  try {
    const {
      product,
      color,
      productionLine,
      producedQuantity,
      targetQuantity,
      status,
      operator,
      startDate,
      endDate,
    } = req.body;

    const batch = await batchModel.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const previousStatus = batch.status;
    // Los campos que no llegan no se tocan (así editar no borra, p. ej., la Meta).
    const changes = { product, color, productionLine, producedQuantity, targetQuantity, status, operator, startDate, endDate };
    batch.set(Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));

    if (batch.sentToWarehouseAt && ["product", "color", "producedQuantity", "status"].some((f) => batch.isModified(f))) {
      throw new HttpError(
        409,
        `El lote ${batch.batchNumber} ya está en ${batch.destinationWarehouse || "bodega"}: deshaz el envío para cambiar producto, color, producido o estado`,
      );
    }
    stampStatusChange(batch, previousStatus);

    await batch.save();

    res.json({ message: "Batch updated" });
  } catch (error) {
    sendError(res, error);
  }
};

// Cambia el estado de un lote con una de las transiciones de lib/batchFlow y
// responde el lote actualizado (con el operario poblado).
function transition(apply) {
  return async (req, res) => {
    try {
      const batch = await batchModel.findById(req.params.id);
      if (!batch) throw new HttpError(404, "Lote no encontrado");
      await apply(batch, req.body || {});
      await batch.save();
      res.json(await populateOperator(batchModel.findById(batch._id)));
    } catch (error) {
      sendError(res, error);
    }
  };
}

// Programado → En Proceso { productionLine?, operator? }
productionBatchesController.startBatch = transition((batch, body) => startBatch(batch, body));
// En Proceso → Detenido { reason? }
productionBatchesController.stopBatch = transition((batch, body) => stopBatch(batch, body.reason));
// Detenido → En Proceso
productionBatchesController.resumeBatch = transition((batch) => resumeBatch(batch));
// En Proceso → Completado { producedQuantity }
productionBatchesController.completeBatch = transition((batch, body) => completeBatch(batch, body.producedQuantity));
// Completado → En Proceso (Deshacer «Completar»)
productionBatchesController.reopenBatch = transition((batch) => reopenBatch(batch));

// Enviar a bodega { warehouse }: las unidades entran a Producto terminado.
productionBatchesController.sendToWarehouse = async (req, res) => {
  try {
    const { quantity } = await withTransaction((session) =>
      sendBatchToWarehouse(req.params.id, req.body?.warehouse, session),
    );
    const batch = await populateOperator(batchModel.findById(req.params.id));
    res.json({ message: "Batch sent to warehouse", quantity, batch });
  } catch (error) {
    sendError(res, error);
  }
};

// Deshacer el envío a bodega (si esas unidades siguen disponibles).
productionBatchesController.undoSend = async (req, res) => {
  try {
    const { quantity } = await withTransaction((session) => undoBatchSend(req.params.id, session));
    const batch = await populateOperator(batchModel.findById(req.params.id));
    res.json({ message: "Batch send undone", quantity, batch });
  } catch (error) {
    sendError(res, error);
  }
};

// Empacar varios lotes de pedido Completados { batchIds }, todo o nada
// (Fabricación > Pedidos, «Empacar completados»).
productionBatchesController.packCompleted = async (req, res) => {
  try {
    const orders = await withTransaction((session) => packCompletedBatches(req.body?.batchIds, session));
    res.json({ message: "Batches packed", packed: [...new Set((req.body.batchIds || []).map(String))].length, orders: orders.map((o) => o._id) });
  } catch (error) {
    sendError(res, error);
  }
};

// --- Flujo antiguo de «Reportar» ---------------------------------------------
// El panel web ya no lo usa (Fase 5: los lotes se envían directo a bodega).
// Se conserva igual para la app Movil, que todavía reporta lotes y los envía
// desde Inventario > Lotes reportados.

// Registro manual de producción reportada por el empleado. Reporta la misma
// cantidad que ya está guardada como producción del lote, y agrega/actualiza
// el artículo «reportado» (con batchNumber) en Inventario.
productionBatchesController.reportProduction = async (req, res) => {
  try {
    const { producedQuantity, warehouse } = req.body;

    const batch = await batchModel.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    if (batch.sentToWarehouseAt) {
      return res
        .status(409)
        .json({ message: `El lote ${batch.batchNumber} ya está en ${batch.destinationWarehouse || "bodega"}` });
    }

    batch.producedQuantity = Number(producedQuantity || 0);
    batch.lastReportedAt = new Date();

    if (batch.status === "Programado") {
      batch.status = "En Proceso";
      batch.startedAt = batch.startedAt || new Date();
    }

    await batch.save();

    await inventoryModel.findOneAndUpdate(
      { batchNumber: batch.batchNumber },
      {
        name: batch.product,
        category: "Producto Terminado",
        color: batch.color,
        stock: batch.producedQuantity,
        batchNumber: batch.batchNumber,
        location: warehouse,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    res.json({ message: "Production reported" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Revierte un lote a "no reportado": solo se limpia lastReportedAt. No
// guarda el documento, eso queda a cargo de quien llama.
export function resetBatchToUnreported(batch) {
  batch.lastReportedAt = undefined;
}

// Borra el artículo «reportado» de un lote. Si ya se había enviado, sus
// unidades siguen sumadas en el producto terminado real.
export async function releaseReportedItem(item) {
  if (!item) return;
  await inventoryModel.deleteOne({ _id: item._id });
}

// Deshace el reporte de un lote (Movil).
productionBatchesController.undoReport = async (req, res) => {
  try {
    const batch = await batchModel.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const item = await inventoryModel.findOne({ batchNumber: batch.batchNumber });

    resetBatchToUnreported(batch);
    await batch.save();
    await releaseReportedItem(item);

    res.json({ message: "Report undone" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

//Eliminar
productionBatchesController.deleteBatch = async (req, res) => {
  try {
    await batchModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Batch deleted" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default productionBatchesController;
