const inventoryController = {};

import mongoose from "mongoose";
import inventoryModel from "../models/InventoryItem.js";
import batchModel from "../models/ProductionBatch.js";
import { HttpError, addFinishedStock, sendError, withTransaction } from "../lib/stock.js";
import { recordFor, resolveActivity } from "../lib/activity.js";
import { assertId } from "../lib/ids.js";
import { assertProductName } from "../lib/productName.js";

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
    assertId(req.params.id);
    const item = await inventoryModel.findById(req.params.id);
    if (!item) throw new HttpError(404, "Artículo no encontrado");
    res.json(item);
  } catch (error) {
    sendError(res, error);
  }
};

// Cantidad (existencia, mínimo…) válida: un número que no sea negativo.
function parseAmount(value, label) {
  const amount = typeof value === "boolean" ? NaN : Number(value);
  if (value === "" || value === null || !Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, `${label} debe ser un número de 0 o más`);
  }
  return amount;
}

// INSERT
inventoryController.insertItem = async (req, res) => {
  try {
    const { name, category, type, materialType, color, unit, stock, minStock, unitCost, location } =
      req.body ?? {};

    // El nombre de un producto terminado es el de un producto del Catálogo.
    const itemName = category === "Producto Terminado" ? await assertProductName(name, { required: true }) : name;

    if (stock !== undefined) parseAmount(stock, "La existencia");
    if (minStock !== undefined) parseAmount(minStock, "El mínimo");
    if (unitCost !== undefined) parseAmount(unitCost, "El costo");

    // Un solo «Producto Terminado» por producto, color y bodega (sin batchNumber): las
    // existencias se suman al que ya existe, no se duplican.
    if (category === "Producto Terminado") {
      const duplicate = await inventoryModel.exists({
        category: "Producto Terminado",
        name: itemName,
        color: color || { $in: [null, ""] },
        location: location || { $in: [null, ""] },
        batchNumber: { $exists: false },
      });
      if (duplicate) throw new HttpError(409, "Ya existe ese producto en esa bodega; edita su existencia");
    }

    const newItem = new inventoryModel({
      name: itemName,
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
    const key = category === "Producto Terminado" ? "inventario.terminado" : "inventario.materia";
    await recordFor(req, { keys: [key], entityType: "inventory", entityId: newItem._id, action: "created" });
    res.json({ message: "Inventory item saved" });
  } catch (error) {
    sendError(res, error);
  }
};

// ACTUALIZAR. Los campos que no llegan no se tocan. Si llega `stock` hay que mandar también
// `expectedStock` (la existencia que el usuario vio al abrir el artículo): el cambio solo se
// aplica si la existencia sigue siendo esa, así editar un artículo nunca pisa las unidades que
// entraron (lote enviado a bodega) o salieron (pedido verificado) mientras tanto.
inventoryController.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Identificador inválido");
    const existing = await inventoryModel.findById(id);
    if (!existing) throw new HttpError(404, "Artículo no encontrado");

    const { name, category, type, materialType, color, unit, stock, expectedStock, minStock, unitCost, location } =
      req.body ?? {};

    // Un producto terminado conserva su nombre aunque el producto se haya
    // renombrado o eliminado del Catálogo; un nombre nuevo debe existir en él.
    // La categoría es la que llega o, si no llega, la ya guardada.
    const finalCategory = category ?? existing.category;
    const itemName = finalCategory === "Producto Terminado" ? await assertProductName(name, { current: existing.name }) : name;

    const changes = { name: itemName, category, type, materialType, color, unit, minStock, unitCost, location };
    if (minStock !== undefined) changes.minStock = parseAmount(minStock, "El mínimo");
    if (unitCost !== undefined) changes.unitCost = parseAmount(unitCost, "El costo");

    // Un solo «Producto Terminado» por producto, color y bodega (sin batchNumber), igual que al crear:
    // solo se revisa si cambia alguno de esos datos (así un artículo ya duplicado de antes se sigue
    // pudiendo editar en lo demás). Excluye al propio artículo.
    if (finalCategory === "Producto Terminado" && !existing.batchNumber) {
      const finalName = itemName ?? existing.name;
      const finalColor = color !== undefined ? color : existing.color;
      const finalLocation = location !== undefined ? location : existing.location;
      const identityChanged =
        existing.category !== "Producto Terminado" ||
        finalName !== existing.name ||
        (finalColor || "") !== (existing.color || "") ||
        (finalLocation || "") !== (existing.location || "");
      if (identityChanged) {
        const duplicate = await inventoryModel.exists({
          _id: { $ne: id },
          category: "Producto Terminado",
          name: finalName,
          color: finalColor || { $in: [null, ""] },
          location: finalLocation || { $in: [null, ""] },
          batchNumber: { $exists: false },
        });
        if (duplicate) throw new HttpError(409, "Ya existe ese producto en esa bodega; edita su existencia");
      }
    }

    const filter = { _id: id };
    if (stock !== undefined) {
      const wanted = parseAmount(stock, "La existencia");
      const hasExpected = expectedStock !== undefined && expectedStock !== null && Number.isFinite(Number(expectedStock));
      if (!hasExpected) {
        // Sin expectedStock solo se acepta la existencia que ya está guardada («sin cambio»); un valor
        // distinto podría pisar unidades que entraron o salieron mientras se editaba.
        if (wanted !== Number(existing.stock)) {
          throw new HttpError(400, "Falta la existencia que viste al abrir el artículo (expectedStock)");
        }
      } else if (wanted !== Number(expectedStock)) {
        // Sin cambio de existencia no hay nada que proteger ni que pisar.
        changes.stock = wanted;
        filter.stock = Number(expectedStock);
      }
    }

    const updated = await inventoryModel.findOneAndUpdate(
      filter,
      { $set: Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      const current = await inventoryModel.findById(id);
      if (!current) throw new HttpError(404, "Artículo no encontrado");
      throw new HttpError(409, `La existencia cambió mientras editabas (ahora hay ${current.stock}). Vuelve a abrir el artículo.`);
    }

    res.json({ message: "Inventory item updated" });
  } catch (error) {
    sendError(res, error);
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
      // Ya no hay fila que abrir: su novedad (en la pestaña de su categoría) se quita.
      await resolveActivity({ keys: [item.category === "Producto Terminado" ? "inventario.terminado" : "inventario.materia"], entityId: item._id });
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
    let stockItemId = null;
    const found = await withTransaction(async (session) => {
      const item = await inventoryModel.findById(req.params.id).session(session);
      if (!item || !item.batchNumber) return false;
      if (item.sentToWarehouse) return true;

      const batch = await batchModel.findOne({ batchNumber: item.batchNumber }).session(session);
      if (!batch?.sentToWarehouseAt) {
        const now = new Date();
        const stock = await addFinishedStock(
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
        stockItemId = stock?._id;
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
    // La fila que cambia en Producto terminado es el artículo que recibió las unidades.
    await recordFor(req, { keys: ["inventario.terminado"], entityType: "inventory", entityId: stockItemId, action: "sent-to-warehouse" });
    res.json({ message: "Inventory item sent to warehouse" });
  } catch (error) {
    sendError(res, error);
  }
};

export default inventoryController;
