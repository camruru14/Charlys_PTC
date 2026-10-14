const productionBatchesController = {};

import mongoose from "mongoose";
import batchModel from "../models/ProductionBatch.js";
import inventoryModel from "../models/InventoryItem.js";
import orderModel from "../models/Order.js";
import { HttpError, sendError, withTransaction } from "../lib/stock.js";
import { assertProductName } from "../lib/productName.js";
import {
  startBatch,
  stopBatch,
  resumeBatch,
  completeBatch,
  reopenBatch,
  sendBatchToWarehouse,
  undoBatchSend,
  stampStatusChange,
} from "../lib/batchFlow.js";
import { packCompletedBatches } from "../lib/orderLines.js";
import { recordFor, resolveActivity } from "../lib/activity.js";
import { assertId } from "../lib/ids.js";
import { currentYearSV, formatSequence, maxSequence, nextSequence } from "../lib/counters.js";

// Siguiente número de lote correlativo del año (LOTE-2026-0001, LOTE-2026-0002, ...): contador
// atómico (lib/counters.js). El número nunca se reutiliza, ni siquiera si el lote se borra, así que
// tampoco choca con artículos de Inventario viejos que guardan ese batchNumber (reportes de lote):
// la primera vez el contador se siembra con el mayor número que exista en lotes o en esos artículos.
export async function generateBatchNumber() {
  const key = `LOTE-${currentYearSV()}`;
  const seq = await nextSequence(key, async () =>
    Math.max(await maxSequence(batchModel, "batchNumber", `${key}-`), await maxSequence(inventoryModel, "batchNumber", `${key}-`)),
  );
  return formatSequence(key, seq);
}

const populateOperator = (query) => query.populate("operator", "name lastName photo");

