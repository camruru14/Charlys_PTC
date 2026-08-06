const inventoryController = {};

import inventoryModel from "../models/InventoryItem.js";

// SELECT
inventoryController.getItems = async (req, res) => {
  const items = await inventoryModel.find().sort({ category: 1, name: 1 });
  res.json(items);
};

// SELECT por id
inventoryController.getItem = async (req, res) => {
  const item = await inventoryModel.findById(req.params.id);
  res.json(item);
};

// INSERT
inventoryController.insertItem = async (req, res) => {
  const { name, category, type, color, unit, stock, minStock, unitCost, location } =
    req.body;

  const newItem = new inventoryModel({
    name,
    category,
    type,
    color,
    unit,
    stock,
    minStock,
    unitCost,
    location,
  });

  await newItem.save();
  res.json({ message: "Inventory item saved" });
};

// ACTUALIZAR
inventoryController.updateItem = async (req, res) => {
  const { name, category, type, color, unit, stock, minStock, unitCost, location } =
    req.body;

  await inventoryModel.findByIdAndUpdate(
    req.params.id,
    { name, category, type, color, unit, stock, minStock, unitCost, location },
    { returnDocument: "after" },
  );

  res.json({ message: "Inventory item updated" });
};

// Eliminar
inventoryController.deleteItem = async (req, res) => {
  await inventoryModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Inventory item deleted" });
};

// Enviar un artículo de "Lotes Reportados" a "Artículos en almacén": lo marca
// como enviado, así pasa a contar también como stock de almacén sin dejar de
// aparecer (ni borrarse) en Lotes Reportados.
inventoryController.sendToWarehouse = async (req, res) => {
  const item = await inventoryModel.findByIdAndUpdate(
    req.params.id,
    { sentToWarehouse: true },
    { returnDocument: "after" },
  );

  if (!item) {
    return res.status(404).json({ message: "Inventory item not found" });
  }

  res.json({ message: "Inventory item sent to warehouse" });
};

export default inventoryController;
