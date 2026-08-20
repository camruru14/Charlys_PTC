const warehousesController = {};

import warehouseModel from "../models/Warehouse.js";

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

// Eliminar
warehousesController.deleteWarehouse = async (req, res) => {
  await warehouseModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Warehouse deleted" });
};

export default warehousesController;
