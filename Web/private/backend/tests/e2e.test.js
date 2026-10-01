// Prueba de extremo a extremo (Fase 11) contra un MongoDB en memoria (replica
// set, para poder usar transacciones). Nunca toca la base real del .env.
//   npm test
// Recorre los controladores en el mismo orden en que el panel los llama:
//   1) Pedido de 3 productos: Inventario (verificar, dividir, enviar a
//      fabricar) → Fabricación (iniciar, completar, empacar) → Logística
//      (ruta, recogidas, salida, entrega). Al final: Entregado, historial
//      completo y stock cuadrado.
//   2) Lote de stock: crear, iniciar, completar y enviar a bodega; el
//      producto terminado aumenta y queda con lastInbound.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import { seedProductNames } from "./helpers/productNames.js";
import { createStoreOrder } from "./helpers/storeOrder.js";
import Transaction from "../src/models/Transaction.js";
import Inventory from "../src/models/InventoryItem.js";
import Batch from "../src/models/ProductionBatch.js";
import Route from "../src/models/Route.js";
import Employee from "../src/models/Employee.js";
import Vehicle from "../src/models/Vehicle.js";
import ordersCtl from "../src/controller/ordersController.js";
import batchCtl from "../src/controller/productionBatchesController.js";
import routesCtl from "../src/controller/routesController.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test_e2e" });
  // Las colecciones deben existir antes de usarlas dentro de una transacción.
  for (const m of [Order, Transaction, Inventory, Batch, Route, Employee, Vehicle]) await m.createCollection();
  await Route.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order, Transaction, Inventory, Batch, Route, Employee, Vehicle].map((m) => m.deleteMany({})));
  await seedProductNames();
});

// Llama un handler de Express con req/res mínimos y exige el status esperado.
async function call(handler, { params = {}, body = {}, query = {} } = {}, expected = 200) {
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
  await handler({ params, body, query }, res);
  assert.equal(status, expected, `respuesta ${status}: ${JSON.stringify(payload?.message ?? payload)}`);
  return payload;
}

const finished = (name, color, location) =>
  Inventory.findOne({ name, color, location, category: "Producto Terminado", batchNumber: { $exists: false } });
const stockOf = async (name, color, location) => (await finished(name, color, location))?.stock ?? 0;
const load = (id) => Order.findById(id);
const line = (id, index) => ({ id, index: String(index) });

