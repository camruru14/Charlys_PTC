const inventoryController = {};

import inventoryModel from "../models/InventoryItem.js";
import batchModel from "../models/ProductionBatch.js";
import { resetBatchToUnreported, releaseReportedItem } from "./productionBatchesController.js";
import { addFinishedStock, sendError, withTransaction } from "../lib/stock.js";

// SELECT
inventoryController.getItems = async (req, res) => {
  try {
    const items = await inventoryModel.find().sort({ category: 1, name: 1 });
    res.json(items);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT por id
inventoryController.getItem = async (req, res) => {
  try {
    const item = await inventoryModel.findById(req.params.id);
    res.json(item);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// INSERT
inventoryController.insertItem = async (req, res) => {
  try {
    const { name, category, type, materialType, color, unit, stock, minStock, unitCost, location } =
      req.body;

    const newItem = new inventoryModel({
      name,
      category,
      type,
      materialType,
      color,
      unit,
      stock,
      minStock,
      unitCost,
      location,
    });

    await newItem.save();
    res.json({ message: "Inventory item saved" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// ACTUALIZAR
inventoryController.updateItem = async (req, res) => {
  try {
    const { name, category, type, materialType, color, unit, stock, minStock, unitCost, location } =
      req.body;

    await inventoryModel.findByIdAndUpdate(
      req.params.id,
      { name, category, type, materialType, color, unit, stock, minStock, unitCost, location },
      { returnDocument: "after" },
    );

    res.json({ message: "Inventory item updated" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Eliminar un artículo de "Artículos en almacén". Los productos terminados
// que llegan por un lote reportado viven en un artículo aparte (sin
// batchNumber, ver sendToWarehouse), así que esto nunca borra un reporte de
// "Lotes Reportados". Se deja igual una salvaguarda por si alguna vez se
// llama con el id de un artículo que sí tenga batchNumber: en ese caso solo
// se desmarca "sentToWarehouse" en lugar de borrarlo.
inventoryController.deleteItem = async (req, res) => {
  try {
    const item = await inventoryModel.findById(req.params.id);

    if (!item) {
      return res.json({ message: "Inventory item deleted" });
    }

    if (item.batchNumber) {
      await inventoryModel.updateOne({ _id: item._id }, { sentToWarehouse: false });
    } else {
      await inventoryModel.deleteOne({ _id: item._id });
    }

    res.json({ message: "Inventory item deleted" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Flujo antiguo (solo lo usa la app Movil; el panel web envía los lotes
// directo con PATCH /productionBatches/:id/send-to-warehouse). Envía un
// artículo «reportado» (con batchNumber) al producto terminado real con el
// mismo artículo, color y bodega (se suma, o se crea si no existe) y lo marca
// como enviado. También marca su lote como enviado, y si el lote ya lo había
// enviado el panel, no vuelve a sumar nada: así nunca se cuenta dos veces.
inventoryController.sendToWarehouse = async (req, res) => {
  try {
    const found = await withTransaction(async (session) => {
      const item = await inventoryModel.findById(req.params.id).session(session);
      if (!item || !item.batchNumber) return false;
      if (item.sentToWarehouse) return true;

      const batch = await batchModel.findOne({ batchNumber: item.batchNumber }).session(session);
      if (!batch?.sentToWarehouseAt) {
        const now = new Date();
        await addFinishedStock(
          {
            product: item.name,
            color: item.color,
            warehouse: item.location,
            quantity: item.stock || 0,
            unit: item.unit,
            unitCost: item.unitCost,
            inbound: { quantity: item.stock || 0, batchNumber: item.batchNumber, at: now },
          },
          session,
        );
        if (batch) {
          batch.sentToWarehouseAt = now;
          batch.destinationWarehouse = item.location;
          batch.sentQuantity = item.stock || 0;
          await batch.save({ session });
        }
      }
      item.sentToWarehouse = true;
      await item.save({ session });
      return true;
    });

    if (!found) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    res.json({ message: "Inventory item sent to warehouse" });
  } catch (error) {
    sendError(res, error);
  }
};

// Eliminar un lote reportado desde Inventario > Lotes Reportados: revierte el
// lote a "no reportado" en Fabricación y borra su artículo de "Lotes
// Reportados". Si ya se había enviado a almacén, esas unidades quedan sumadas
// sin cambios en el producto terminado de Artículos en almacén al que se
// enviaron (son artículos distintos, ver sendToWarehouse), así que esto no le
// resta stock a almacén.
inventoryController.undoReport = async (req, res) => {
  try {
    const item = await inventoryModel.findById(req.params.id);

    if (!item || !item.batchNumber) {
      return res.status(404).json({ message: "Reported item not found" });
    }

    const batch = await batchModel.findOne({ batchNumber: item.batchNumber });
    if (batch) {
      resetBatchToUnreported(batch);
      await batch.save();
    }

    await releaseReportedItem(item);

    res.json({ message: "Report undone" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default inventoryController;
