const warehousesController = {};

import warehouseModel from "../models/Warehouse.js";
import inventoryModel from "../models/InventoryItem.js";

// SELECT - todas las bodegas
warehousesController.getWarehouses = async (req, res) => {
  const warehouses = await warehouseModel.find().sort({ name: 1 });
  res.json(warehouses);
};

// INSERT
warehousesController.insertWarehouse = async (req, res) => {
  const { name } = req.body;

  try {
    const newWarehouse = new warehouseModel({ name });
    await newWarehouse.save();
    res.json({ message: "Warehouse saved" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Ya existe una bodega con ese nombre" });
    }
    throw error;
  }
};

// ACTUALIZAR
warehousesController.updateWarehouse = async (req, res) => {
  const { name } = req.body;

  try {
    await warehouseModel.findByIdAndUpdate(req.params.id, { name }, { returnDocument: "after" });
    res.json({ message: "Warehouse updated" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Ya existe una bodega con ese nombre" });
    }
    throw error;
  }
};

// Eliminar. No se permite si la bodega todavía tiene existencia (artículos
// con esa ubicación y stock > 0).
warehousesController.deleteWarehouse = async (req, res) => {
  const warehouse = await warehouseModel.findById(req.params.id);
  if (!warehouse) return res.status(404).json({ message: "Bodega no encontrada" });

  const withStock = await inventoryModel.countDocuments({ location: warehouse.name, stock: { $gt: 0 } });
  if (withStock > 0) {
    return res.status(409).json({ message: `No se puede eliminar «${warehouse.name}»: todavía tiene existencia` });
  }

  await warehouse.deleteOne();
  res.json({ message: "Warehouse deleted" });
};

export default warehousesController;
