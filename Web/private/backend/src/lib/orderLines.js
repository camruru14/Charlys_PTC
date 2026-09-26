import batchModel from "../models/ProductionBatch.js";
import { generateBatchNumber } from "../controller/productionBatchesController.js";
import { HttpError, takeStock, returnStock } from "./stock.js";

/*
  Operaciones sobre una línea (item) de un pedido desde Inventario y
  Fabricación. Cada una valida el estado actual de la línea, mueve stock o
  lotes con la `session` de la transacción y deja la línea modificada en
  memoria; guardar el pedido y recalcular su status queda a cargo de quien
  llama (ver ordersController).

  Una línea puede estar:
  - Sin procesar.
  - Verificada: se tomó `quantity` de verifiedWarehouse.
  - En fabricación: sentToManufacturing + manufacturingBatch (lote «Pedido»).
  - Dividida: fromStockQty tomado de verifiedWarehouse (verified) y
    toManufactureQty enviado a fabricar (sentToManufacturing +
    manufacturingBatch). Cada parte se empaca por separado: stockPackedAt
    (Almacén) y manufacturePackedAt (Fabricación); `packed` solo es true
    cuando las dos lo están.
  - Empacada (packed): en Almacén o Fabricación (packedLocation), o las dos
    partes de una línea dividida.
*/

export function isSplit(item) {
  return item.fromStockQty != null && item.toManufactureQty != null;
}

// Cantidad tomada de bodega por esta línea (toda la línea o la parte dividida).
export function takenQty(item) {
  return isSplit(item) ? item.fromStockQty : item.quantity;
}

// La línea tiene stock tomado de bodega: verificada desde Inventario (toda o
// la parte dividida). Una línea fabricada completa también queda con
// verified=true al empacarse en Fabricación, pero nunca tomó stock.
export function hasStockTaken(item) {
  return Boolean(item.verified && (isSplit(item) || !item.sentToManufacturing));
}

export function lineLabel(item) {
  return `${item.product}${item.color ? ` · ${item.color}` : ""}`;
}

// Algún empaque hecho sobre la línea (completo o de una de sus partes).
export function hasAnyPack(item) {
  return Boolean(item.packed || item.stockPackedAt || item.manufacturePackedAt);
}

// Ubicaciones donde el pedido tiene algo empacado esperando al motorista.
export function packedLocations(order) {
  const items = order.items || [];
  const locations = [];
  if (items.some((i) => (i.packed && i.packedLocation === "Almacén") || i.stockPackedAt)) locations.push("Almacén");
  if (items.some((i) => (i.packed && i.packedLocation === "Fabricación") || i.manufacturePackedAt)) locations.push("Fabricación");
  return locations;
}

function isUntouched(item) {
  return !item.verified && !item.sentToManufacturing && !item.manufacturingBatch && !hasAnyPack(item) && !isSplit(item);
}

async function createOrderBatch(item, targetQuantity, session) {
  const batchNumber = await generateBatchNumber();
  const [batch] = await batchModel.create(
    [
      {
        batchNumber,
        product: item.product,
        color: item.color,
        category: "Pedido",
        status: "Programado",
        targetQuantity,
      },
    ],
    { session },
  );
  return batch;
}

// Borra el lote de la línea si todavía está Programado; si ya empezó, rechaza.
async function discardProgrammedBatch(item, session) {
  if (!item.manufacturingBatch) return;
  const batchId = item.manufacturingBatch._id || item.manufacturingBatch;
  const batch = await batchModel.findById(batchId).session(session);
  if (!batch) return;
  if (batch.status !== "Programado") {
    throw new HttpError(409, `El lote ${batch.batchNumber} de ${lineLabel(item)} ya está ${batch.status.toLowerCase()}; no se puede deshacer`);
  }
  await batchModel.deleteOne({ _id: batch._id }, { session });
}

function clearVerification(item) {
  item.verified = false;
  item.verifiedWarehouse = undefined;
  item.verifiedAt = undefined;
}

function clearManufacturing(item) {
  item.sentToManufacturing = false;
  item.sentToManufacturingAt = undefined;
  item.manufacturingBatch = undefined;
  item.manufacturedAt = undefined;
}