test("pedido de 3 productos: Inventario → Fabricación → Logística → Entregado", async (t) => {
  // Existencias iniciales: Pajilla alcanza, Pelota solo en parte, Vaso no hay.
  await Inventory.create([
    { name: "Pajilla", color: "Azul", category: "Producto Terminado", location: "Bodega A", stock: 100 },
    { name: "Pelota", color: "Roja", category: "Producto Terminado", location: "Bodega A", stock: 20 },
  ]);
  const driver = await Employee.create({
    name: "Mario", lastName: "Pérez", email: "mario@charly.test", password: "x", department: "Logística",
  });
  await Vehicle.create({ plate: "P123-456" });

  // --- Pedido de la tienda con 3 productos (llega «Procesando», ya pagado) ---
  const created = await createStoreOrder({
    customer: { name: "Distribuidora San Miguel", address: "San Miguel" },
    items: [
      { product: "Pajilla", color: "Azul", quantity: 30, unitPrice: 1, subtotal: 30 },
      { product: "Pelota", color: "Roja", quantity: 50, unitPrice: 2, subtotal: 100 },
      { product: "Vaso", color: "Verde", quantity: 40, unitPrice: 1.5, subtotal: 60 },
    ],
    total: 190,
  });
  const id = String(created._id);
  assert.equal((await load(id)).status, "Procesando");

  // --- Inventario --------------------------------------------------------
  // 0) Pajilla: verificar con stock (toma 30 de Bodega A).
  let r = await call(ordersCtl.verifyOrderItem, { params: line(id, 0), body: { warehouse: "Bodega A" } });
  assert.equal(r.order.items[0].verified, true, "la respuesta trae el pedido actualizado");
  // 1) Pelota: dividir (20 de bodega, 30 a fabricación).
  await call(ordersCtl.splitPartialItem, { params: line(id, 1), body: { warehouse: "Bodega A", quantity: 20 } });
  // 2) Vaso: enviar a fabricar completo.
  await call(ordersCtl.sendItemToManufacturing, { params: line(id, 2) });
  let order = await load(id);
  assert.equal(order.status, "En Fabricación");
  assert.equal(await stockOf("Pajilla", "Azul", "Bodega A"), 70);
  assert.equal(await stockOf("Pelota", "Roja", "Bodega A"), 0);

  // Empacar lo verificado: la línea completa y la parte de bodega de la dividida.
  await call(ordersCtl.packOrderItem, { params: line(id, 0) });
  await call(ordersCtl.packOrderItem, { params: line(id, 1) });
  order = await load(id);
  assert.equal(order.status, "Procesando");
  assert.equal(order.items[0].packed, true);
  assert.ok(order.items[1].stockPackedAt);

  // --- Fabricación: iniciar, completar y empacar los dos lotes -----------
  const lots = [order.items[1].manufacturingBatch, order.items[2].manufacturingBatch].map(String);
  assert.equal((await Batch.findById(lots[0])).targetQuantity, 30);
  assert.equal((await Batch.findById(lots[1])).targetQuantity, 40);
  for (const lotId of lots) {
    const started = await call(batchCtl.startBatch, { params: { id: lotId }, body: { productionLine: "Línea 1" } });
    assert.equal(started.status, "En Proceso");
    const target = (await Batch.findById(lotId)).targetQuantity;
    const done = await call(batchCtl.completeBatch, { params: { id: lotId }, body: { producedQuantity: target } });
    assert.equal(done.status, "Completado");
  }
  await call(ordersCtl.packManufacturedItem, { params: line(id, 1) });
  await call(ordersCtl.packManufacturedItem, { params: line(id, 2) });
  order = await load(id);
  assert.equal(order.status, "Empacado");
  assert.ok(order.items.every((i) => i.packed));

  // --- Logística: ruta, recogidas, salida y entrega -----------------------
  const route = await call(routesCtl.createRoute, { body: { zone: "Zona Oriente" } }, 201);
  const routeId = String(route._id);
  await call(routesCtl.addOrder, { params: { id: routeId }, body: { orderId: id } });
  r = await call(routesCtl.updateRoute, { params: { id: routeId }, body: { driver: String(driver._id), vehicle: "P123-456" } });
  assert.equal(r.status, "Recolectando");

  const busy = await call(routesCtl.getAvailability, { query: {} });
  assert.equal(busy.vehicles.find((v) => v.plate === "P123-456").busy, true, "el vehículo queda en ruta");

  await call(routesCtl.confirmPickup, { params: { id: routeId }, body: { location: "Almacén" } });
  await call(routesCtl.confirmPickup, { params: { id: routeId }, body: { location: "Fabricación" } });
  r = await call(routesCtl.depart, { params: { id: routeId } });
  assert.equal(r.status, "En tránsito");
  assert.equal((await load(id)).status, "En Tránsito");

  r = await call(routesCtl.deliverOrder, { params: { id: routeId, orderId: id } });
  assert.equal(r.status, "Completada", "con su único pedido entregado, la ruta se completa");

  // --- Comprobaciones finales --------------------------------------------
  order = await load(id);
  assert.equal(order.status, "Entregado");
  assert.ok(order.delivery.deliveredAt);

  // El historial tiene todos los pasos, en orden (puede repetir alguno).
  const history = order.statusHistory.map((h) => h.status);
  // Un pedido de la tienda nace «Procesando» (ya pagado), sin pasar por «Pendiente».
  const steps = ["Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];
  let from = 0;
  for (const step of steps) {
    const at = history.indexOf(step, from);
    assert.ok(at >= 0, `falta «${step}» en statusHistory: ${history.join(" → ")}`);
    from = at + 1;
  }
  assert.equal(history.at(-1), "Entregado");
  t.diagnostic(`statusHistory: ${history.join(" → ")}`);
  const times = order.statusHistory.map((h) => new Date(h.at).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b), "las fechas del historial van en orden");

  // Stock: solo salió de bodega lo verificado (30 Pajillas y 20 Pelotas); lo
  // fabricado para el pedido no pasa por el inventario.
  assert.equal(await stockOf("Pajilla", "Azul", "Bodega A"), 70);
  assert.equal(await stockOf("Pelota", "Roja", "Bodega A"), 0);
  assert.equal(await Inventory.countDocuments({ name: "Vaso" }), 0);
  const totalStock = (await Inventory.find()).reduce((s, i) => s + i.stock, 0);
  assert.equal(totalStock, 120 - 50);
  t.diagnostic(`stock final: Pajilla 100 → 70, Pelota 20 → 0, Vaso sin fila (fabricado para el pedido)`);

  // La ruta ya no ocupa el vehículo.
  const free = await call(routesCtl.getAvailability, { query: {} });
  assert.equal(free.vehicles.find((v) => v.plate === "P123-456").busy, false);
});

test("lote de stock: crear, iniciar, completar y enviar a bodega", async (t) => {
  await Inventory.create({ name: "Pajilla", color: "Verde", category: "Producto Terminado", location: "Bodega Central", stock: 500 });

  const created = await call(batchCtl.insertBatch, {
    body: { product: "Pajilla", color: "Verde", targetQuantity: 1000, status: "Programado" },
  });
  const batch = await Batch.findOne({ batchNumber: created.batchNumber });
  const id = String(batch._id);
  assert.equal(batch.status, "Programado");

  await call(batchCtl.startBatch, { params: { id }, body: { productionLine: "Línea 2" } });
  await call(batchCtl.completeBatch, { params: { id }, body: { producedQuantity: 1050 } });
  const sent = await call(batchCtl.sendToWarehouse, { params: { id }, body: { warehouse: "Bodega Central" } });
  assert.equal(sent.quantity, 1050);
  assert.equal(sent.batch.destinationWarehouse, "Bodega Central");

  const item = await finished("Pajilla", "Verde", "Bodega Central");
  assert.equal(item.stock, 1550, "el producto terminado aumentó en lo producido");
  assert.equal(item.lastInbound.quantity, 1050);
  assert.equal(item.lastInbound.batchNumber, created.batchNumber);
  assert.ok(item.lastInbound.at);
  t.diagnostic(`Bodega Central: 500 → ${item.stock}; lastInbound ${item.lastInbound.quantity} u. del ${item.lastInbound.batchNumber}`);
});
