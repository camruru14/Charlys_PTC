const vehiclesController = {};

import mongoose from "mongoose";
import vehicleModel from "../models/Vehicle.js";
import routeModel from "../models/Route.js";
import cloudinary, { uploadVehicleImageBuffer } from "../lib/cloudinary.js";

const MAX_MODEL_LENGTH = 60;

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Ruta sin completar en la que va la placa (la misma regla de availability():
// ocupado = cualquier ruta que no esté Completada, sea del día que sea).
const activeRouteOf = (plate) => routeModel.findOne({ status: { $ne: "Completada" }, vehicle: plate }).select("code number");

// Cómo se nombra la ruta en los mensajes; una ruta vieja sin código usa su número.
const routeName = (route) => route.code || `Ruta ${route.number}`;

// Busca el vehículo de :id (404 si el id no es válido o no existe). Devuelve
// null después de responder.
async function findVehicle(req, res) {
  const vehicle = mongoose.isValidObjectId(req.params.id) ? await vehicleModel.findById(req.params.id) : null;
  if (!vehicle) {
    res.status(404).json({ message: "Vehículo no encontrado" });
    return null;
  }
  return vehicle;
}

// Borra la foto de Cloudinary sin fallar si ya no existe.
const destroyImage = (image) => (image?.publicId ? cloudinary.uploader.destroy(image.publicId).catch(() => null) : null);

const duplicatePlate = (res) => res.status(400).json({ message: "Ya existe un vehículo con esa placa" });

// SELECT - todos los vehículos
vehiclesController.getVehicles = async (req, res) => {
  const vehicles = await vehicleModel.find().sort({ plate: 1 });
  res.json(vehicles);
};

// INSERT. Responde con el vehículo creado (además del message) para que el
// panel suba la foto justo después.
vehiclesController.insertVehicle = async (req, res) => {
  const plate = text(req.body?.plate);
  const model = text(req.body?.model);
  if (!plate) return res.status(400).json({ message: "Escribe la placa del vehículo" });
  if (!model) return res.status(400).json({ message: "Escribe el modelo del vehículo" });
  if (model.length > MAX_MODEL_LENGTH) {
    return res.status(400).json({ message: `El modelo no puede pasar de ${MAX_MODEL_LENGTH} caracteres` });
  }

  try {
    const newVehicle = await vehicleModel.create({ plate, model });
    res.status(201).json({ message: "Vehicle saved", ...newVehicle.toObject() });
  } catch (error) {
    if (error.code === 11000) return duplicatePlate(res);
    throw error;
  }
};

// ACTUALIZAR placa y/o modelo (los que vengan, no vacíos). La placa no se
// cambia mientras el vehículo esté en una ruta sin completar: la ruta guarda
// la placa como texto.
vehiclesController.updateVehicle = async (req, res) => {
  const vehicle = await findVehicle(req, res);
  if (!vehicle) return;

  const body = req.body || {};
  if ("plate" in body) {
    const plate = text(body.plate);
    if (!plate) return res.status(400).json({ message: "Escribe la placa del vehículo" });
    if (plate !== vehicle.plate) {
      const route = await activeRouteOf(vehicle.plate);
      if (route) {
        return res.status(409).json({ message: `No se puede cambiar la placa de «${vehicle.plate}» mientras esté en ${routeName(route)}` });
      }
      vehicle.plate = plate;
    }
  }
  if ("model" in body) {
    const model = text(body.model);
    if (!model) return res.status(400).json({ message: "Escribe el modelo del vehículo" });
    if (model.length > MAX_MODEL_LENGTH) {
      return res.status(400).json({ message: `El modelo no puede pasar de ${MAX_MODEL_LENGTH} caracteres` });
    }
    vehicle.model = model;
  }

  try {
    await vehicle.save();
    res.json(vehicle);
  } catch (error) {
    if (error.code === 11000) return duplicatePlate(res);
    throw error;
  }
};

// Eliminar. No se permite si el vehículo está en CUALQUIER ruta sin completar
// (misma regla que GET /routes/availability). Su foto también se borra.
vehiclesController.deleteVehicle = async (req, res) => {
  const vehicle = await findVehicle(req, res);
  if (!vehicle) return;

  const route = await activeRouteOf(vehicle.plate);
  if (route) {
    return res.status(409).json({ message: `No se puede eliminar «${vehicle.plate}» mientras esté en ${routeName(route)}` });
  }

  await vehicle.deleteOne();
  await destroyImage(vehicle.image);
  res.json({ message: "Vehicle deleted" });
};

// POST /vehicles/:id/image (multipart, campo "image"). Sube la foto nueva,
// guarda el vehículo y borra la foto anterior de Cloudinary.
vehiclesController.setImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecciona una imagen" });
  const vehicle = await findVehicle(req, res);
  if (!vehicle) return;

  const uploaded = await uploadVehicleImageBuffer(req.file.buffer);
  const previous = vehicle.image;
  try {
    vehicle.image = { url: uploaded.secure_url, publicId: uploaded.public_id };
    await vehicle.save();
  } catch (error) {
    // Si no se pudo guardar, la foto recién subida quedaría huérfana.
    await destroyImage({ publicId: uploaded.public_id });
    throw error;
  }
  if (previous?.publicId && previous.publicId !== uploaded.public_id) await destroyImage(previous);
  res.json(vehicle);
};

// DELETE /vehicles/:id/image
vehiclesController.removeImage = async (req, res) => {
  const vehicle = await findVehicle(req, res);
  if (!vehicle) return;

  const previous = vehicle.image;
  vehicle.image = undefined;
  await vehicle.save();
  await destroyImage(previous);
  res.json(vehicle);
};

export default vehiclesController;
