const vehiclesController = {};

import vehicleModel from "../models/Vehicle.js";

// SELECT - todos los vehículos
vehiclesController.getVehicles = async (req, res) => {
  const vehicles = await vehicleModel.find().sort({ plate: 1 });
  res.json(vehicles);
};

// INSERT
vehiclesController.insertVehicle = async (req, res) => {
  const { plate } = req.body;

  try {
    const newVehicle = new vehicleModel({ plate });
    await newVehicle.save();
    res.json({ message: "Vehicle saved" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Ya existe un vehículo con esa placa" });
    }
    throw error;
  }
};

// ACTUALIZAR
vehiclesController.updateVehicle = async (req, res) => {
  const { plate } = req.body;

  try {
    await vehicleModel.findByIdAndUpdate(req.params.id, { plate }, { returnDocument: "after" });
    res.json({ message: "Vehicle updated" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Ya existe un vehículo con esa placa" });
    }
    throw error;
  }
};

// Eliminar
vehiclesController.deleteVehicle = async (req, res) => {
  await vehicleModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Vehicle deleted" });
};

export default vehiclesController;