function clearPacking(item) {
  item.packed = false;
  item.packedAt = undefined;
  item.packedLocation = undefined;
  item.stockPackedAt = undefined;
  item.manufacturePackedAt = undefined;
}

function clearSplit(item) {
  item.fromStockQty = undefined;
  item.toManufactureQty = undefined;
}

// Deja la línea sin ningún avance (no mueve stock ni lotes).
export function resetLine(item) {
  clearVerification(item);
  clearManufacturing(item);
  clearPacking(item);
  clearSplit(item);
}

// Verificar: toma toda la cantidad de la bodega elegida.
export async function verifyLine(item, warehouse, session) {
  if (!isUntouched(item)) throw new HttpError(409, `${lineLabel(item)} ya fue procesado`);
  await takeStock({ product: item.product, color: item.color, warehouse, quantity: item.quantity }, session);
  item.verified = true;
  item.verifiedWarehouse = warehouse;
  item.verifiedAt = new Date();
}

// Deshacer verificar: devuelve el stock (solo si no está empacada).
export async function unverifyLine(item, session) {
  if (isSplit(item)) throw new HttpError(409, `${lineLabel(item)} está dividida: deshaz la división`);
  if (!item.verified || item.sentToManufacturing) throw new HttpError(409, `${lineLabel(item)} no está verificado`);
  if (item.packed) throw new HttpError(409, `${lineLabel(item)} ya está empacado: primero deshaz el empaque`);
  await returnStock({ product: item.product, color: item.color, warehouse: item.verifiedWarehouse, quantity: item.quantity }, session);
  clearVerification(item);
}

// Empacar en Almacén: toda la línea verificada, o la parte tomada de bodega
// de una línea dividida.
export function packLine(item) {
  const now = new Date();
  if (isSplit(item)) {
    if (item.stockPackedAt) throw new HttpError(409, `La parte de bodega de ${lineLabel(item)} ya está empacada`);
    item.stockPackedAt = now;
    if (item.manufacturePackedAt) {
      item.packed = true;
      item.packedAt = now;
    }
    return;
  }
  if (!item.verified || item.sentToManufacturing) throw new HttpError(409, `Verifica ${lineLabel(item)} antes de empacarlo`);
  if (item.packed) throw new HttpError(409, `${lineLabel(item)} ya está empacado`);
  item.packed = true;
  item.packedAt = now;
  item.packedLocation = "Almacén";
}

// Deshacer empacar en Almacén: solo si el motorista no recogió en Almacén.
export function unpackLine(item, order) {
  if (order.delivery?.pickupWarehouseAt) {
    throw new HttpError(409, `El motorista ya recogió en Almacén; no se puede desempacar ${lineLabel(item)}`);
  }
  if (isSplit(item)) {
    if (!item.stockPackedAt) throw new HttpError(409, `La parte de bodega de ${lineLabel(item)} no está empacada`);
    item.stockPackedAt = undefined;
    item.packed = false;
    item.packedAt = undefined;
    return;
  }
  if (!item.packed) throw new HttpError(409, `${lineLabel(item)} no está empacado`);
  if (item.packedLocation !== "Almacén") {
    throw new HttpError(409, `${lineLabel(item)} se empacó en Fabricación; se deshace desde Fabricación`);
  }
  item.packed = false;
  item.packedAt = undefined;
  item.packedLocation = undefined;
}

// Enviar a fabricación: crea el lote Programado (meta = cantidad) en el mismo
// paso. También cubre líneas enviadas antes sin lote (alias /manufacture).
export async function sendLineToManufacturing(item, session) {
  if (item.manufacturingBatch) throw new HttpError(409, `${lineLabel(item)} ya tiene un lote de fabricación`);
  if (!item.sentToManufacturing && !isUntouched(item)) throw new HttpError(409, `${lineLabel(item)} ya fue procesado`);
  const batch = await createOrderBatch(item, item.quantity, session);
  const now = new Date();
  if (!item.sentToManufacturing) {
    item.sentToManufacturing = true;
    item.sentToManufacturingAt = now;
  }
  item.manufacturingBatch = batch._id;
  item.manufacturedAt = now;
  return batch;
}

