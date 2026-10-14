const warehousesController = {};

import mongoose from "mongoose";
import warehouseModel from "../models/Warehouse.js";
import inventoryModel from "../models/InventoryItem.js";
import orderModel from "../models/Order.js";
import batchModel from "../models/ProductionBatch.js";
import { NAME_COLLATION } from "../models/Product.js";
import { HttpError, sendError, withTransaction } from "../lib/stock.js";

// Nombre de bodega normalizado: sin espacios de más y obligatorio.
function cleanName(value) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new HttpError(400, "Escribe el nombre de la bodega");
  return name;
}

const DUPLICATE_NAME = "Ya existe una bodega con ese nombre";

// ¿Hay otra bodega con ese nombre? (sin distinguir mayúsculas ni acentos de más: misma colación que el Catálogo)
const nameTaken = (name, exceptId, session) =>
  warehouseModel
    .exists({ name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .collation(NAME_COLLATION)
    .session(session || null);

// SELECT - todas las bodegas
warehousesController.getWarehouses = async (req, res) => {
  const warehouses = await warehouseModel.find().sort({ name: 1 });
  res.json(warehouses);
};

// INSERT
warehousesController.insertWarehouse = async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (await nameTaken(name)) throw new HttpError(409, DUPLICATE_NAME);
    const newWarehouse = new warehouseModel({ name });
    await newWarehouse.save();
    res.json({ message: "Warehouse saved" });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: DUPLICATE_NAME });
    sendError(res, error);
  }
};

// ACTUALIZAR. Las bodegas se guardan por NOMBRE en las existencias (InventoryItem.location), en las
// líneas de pedido verificadas (verifiedWarehouse) y en los lotes enviados (destinationWarehouse),
// así que renombrar una bodega cambia el nombre en todos esos lugares, en una sola transacción
// (como productionLinesController con las líneas): nada queda apuntando a una bodega que ya no existe.
warehousesController.updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Bodega no encontrada");
    const name = cleanName(req.body?.name);

    await withTransaction(async (session) => {
      const warehouse = await warehouseModel.findById(id).session(session);
      if (!warehouse) throw new HttpError(404, "Bodega no encontrada");
      if (await nameTaken(name, id, session)) throw new HttpError(409, DUPLICATE_NAME);
      if (name === warehouse.name) return;

      const previous = warehouse.name;
      warehouse.name = name;
      await warehouse.save({ session });

      await inventoryModel.updateMany({ location: previous }, { $set: { location: name } }, { session });
      await orderModel.updateMany(
        { "items.verifiedWarehouse": previous },
        { $set: { "items.$[line].verifiedWarehouse": name } },
        { arrayFilters: [{ "line.verifiedWarehouse": previous }], session },
      );
      await batchModel.updateMany({ destinationWarehouse: previous }, { $set: { destinationWarehouse: name } }, { session });
    });

    res.json({ message: "Warehouse updated" });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: DUPLICATE_NAME });
    sendError(res, error);
  }
};

// Eliminar. No se permite si la bodega todavía tiene existencia (artículos con esa ubicación y
// stock > 0), si hay líneas de pedido verificadas con unidades tomadas de ella que todavía no se
// entregan (deshacer esa verificación les devolvería el stock aquí), ni si hay lotes con esa bodega
// como destino que aún no terminaron de enviarse.
warehousesController.deleteWarehouse = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, "Bodega no encontrada");
    const warehouse = await warehouseModel.findById(req.params.id);
    if (!warehouse) throw new HttpError(404, "Bodega no encontrada");

    const withStock = await inventoryModel.countDocuments({ location: warehouse.name, stock: { $gt: 0 } });
    if (withStock > 0) {
      throw new HttpError(409, `No se puede eliminar «${warehouse.name}»: todavía tiene existencia`);
    }

    const pendingLines = await orderModel.countDocuments({
      items: { $elemMatch: { verified: true, verifiedWarehouse: warehouse.name, deliveredAt: null } },
    });
    if (pendingLines > 0) {
      throw new HttpError(409, `No se puede eliminar «${warehouse.name}»: hay pedidos verificados con existencia de esta bodega que todavía no se entregan`);
    }

    const pendingBatches = await batchModel.countDocuments({ destinationWarehouse: warehouse.name, sentToWarehouseAt: null });
    if (pendingBatches > 0) {
      throw new HttpError(409, `No se puede eliminar «${warehouse.name}»: hay lotes con esta bodega como destino pendiente`);
    }

    await warehouse.deleteOne();
    res.json({ message: "Warehouse deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

export default warehousesController;
