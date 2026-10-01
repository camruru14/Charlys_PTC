// Pruebas del flujo de lotes (Fase 5) contra un MongoDB en memoria (replica
// set, para poder usar transacciones). Nunca tocan la base real del .env.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import Inventory from "../src/models/InventoryItem.js";
import Batch from "../src/models/ProductionBatch.js";
import ctl from "../src/controller/productionBatchesController.js";
import inventoryCtl from "../src/controller/inventoryController.js";
import { migrateReportedBatches } from "../scripts/migrate-reported-batches.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test_batches" });
  for (const m of [Order, Inventory, Batch]) await m.createCollection();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Inventory.deleteMany({}), Batch.deleteMany({})]);
  await Inventory.create({
    name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Central", stock: 6560,
  });
});

async function call(handler, { params = {}, body = {} } = {}) {
  let status = 200;
  let payload;
  const res = {
    status(s) {
      status = s;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
  };
  await handler({ params, body }, res);
  return { status, payload };
}

const stock = async (location) =>
  (await Inventory.findOne({ name: "Pajilla", color: "Verde", location, batchNumber: { $exists: false } }))?.stock;

async function newBatch(extra = {}) {
  const b = await Batch.create({
    batchNumber: `LOTE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    product: "Pajilla",
    color: "Verde",
    targetQuantity: 3000,
    ...extra,
  });
  return String(b._id);
}

async function completed(quantity = 3050) {
  const id = await newBatch({ productionLine: "Línea 3" });
  assert.equal((await call(ctl.startBatch, { params: { id } })).status, 200);
  assert.equal((await call(ctl.completeBatch, { params: { id }, body: { producedQuantity: quantity } })).status, 200);
  return id;
}

test("flujo completo: iniciar, detener, reanudar y completar", async () => {
  const id = await newBatch();
  let r = await call(ctl.startBatch, { params: { id } });
  assert.equal(r.status, 400, "sin línea no inicia");

  r = await call(ctl.startBatch, { params: { id }, body: { productionLine: "Línea 3" } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "En Proceso");
  assert.ok(r.payload.startedAt);

  r = await call(ctl.stopBatch, { params: { id }, body: { reason: "Falta materia prima" } });
  assert.equal(r.payload.status, "Detenido");
  assert.equal(r.payload.stopReason, "Falta materia prima");

  r = await call(ctl.completeBatch, { params: { id }, body: { producedQuantity: 10 } });
  assert.equal(r.status, 409, "un lote detenido no se completa");

  r = await call(ctl.resumeBatch, { params: { id } });
  assert.equal(r.payload.status, "En Proceso");
  assert.equal(r.payload.stopReason, undefined);

  r = await call(ctl.completeBatch, { params: { id }, body: { producedQuantity: "" } });
  assert.equal(r.status, 400, "producido es obligatorio");

  r = await call(ctl.completeBatch, { params: { id }, body: { producedQuantity: 3050 } });
  assert.equal(r.payload.status, "Completado");
  assert.equal(r.payload.producedQuantity, 3050);
  assert.ok(r.payload.completedAt);

  r = await call(ctl.reopenBatch, { params: { id } });
  assert.equal(r.payload.status, "En Proceso");
  assert.equal(r.payload.completedAt, undefined);
});

test("enviar a bodega suma lo producido una sola vez y marca el ingreso", async () => {
  const id = await completed();
  let r = await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.quantity, 3050);
  assert.equal(await stock("Bodega Central"), 9610);

  const item = await Inventory.findOne({ location: "Bodega Central" });
  assert.equal(item.lastInbound.quantity, 3050);
  assert.ok(item.lastInbound.batchNumber.startsWith("LOTE-"));

  r = await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 409, "enviar dos veces se rechaza");
  assert.equal(await stock("Bodega Central"), 9610);

  const batch = await Batch.findById(id);
  assert.equal(batch.sentQuantity, 3050);
  assert.equal(batch.destinationWarehouse, "Bodega Central");

  r = await call(ctl.reopenBatch, { params: { id } });
  assert.equal(r.status, 409, "no se reabre un lote ya enviado");
});

test("enviar solo suma la diferencia con lo ya contado", async () => {
  const id = await completed(3050);
  await Batch.updateOne({ _id: id }, { sentQuantity: 1000 });
  await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Norte" } });
  assert.equal(await stock("Bodega Norte"), 2050, "crea el artículo nuevo con la diferencia");
});

test("no se envía un lote sin completar ni uno de pedido", async () => {
  const id = await newBatch({ productionLine: "Línea 1" });
  let r = await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 409);

  const pedido = await newBatch({ category: "Pedido", status: "Completado", producedQuantity: 10 });
  r = await call(ctl.sendToWarehouse, { params: { id: pedido }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 409);
  assert.equal(await stock("Bodega Central"), 6560);
});

test("deshacer el envío resta las unidades si siguen disponibles", async () => {
  const id = await completed();
  await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  let r = await call(ctl.undoSend, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega Central"), 6560);
  const batch = await Batch.findById(id);
  assert.equal(batch.sentToWarehouseAt, undefined);
  assert.equal(batch.sentQuantity, 0);
  assert.equal((await Inventory.findOne({ location: "Bodega Central" })).lastInbound?.batchNumber, undefined);

  // Enviado otra vez, y luego se venden casi todas: ya no se puede deshacer.
  await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Norte" } });
  await Inventory.updateOne({ location: "Bodega Norte" }, { stock: 100 });
  r = await call(ctl.undoSend, { params: { id } });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /ya no están disponibles/);
  assert.equal(await stock("Bodega Norte"), 100);
});

test("editar un lote enviado no cambia lo producido", async () => {
  const id = await completed();
  await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  const r = await call(ctl.updateBatch, { params: { id }, body: { producedQuantity: 5000 } });
  assert.equal(r.status, 409);
  assert.equal((await Batch.findById(id)).producedQuantity, 3050);
});

test("envío antiguo de Movil y envío del panel no cuentan dos veces", async () => {
  const id = await completed(500);
  const batch = await Batch.findById(id);
  const reported = await Inventory.create({
    name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Central",
    stock: 500, batchNumber: batch.batchNumber,
  });

  let r = await call(inventoryCtl.sendToWarehouse, { params: { id: String(reported._id) } });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega Central"), 7060);
  assert.ok((await Batch.findById(id)).sentToWarehouseAt, "el lote queda enviado");

  r = await call(ctl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 409);
  r = await call(inventoryCtl.sendToWarehouse, { params: { id: String(reported._id) } });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega Central"), 7060, "Movil enviando otra vez no suma");
});

test("migración: envía pendientes, marca enviados y borra los reportados que cuadran", async () => {
  const pendingId = await completed(300);
  const sentId = await completed(200);
  const orphanId = await completed(50);
  const [pending, sent, orphan] = await Promise.all([pendingId, sentId, orphanId].map((i) => Batch.findById(i)));
  await Inventory.create([
    { name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Central", stock: 300, batchNumber: pending.batchNumber },
    { name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Central", stock: 200, batchNumber: sent.batchNumber, sentToWarehouse: true },
    // Enviado a una bodega donde no existe el producto terminado real: no cuadra.
    { name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Sur", stock: 50, batchNumber: orphan.batchNumber, sentToWarehouse: true },
  ]);

  const summary = await migrateReportedBatches({ log: () => {} });
  assert.equal(summary.sent, 1);
  assert.equal(summary.marked, 2);
  assert.equal(summary.deleted, 2);
  assert.equal(summary.warnings.length, 1);
  assert.match(summary.warnings[0], /Bodega Sur/);

  assert.equal(await stock("Bodega Central"), 6860, "solo se sumó el pendiente");
  for (const id of [pendingId, sentId]) {
    const b = await Batch.findById(id);
    assert.ok(b.sentToWarehouseAt);
    assert.equal(b.sentQuantity, b.producedQuantity);
  }
  assert.equal(await Inventory.countDocuments({ batchNumber: { $exists: true } }), 1);

  // Idempotente: correrla otra vez no suma ni borra nada más.
  const again = await migrateReportedBatches({ log: () => {} });
  assert.equal(again.sent + again.marked + again.deleted, 0);
  assert.equal(await stock("Bodega Central"), 6860);

  // El lote enviado por la migración no se vuelve a sumar desde el panel.
  const r = await call(ctl.sendToWarehouse, { params: { id: pendingId }, body: { warehouse: "Bodega Central" } });
  assert.equal(r.status, 409);
});
