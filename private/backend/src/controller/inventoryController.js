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
    { new: true },
  );

  res.json({ message: "Inventory item updated" });
};

// Eliminar
inventoryController.deleteItem = async (req, res) => {
  await inventoryModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Inventory item deleted" });
};

export default inventoryController;