// Deshacer enviar a fabricación: borra el lote si sigue Programado y
// regresa la línea a sin procesar.
export async function cancelLineManufacturing(item, session) {
  if (isSplit(item)) throw new HttpError(409, `${lineLabel(item)} está dividida: deshaz la división`);
  if (!item.sentToManufacturing) throw new HttpError(409, `${lineLabel(item)} no está en fabricación`);
  if (hasAnyPack(item)) throw new HttpError(409, `${lineLabel(item)} ya está empacado`);
  await discardProgrammedBatch(item, session);
  clearManufacturing(item);
}

// Dividir con existencia parcial: toma `quantity` de la bodega y manda el
// resto a fabricar (lote Programado con meta = resto).
export async function splitLine(item, warehouse, quantity, session) {
  if (!isUntouched(item)) throw new HttpError(409, `${lineLabel(item)} ya fue procesado`);
  const fromStock = Number(quantity);
  if (!Number.isInteger(fromStock) || fromStock <= 0 || fromStock >= item.quantity) {
    throw new HttpError(400, `La cantidad a tomar debe estar entre 1 y ${item.quantity - 1}`);
  }
  const rest = item.quantity - fromStock;
  await takeStock({ product: item.product, color: item.color, warehouse, quantity: fromStock }, session);
  const batch = await createOrderBatch(item, rest, session);
  const now = new Date();
  item.fromStockQty = fromStock;
  item.toManufactureQty = rest;
  item.verified = true;
  item.verifiedWarehouse = warehouse;
  item.verifiedAt = now;
  item.sentToManufacturing = true;
  item.sentToManufacturingAt = now;
  item.manufacturingBatch = batch._id;
  item.manufacturedAt = now;
  return batch;
}

// Deshacer la división: devuelve lo tomado y borra el lote si sigue Programado.
export async function unsplitLine(item, session) {
  if (!isSplit(item)) throw new HttpError(409, `${lineLabel(item)} no está dividida`);
  if (hasAnyPack(item)) throw new HttpError(409, `${lineLabel(item)} ya tiene una parte empacada: primero deshaz el empaque`);
  await discardProgrammedBatch(item, session);
  await returnStock({ product: item.product, color: item.color, warehouse: item.verifiedWarehouse, quantity: item.fromStockQty }, session);
  resetLine(item);
}

// Empacar lo fabricado para el pedido (Fabricación de pedidos): la línea
// completa, o la parte fabricada de una línea dividida.
export async function packManufacturedLine(item, session) {
  if (!item.manufacturingBatch) throw new HttpError(400, "Este producto no tiene un lote de fabricación asociado");
  const batchId = item.manufacturingBatch._id || item.manufacturingBatch;
  const batch = await batchModel.findById(batchId).session(session);
  if (!batch || batch.status !== "Completado") throw new HttpError(400, "El lote de fabricación todavía no está completado");
  const now = new Date();
  if (isSplit(item)) {
    if (item.manufacturePackedAt) throw new HttpError(409, `La parte fabricada de ${lineLabel(item)} ya está empacada`);
    item.manufacturePackedAt = now;
    if (item.stockPackedAt) {
      item.packed = true;
      item.packedAt = now;
    }
    return;
  }
  item.verified = true;
  item.packed = true;
  item.packedAt = now;
  item.packedLocation = "Fabricación";
}

// Libera todo lo comprometido por una línea (stock tomado y lote Programado)
// antes de quitarla o cambiarla al editar el pedido. Rechaza si ya hay algo
// empacado o si el lote ya empezó.
export async function releaseLine(item, session) {
  if (hasAnyPack(item)) {
    throw new HttpError(
      409,
      `${lineLabel(item)} ya está empacado. Primero deshaz el empaque desde Inventario para poder cambiar o quitar esa línea.`,
    );
  }
  await discardProgrammedBatch(item, session);
  if (hasStockTaken(item)) {
    await returnStock(
      { product: item.product, color: item.color, warehouse: item.verifiedWarehouse, quantity: takenQty(item) },
      session,
    );
  }
}

// Algo comprometido en la línea (stock tomado, lote o empaque).
export function hasCommitment(item) {
  return Boolean(item.verified || item.sentToManufacturing || item.manufacturingBatch || hasAnyPack(item) || isSplit(item));
}
