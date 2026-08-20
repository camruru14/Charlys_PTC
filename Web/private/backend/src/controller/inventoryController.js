const inventoryController = {};

import inventoryModel from "../models/InventoryItem.js";
import batchModel from "../models/ProductionBatch.js";
import { resetBatchToUnreported, releaseReportedItem } from "./productionBatchesController.js";

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

// Enviar un artículo de "Lotes Reportados" a "Artículos en almacén". Compara
// artículo + color + bodega contra los productos terminados que ya existen
// en Artículos en almacén (esos nunca llevan batchNumber, sea porque se
// agregaron a mano o porque ya son el destino de envíos anteriores):
// - Si hay coincidencia: solo se suman las unidades reportadas a las que ya
//   tenía ese producto (no se crea una fila nueva ni duplicada).
// - Si no hay coincidencia: se crea el producto terminado en Artículos en
//   almacén con las unidades reportadas.
// En ambos casos el artículo de Lotes Reportados se marca como enviado, pero
// conserva su propia existencia sin tocar (así "Producido" en Fabricación
// y "Existencia" en Lotes Reportados siempre coinciden), y sigue apareciendo
// ahí sin borrarse.
inventoryController.sendToWarehouse = async (req, res) => {
  try {
    const item = await inventoryModel.findById(req.params.id);

    if (!item || !item.batchNumber) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const target = await inventoryModel.findOne({
      _id: { $ne: item._id },
      category: item.category,
      name: item.name,
      color: item.color,
      location: item.location,
      batchNumber: { $exists: false },
    });

    if (target) {
      target.stock = (target.stock || 0) + (item.stock || 0);
      await target.save();
    } else {
      await inventoryModel.create({
        name: item.name,
        category: item.category,
        color: item.color,
        unit: item.unit,
        stock: item.stock,
        unitCost: item.unitCost,
        location: item.location,
      });
    }

    item.sentToWarehouse = true;
    await item.save();

    res.json({ message: "Inventory item sent to warehouse" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
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
