import batchModel from "../models/ProductionBatch.js";
import inventoryModel from "../models/InventoryItem.js";
import orderModel from "../models/Order.js";
import { HttpError, addFinishedStock, takeStock } from "./stock.js";

/*
  Flujo de un lote de fabricación (Fase 5):
    Programado → start → En Proceso ⇄ (stop / resume) Detenido
    En Proceso → complete → Completado («Por enviar» si no es de pedido)
    Completado → send-to-warehouse → «En bodega» (las unidades entran a
    Inventario → Producto terminado en ese momento).
  Reversas: reopen (Completado → En Proceso) y undo-send.
  Cada función valida el estado y modifica el lote; guardar queda a cargo de
  quien llama, salvo las de envío, que corren dentro de una transacción.
*/

function requireStatus(batch, status, action) {
  if (batch.status !== status) {
    throw new HttpError(409, `El lote ${batch.batchNumber} está ${batch.status}; no se puede ${action}`);
  }
}

export function startBatch(batch, { productionLine, operator } = {}) {
  requireStatus(batch, "Programado", "iniciar");
  if (productionLine) batch.productionLine = productionLine;
  if (operator) batch.operator = operator;
  if (!batch.productionLine) throw new HttpError(400, "Elige la línea de producción para iniciar el lote");
  batch.status = "En Proceso";
  batch.startedAt = new Date();
}

export function stopBatch(batch, reason) {
  requireStatus(batch, "En Proceso", "detener");
  batch.status = "Detenido";
  batch.stoppedAt = new Date();
  batch.stopReason = typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
}

export function resumeBatch(batch) {
  requireStatus(batch, "Detenido", "reanudar");
  batch.status = "En Proceso";
  batch.stoppedAt = undefined;
  batch.stopReason = undefined;
}

export function completeBatch(batch, producedQuantity) {
  requireStatus(batch, "En Proceso", "completar");
  const produced = Number(producedQuantity);
  if (producedQuantity === "" || producedQuantity == null || !Number.isInteger(produced) || produced < 0) {
    throw new HttpError(400, "Ingresa las unidades producidas (número entero, 0 o más)");
  }
  batch.producedQuantity = produced;
  batch.status = "Completado";
  batch.completedAt = new Date();
}

// Reabrir (Deshacer «Completar»): solo si lo producido no salió del lote,
// es decir, si no se envió a bodega ni se empacó para un pedido.
export async function reopenBatch(batch) {
  requireStatus(batch, "Completado", "reabrir");
  if (batch.sentToWarehouseAt) {
    throw new HttpError(409, `El lote ${batch.batchNumber} ya está en bodega; primero deshaz el envío`);
  }
  const packedForOrder =
    batch.packedAt ||
    (await orderModel.exists({
      items: {
        $elemMatch: {
          manufacturingBatch: batch._id,
          $or: [{ packed: true }, { manufacturePackedAt: { $exists: true, $ne: null } }],
        },
      },
    }));
  if (packedForOrder) {
    throw new HttpError(409, `Lo fabricado en el lote ${batch.batchNumber} ya se empacó para su pedido; no se puede reabrir`);
  }
  batch.status = "En Proceso";
  batch.completedAt = undefined;
}

// Enviar a bodega: suma a inventario solo lo que falta por contar
// (producedQuantity − sentQuantity), así llamarlo otra vez nunca duplica.
export async function sendBatchToWarehouse(batchId, warehouse, session) {
  const batch = await batchModel.findById(batchId).session(session);
  if (!batch) throw new HttpError(404, "Lote no encontrado");
  if (batch.category === "Pedido") {
    throw new HttpError(409, `El lote ${batch.batchNumber} es de un pedido: se empaca para ese pedido, no se envía a bodega`);
  }
  if (batch.status !== "Completado") {
    throw new HttpError(409, `Completa el lote ${batch.batchNumber} antes de enviarlo a bodega`);
  }
  if (batch.sentToWarehouseAt) {
    throw new HttpError(409, `El lote ${batch.batchNumber} ya está en ${batch.destinationWarehouse || "bodega"}`);
  }
  if (!warehouse) throw new HttpError(400, "Elige la bodega de destino");

  const now = new Date();
  const quantity = Math.max(0, (batch.producedQuantity || 0) - (batch.sentQuantity || 0));
  if (quantity > 0) {
    await addFinishedStock(
      {
        product: batch.product,
        color: batch.color,
        warehouse,
        quantity,
        inbound: { quantity, batchNumber: batch.batchNumber, at: now },
      },
      session,
    );
  }
  batch.sentToWarehouseAt = now;
  batch.destinationWarehouse = warehouse;
  batch.sentQuantity = batch.producedQuantity || 0;
  await batch.save({ session });

  // Si Movil reportó este lote (artículo con batchNumber), queda marcado como
  // enviado para que Movil no vuelva a sumar esas unidades.
  await inventoryModel.updateMany({ batchNumber: batch.batchNumber }, { sentToWarehouse: true }, { session });
  return { batch, quantity };
}

// Deshacer el envío: resta de la bodega las unidades que sumó el envío, solo
// si siguen disponibles (descuento atómico y condicionado).
export async function undoBatchSend(batchId, session) {
  const batch = await batchModel.findById(batchId).session(session);
  if (!batch) throw new HttpError(404, "Lote no encontrado");
  if (!batch.sentToWarehouseAt) throw new HttpError(409, `El lote ${batch.batchNumber} no se ha enviado a bodega`);

  const quantity = batch.sentQuantity || 0;
  const warehouse = batch.destinationWarehouse;
  if (quantity > 0) {
    let item;
    try {
      item = await takeStock({ product: batch.product, color: batch.color, warehouse, quantity }, session);
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        throw new HttpError(
          409,
          `No se puede deshacer: las ${quantity.toLocaleString("es-SV")} unidades del lote ${batch.batchNumber} ya no están disponibles en ${warehouse}`,
        );
      }
      throw error;
    }
    if (item.lastInbound?.batchNumber === batch.batchNumber) {
      await inventoryModel.updateOne({ _id: item._id }, { $unset: { lastInbound: "" } }, { session });
    }
  }
  batch.sentToWarehouseAt = undefined;
  batch.destinationWarehouse = undefined;
  batch.sentQuantity = 0;
  await batch.save({ session });
  await inventoryModel.updateMany({ batchNumber: batch.batchNumber }, { sentToWarehouse: false }, { session });
  return { batch, quantity };
}

// Al cambiar el estado desde «Editar» se completan las fechas del flujo que
// falten, para que el detalle muestre inicio y fin.
export function stampStatusChange(batch, previousStatus) {
  if (batch.status === previousStatus) return;
  const now = new Date();
  if (batch.status !== "Programado" && !batch.startedAt) batch.startedAt = now;
  if (batch.status === "Completado" && !batch.completedAt) batch.completedAt = now;
  if (batch.status !== "Completado") batch.completedAt = undefined;
  if (batch.status === "Detenido" && !batch.stoppedAt) batch.stoppedAt = now;
  if (batch.status !== "Detenido") {
    batch.stoppedAt = undefined;
    batch.stopReason = undefined;
  }
  if (batch.status === "Programado") batch.startedAt = undefined;
}
