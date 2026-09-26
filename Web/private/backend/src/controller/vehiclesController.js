const vehiclesController = {};

import vehicleModel from "../models/Vehicle.js";
import routeModel from "../models/Route.js";
import { parseDay } from "../lib/routes.js";

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

// Eliminar. No se permite si el vehículo está en una ruta activa de hoy (misma
// regla que GET /routes/availability).
vehiclesController.deleteVehicle = async (req, res) => {
  const vehicle = await vehicleModel.findById(req.params.id);
  if (!vehicle) return res.status(404).json({ message: "Vehículo no encontrado" });

  const onRoute = await routeModel.exists({ date: parseDay(), status: { $ne: "Completada" }, vehicle: vehicle.plate });
  if (onRoute) {
    return res.status(409).json({ message: `No se puede eliminar «${vehicle.plate}»: está en una ruta de hoy` });
  }

  await vehicle.deleteOne();
  res.json({ message: "Vehicle deleted" });
};

export default vehiclesController;