// SELECT - todos los lotes
productionBatchesController.getBatches = async (req, res) => {
  try {
    const batches = await populateOperator(batchModel.find()).sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// SELECT - un lote por id
productionBatchesController.getBatch = async (req, res) => {
  try {
    assertId(req.params.id);
    const batch = await populateOperator(batchModel.findById(req.params.id));
    if (!batch) throw new HttpError(404, "Lote no encontrado");
    res.json(batch);
  } catch (error) {
    sendError(res, error);
  }
};

// INSERT
productionBatchesController.insertBatch = async (req, res) => {
  try {
    const {
      product,
      color,
      productionLine,
      producedQuantity,
      targetQuantity,
      status,
      operator,
      startDate,
    } = req.body ?? {};

    // El producto es el nombre de un producto del Catálogo.
    const productName = await assertProductName(product, { required: true });

    const batchNumber = await generateBatchNumber();

    const newBatch = new batchModel({
      batchNumber,
      product: productName,
      color,
      productionLine,
      producedQuantity,
      targetQuantity,
      status,
      operator,
      startDate,
    });
    stampStatusChange(newBatch, "Programado");

    await newBatch.save();
    await recordFor(req, { keys: ["fabricacion.lotes"], entityType: "batch", entityId: newBatch._id, action: "created" });

    res.json({ message: "Batch saved", batchNumber });
  } catch (error) {
    sendError(res, error);
  }
};

// ACTUALIZAR los datos del lote (producto, color, línea, meta, operario y fechas). El ESTADO y lo
// PRODUCIDO no se editan aquí: solo cambian con las transiciones start / stop / resume / complete /
// reopen, que validan el flujo (lib/batchFlow.js); `status`, `producedQuantity`, `completedAt` y
// demás campos de estado del cuerpo se ignoran. Los campos que no llegan no se tocan.
//  - Un lote de pedido, o ya empacado o enviado a bodega, no cambia producto, color ni meta.
//  - Uno empacado o enviado a bodega tampoco cambia nada más (primero se deshace).
//  - `operator: null` quita el operario.
productionBatchesController.updateBatch = async (req, res) => {
  try {
    assertId(req.params.id);
    const batch = await batchModel.findById(req.params.id);
    if (!batch) throw new HttpError(404, "Lote no encontrado");

    const { product, color, productionLine, targetQuantity, operator, startDate, endDate } = req.body ?? {};

    // Conserva el producto que ya tenía aunque se haya renombrado o eliminado después.
    const productName = await assertProductName(product, { current: batch.product });

    let target;
    if (targetQuantity !== undefined && targetQuantity !== null && targetQuantity !== "") {
      target = Number(targetQuantity);
      if (!Number.isFinite(target) || target < 0) throw new HttpError(400, "La meta debe ser un número de 0 o más");
    }
    if (operator !== undefined && operator !== null && operator !== "" && !mongoose.isValidObjectId(operator)) {
      throw new HttpError(400, "Operario inválido");
    }

    // ¿Cambia el producto, el color o la meta? (reenviar el mismo valor no cuenta)
    const identityChange =
      (productName !== undefined && productName !== batch.product) ||
      (color !== undefined && (color || "") !== (batch.color || "")) ||
      (target !== undefined && target !== (batch.targetQuantity ?? 0));
    const sent = Boolean(batch.sentToWarehouseAt);
    if (identityChange && (batch.category === "Pedido" || batch.packedAt || sent)) {
      throw new HttpError(
        409,
        sent
          ? `El lote ${batch.batchNumber} ya está en ${batch.destinationWarehouse || "bodega"}: deshaz el envío para cambiar producto, color o meta`
          : "Este lote está ligado a un pedido",
      );
    }

    const changes = {
      product: productName,
      color: color === null ? undefined : color,
      productionLine,
      targetQuantity: target,
      startDate: startDate === null ? undefined : startDate,
      endDate: endDate === null ? undefined : endDate,
    };
    const defined = Object.entries(changes).filter(([, v]) => v !== undefined);
    const operatorChange = operator !== undefined;
    if ((defined.length || operatorChange) && (batch.packedAt || sent)) {
      throw new HttpError(409, `El lote ${batch.batchNumber} ya está ${sent ? "en bodega" : "empacado"}: deshazlo para editarlo`);
    }
    batch.set(Object.fromEntries(defined));
    if (operatorChange) batch.operator = operator ? operator : undefined;

    await batch.save();

    res.json({ message: "Batch updated" });
  } catch (error) {
    sendError(res, error);
  }
};

// Novedad de un cambio en un lote. Lotes de Fabricación > Lotes solo muestra los lotes de stock: la
// novedad de un lote de PEDIDO se ve en Fabricación > Pedidos, en el pedido dueño de ese lote
// (la línea con items.manufacturingBatch = lote). Así la burbuja aparece donde se puede abrir y marcar.
async function trackBatch(req, batch, action) {
  if (batch.category !== "Pedido") {
    await recordFor(req, { keys: ["fabricacion.lotes"], entityType: "batch", entityId: batch._id, action });
    return;
  }
  const order = await orderModel.findOne({ "items.manufacturingBatch": batch._id }).select("_id");
  if (order) await recordFor(req, { keys: ["fabricacion.pedidos"], entityType: "order", entityId: order._id, action });
  // Novedades viejas de este lote en Lotes (donde nunca se podían ver): se limpian.
  await resolveActivity({ keys: ["fabricacion.lotes"], entityId: batch._id });
}

// Cambia el estado de un lote con una de las transiciones de lib/batchFlow y
// responde el lote actualizado (con el operario poblado).
function transition(apply, action) {
  return async (req, res) => {
    try {
      const batch = await batchModel.findById(req.params.id);
      if (!batch) throw new HttpError(404, "Lote no encontrado");
      await apply(batch, req.body || {});
      await batch.save();
      await trackBatch(req, batch, action);
      res.json(await populateOperator(batchModel.findById(batch._id)));
    } catch (error) {
      sendError(res, error);
    }
  };
}

// Programado → En Proceso { productionLine?, operator? }
productionBatchesController.startBatch = transition((batch, body) => startBatch(batch, body), "started");
// En Proceso → Detenido { reason? }
productionBatchesController.stopBatch = transition((batch, body) => stopBatch(batch, body.reason), "stopped");
// Detenido → En Proceso
productionBatchesController.resumeBatch = transition((batch) => resumeBatch(batch), "resumed");
// En Proceso → Completado { producedQuantity }
productionBatchesController.completeBatch = transition((batch, body) => completeBatch(batch, body.producedQuantity), "completed");
// Completado → En Proceso (Deshacer «Completar»)
productionBatchesController.reopenBatch = transition((batch) => reopenBatch(batch), "reopened");

// Enviar a bodega { warehouse }: las unidades entran a Producto terminado.
productionBatchesController.sendToWarehouse = async (req, res) => {
  try {
    const { quantity, stockItemId } = await withTransaction((session) =>
      sendBatchToWarehouse(req.params.id, req.body?.warehouse, session),
    );
    // Los lotes de un pedido no se envían a bodega (sendBatchToWarehouse lo rechaza): solo Producto
    // terminado. La fila que cambia en Inventario es el artículo que recibió las unidades.
    await recordFor(req, { keys: ["inventario.terminado"], entityType: "inventory", entityId: stockItemId, action: "sent-to-warehouse" });
    const batch = await populateOperator(batchModel.findById(req.params.id));
    res.json({ message: "Batch sent to warehouse", quantity, batch });
  } catch (error) {
    sendError(res, error);
  }
};

// Deshacer el envío a bodega (si esas unidades siguen disponibles).
productionBatchesController.undoSend = async (req, res) => {
  try {
    const { quantity } = await withTransaction((session) => undoBatchSend(req.params.id, session));
    const batch = await populateOperator(batchModel.findById(req.params.id));
    res.json({ message: "Batch send undone", quantity, batch });
  } catch (error) {
    sendError(res, error);
  }
};

// Empacar varios lotes de pedido Completados { batchIds }, todo o nada
// (Fabricación > Pedidos, «Empacar completados»).
productionBatchesController.packCompleted = async (req, res) => {
  try {
    const orders = await withTransaction((session) => packCompletedBatches(req.body?.batchIds, session));
    // Empacar lo fabricado no mete nada a Inventario: si el pedido queda Empacado completo, Logística lo despacha.
    for (const order of orders) {
      if (order.status === "Empacado") await recordFor(req, { keys: ["logistica.despacho", "pedidos"], entityType: "order", entityId: order._id, action: "packed" });
    }
    res.json({ message: "Batches packed", packed: [...new Set((req.body?.batchIds || []).map(String))].length, orders: orders.map((o) => o._id) });
  } catch (error) {
    sendError(res, error);
  }
};

// Eliminar. Solo un lote Programado que no sea de un pedido ni esté en bodega.
productionBatchesController.deleteBatch = async (req, res) => {
  try {
    assertId(req.params.id);
    const batch = await batchModel.findById(req.params.id);
    if (!batch) throw new HttpError(404, "Lote no encontrado");

    if (await orderModel.exists({ "items.manufacturingBatch": batch._id })) {
      throw new HttpError(409, "Este lote es de un pedido; deshaz el envío a fabricación desde el pedido");
    }
    if (batch.sentToWarehouseAt) {
      throw new HttpError(409, `El lote ${batch.batchNumber} ya está en ${batch.destinationWarehouse || "bodega"}: deshaz el envío antes de eliminarlo`);
    }
    if (batch.status !== "Programado") {
      throw new HttpError(409, `El lote ${batch.batchNumber} está ${batch.status.toLowerCase()}: solo se puede eliminar un lote Programado`);
    }

    await batchModel.deleteOne({ _id: batch._id });
    await resolveActivity({ keys: ["fabricacion.lotes"], entityId: batch._id });
    res.json({ message: "Batch deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

export default productionBatchesController;
