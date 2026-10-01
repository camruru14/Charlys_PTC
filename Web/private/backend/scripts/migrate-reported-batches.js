// Migración de «Lotes reportados» al envío directo a bodega (Fase 5).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   npm run migrate:batches -- --dry-run   (solo muestra lo que haría)
//   npm run migrate:batches
//
// Es idempotente: se puede correr varias veces.
//   a) Cada artículo reportado sin enviar (InventoryItem con batchNumber y
//      sentToWarehouse ≠ true) se envía a la bodega que ya tenía elegida:
//      se suma al producto terminado con el mismo artículo, color y bodega (o
//      se crea) y su lote queda enviado con sentQuantity = producedQuantity.
//   b) Los lotes cuyo artículo reportado ya se había enviado quedan marcados
//      con sentToWarehouseAt, destinationWarehouse y sentQuantity =
//      producedQuantity, para que send-to-warehouse no los vuelva a sumar.
//   c) Se borran los artículos con batchNumber, solo si ya están enviados, su
//      producto terminado real existe y su lote (si existe) está marcado como
//      enviado. Los que no cuadran no se borran y se listan al final.
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import inventoryModel from "../src/models/InventoryItem.js";
import batchModel from "../src/models/ProductionBatch.js";
import { addFinishedStock, withTransaction } from "../src/lib/stock.js";

const describe = (item) =>
  `${item.batchNumber} · ${item.name}${item.color ? ` · ${item.color}` : ""} · ${item.stock ?? 0} u. · ${item.location || "sin bodega"}`;

const realItemFilter = (item) => ({
  category: "Producto Terminado",
  name: item.name,
  color: item.color || { $in: [null, ""] },
  location: item.location,
  batchNumber: { $exists: false },
});

export async function migrateReportedBatches({ dryRun = false, log = console.log } = {}) {
  const summary = { sent: 0, marked: 0, deleted: 0, warnings: [] };

  // a) Reportados pendientes -> se envían a su bodega.
  const pending = await inventoryModel.find({ batchNumber: { $exists: true }, sentToWarehouse: { $ne: true } });
  for (const pendingItem of pending) {
    if (!pendingItem.location) {
      summary.warnings.push(`Sin bodega elegida, no se envió: ${describe(pendingItem)}`);
      continue;
    }
    if (dryRun) {
      log(`[a] Enviaría ${describe(pendingItem)}`);
      summary.sent += 1;
      continue;
    }
    await withTransaction(async (session) => {
      const item = await inventoryModel.findById(pendingItem._id).session(session);
      if (!item || item.sentToWarehouse) return;
      const batch = await batchModel.findOne({ batchNumber: item.batchNumber }).session(session);
      const now = new Date();
      // Si el lote ya lo envió el panel, esas unidades ya están contadas.
      if (!batch?.sentToWarehouseAt) {
        await addFinishedStock(
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
        if (batch) {
          batch.sentToWarehouseAt = now;
          batch.destinationWarehouse = item.location;
          batch.sentQuantity = batch.producedQuantity || 0;
          await batch.save({ session });
        }
      }
      item.sentToWarehouse = true;
      await item.save({ session });
      summary.sent += 1;
      log(`[a] Enviado ${describe(item)}`);
    });
  }

  // b) Lotes ya enviados antes (su artículo reportado está enviado).
  const sentItems = await inventoryModel.find({ batchNumber: { $exists: true }, sentToWarehouse: true });
  for (const item of sentItems) {
    const batch = await batchModel.findOne({ batchNumber: item.batchNumber });
    if (!batch || batch.sentToWarehouseAt) continue;
    if (dryRun) {
      log(`[b] Marcaría ${batch.batchNumber} como enviado a ${item.location || "—"}`);
      summary.marked += 1;
      continue;
    }
    batch.sentToWarehouseAt = item.updatedAt || new Date();
    batch.destinationWarehouse = item.location;
    batch.sentQuantity = batch.producedQuantity || 0;
    await batch.save();
    summary.marked += 1;
    log(`[b] ${batch.batchNumber} marcado como enviado a ${item.location || "—"}`);
  }

  // c) Borrar el modelo antiguo, solo si sus unidades ya están en el producto terminado real.
  const reported = await inventoryModel.find({ batchNumber: { $exists: true } });
  for (const item of reported) {
    const willBeSent = dryRun && !item.sentToWarehouse && item.location;
    const problems = [];
    if (!item.sentToWarehouse && !willBeSent) problems.push("no está enviado");
    if (!item.location) problems.push("no tiene bodega");
    else if (!willBeSent && !(await inventoryModel.exists(realItemFilter(item)))) {
      problems.push("no existe su producto terminado en esa bodega");
    }
    const batch = await batchModel.findOne({ batchNumber: item.batchNumber });
    if (batch && !batch.sentToWarehouseAt && !dryRun) problems.push("su lote no quedó marcado como enviado");

    if (problems.length) {
      summary.warnings.push(`No se borró ${describe(item)}: ${problems.join(", ")}`);
      continue;
    }
    if (dryRun) {
      log(`[c] Borraría ${describe(item)}`);
    } else {
      await inventoryModel.deleteOne({ _id: item._id });
      log(`[c] Borrado ${describe(item)}`);
    }
    summary.deleted += 1;
  }

  return summary;
}

async function main() {
  const { config } = await import("../config.js");
  if (!config.db.URI) {
    throw new Error("Falta DB_URI en el .env de Web/private/backend");
  }
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(config.db.URI);
  if (dryRun) console.log("Modo --dry-run: no se escribe nada.\n");

  const summary = await migrateReportedBatches({ dryRun });

  console.log("");
  console.log(`Reportados enviados a su bodega (a): ${summary.sent}`);
  console.log(`Lotes marcados como enviados (b):    ${summary.marked}`);
  console.log(`Artículos reportados borrados (c):   ${summary.deleted}`);
  if (summary.warnings.length) {
    console.log(`\n⚠ ${summary.warnings.length} artículo(s) no cuadran y NO se borraron:`);
    summary.warnings.forEach((w) => console.log(`  - ${w}`));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error("Error en la migración:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
