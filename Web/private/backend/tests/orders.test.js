// Pruebas de ordersController contra un MongoDB en memoria (replica set, para
// poder usar transacciones). Nunca tocan la base real del .env.
//   npm test
// La primera vez descarga un binario de MongoDB (queda en caché).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import Transaction from "../src/models/Transaction.js";
import Route from "../src/models/Route.js";
import CustomerOrder from "../src/models/CustomerOrder.js";
import { seedProductNames } from "./helpers/productNames.js";
import { createStoreOrder } from "./helpers/storeOrder.js";
import Inventory from "../src/models/InventoryItem.js";
import Batch from "../src/models/ProductionBatch.js";
import ctl from "../src/controller/ordersController.js";
import batchCtl from "../src/controller/productionBatchesController.js";
import routesCtl from "../src/controller/routesController.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test" });
  // Las colecciones deben existir antes de usarlas dentro de una transacción.
  for (const m of [Order, Transaction, Route, CustomerOrder, Inventory, Batch]) await m.createCollection();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order, Transaction, Route, CustomerOrder, Inventory, Batch].map((m) => m.deleteMany({})));
  await seedProductNames();
  await Inventory.create([
    { name: "Silla", color: "Verde", category: "Producto Terminado", location: "Bodega A", stock: 400, unit: "unidad" },
    { name: "Silla", color: "Verde", category: "Producto Terminado", location: "Bodega B", stock: 25, unit: "unidad" },
  ]);
});

// Llama un handler de Express con req/res mínimos.
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
  (await Inventory.findOne({ name: "Silla", color: "Verde", location, batchNumber: { $exists: false } }))?.stock;
const load = (id) => Order.findById(id);

// Pedido de prueba: 0) Silla 60, 1) Silla 100, 2) Silla 10, 3) Mesa 5.
async function createOrder() {
  const order = await createStoreOrder({
    customer: { name: "Distribuidora San Miguel" },
    items: [
      { product: "Silla", color: "Verde", quantity: 60, unitPrice: 1, subtotal: 60 },
      { product: "Silla", color: "Verde", quantity: 100, unitPrice: 1, subtotal: 100 },
      { product: "Silla", color: "Verde", quantity: 10, unitPrice: 1, subtotal: 10 },
      { product: "Mesa", color: "Roja", quantity: 5, unitPrice: 2, subtotal: 10 },
    ],
    total: 180,
  });
  return String(order._id);
}
const line = (id, index) => ({ id, index: String(index) });

// --- Verificar / deshacer ---------------------------------------------------

test("verificar toma stock y deshacer lo devuelve", async () => {
  const id = await createOrder();
  let r = await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega A"), 300);
  assert.equal((await load(id)).status, "Procesando");

  r = await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  assert.equal(r.status, 409, "verificar dos veces se rechaza");

  r = await call(ctl.unverifyOrderItem, { params: line(id, 1) });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega A"), 400);
});

test("verify-bulk es todo o nada", async () => {
  const id = await createOrder();
  let r = await call(ctl.verifyBulk, {
    body: { orders: [{ id, items: [{ index: 1, warehouse: "Bodega A" }, { index: 3, warehouse: "Bodega A" }] }] },
  });
  assert.equal(r.status, 409, "una línea sin stock rechaza todo");
  assert.equal(await stock("Bodega A"), 400);
  assert.equal((await load(id)).items[1].verified, false);

  r = await call(ctl.verifyBulk, {
    body: { orders: [{ id, items: [{ index: 1, warehouse: "Bodega A" }, { index: 2, warehouse: "Bodega B" }] }] },
  });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega A"), 300);
  assert.equal(await stock("Bodega B"), 15);
  assert.equal(r.payload.orders.length, 1);
});

// --- Existencia parcial -----------------------------------------------------

test("dividir toma parte de bodega, crea el lote del resto y se puede deshacer", async () => {
  const id = await createOrder();
  let r = await call(ctl.splitPartialItem, { params: line(id, 0), body: { warehouse: "Bodega B", quantity: 25 } });
  assert.equal(r.status, 200);
  let o = await load(id);
  const batch = await Batch.findById(o.items[0].manufacturingBatch);
  assert.equal(await stock("Bodega B"), 0, "la fila queda en 0, no se borra");
  assert.equal(batch.status, "Programado");
  assert.equal(batch.targetQuantity, 35);
  assert.equal(o.items[0].fromStockQty + o.items[0].toManufactureQty, o.items[0].quantity);
  assert.equal(o.total, 180, "el total no cambia");

  r = await call(ctl.unsplitPartialItem, { params: line(id, 0) });
  assert.equal(r.status, 200);
  o = await load(id);
  assert.equal(await stock("Bodega B"), 25);
  assert.equal(await Batch.findById(batch._id), null);
  assert.equal(o.items[0].fromStockQty, undefined);
});

test("no se deshace la división si la parte de bodega ya está empacada", async () => {
  const id = await createOrder();
  await call(ctl.splitPartialItem, { params: line(id, 0), body: { warehouse: "Bodega B", quantity: 15 } });
  const r1 = await call(ctl.packOrderItem, { params: line(id, 0) });
  assert.equal(r1.status, 200);
  const o = await load(id);
  assert.ok(o.items[0].stockPackedAt);
  assert.equal(o.items[0].packed, false);
  const r2 = await call(ctl.unsplitPartialItem, { params: line(id, 0) });
  assert.equal(r2.status, 409);
});

// --- Fabricación ------------------------------------------------------------

test("enviar a fabricación crea el lote y deshacer lo borra solo si sigue Programado", async () => {
  const id = await createOrder();
  let r = await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  assert.equal(r.status, 200);
  let o = await load(id);
  const first = o.items[3].manufacturingBatch;
  assert.equal((await Batch.findById(first)).targetQuantity, 5);

  r = await call(ctl.cancelManufacturingRequest, { params: line(id, 3) });
  assert.equal(r.status, 200);
  assert.equal(await Batch.findById(first), null);

  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  o = await load(id);
  await Batch.updateOne({ _id: o.items[3].manufacturingBatch }, { status: "En Proceso" });
  r = await call(ctl.cancelManufacturingRequest, { params: line(id, 3) });
  assert.equal(r.status, 409);
});

test("pack-manufactured completa una línea dividida", async () => {
  const id = await createOrder();
  await call(ctl.splitPartialItem, { params: line(id, 0), body: { warehouse: "Bodega B", quantity: 15 } });
  await call(ctl.packOrderItem, { params: line(id, 0) });
  const o = await load(id);
  await Batch.updateOne({ _id: o.items[0].manufacturingBatch }, { status: "Completado" });
  const r = await call(ctl.packManufacturedItem, { params: line(id, 0) });
  assert.equal(r.status, 200);
  const after = await load(id);
  assert.ok(after.items[0].manufacturePackedAt);
  assert.equal(after.items[0].packed, true);
});

test("empacar en Fabricación guarda packedAt en lote y línea, y se deshace si no se recogió", async () => {
  const id = await createOrder();
  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  const batchId = (await load(id)).items[3].manufacturingBatch;

  let r = await call(ctl.packManufacturedItem, { params: line(id, 3) });
  assert.equal(r.status, 400, "no se empaca un lote sin completar");

  await Batch.updateOne({ _id: batchId }, { status: "Completado", producedQuantity: 5 });
  r = await call(ctl.packManufacturedItem, { params: line(id, 3) });
  assert.equal(r.status, 200);
  let o = await load(id);
  assert.equal(o.items[3].packedLocation, "Fabricación");
  assert.ok(o.items[3].packedAt);
  assert.ok((await Batch.findById(batchId)).packedAt);

  r = await call(ctl.packManufacturedItem, { params: line(id, 3) });
  assert.equal(r.status, 409, "empacar dos veces se rechaza");

  r = await call(ctl.unpackManufacturedItem, { params: line(id, 3) });
  assert.equal(r.status, 200);
  o = await load(id);
  assert.equal(o.items[3].packed, false);
  assert.equal(o.items[3].verified, false);
  assert.equal((await Batch.findById(batchId)).packedAt, undefined);

  await call(ctl.packManufacturedItem, { params: line(id, 3) });
  await Order.updateOne({ _id: id }, { "delivery.pickupFactoryAt": new Date() });
  r = await call(ctl.unpackManufacturedItem, { params: line(id, 3) });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /ya recogió en Fabricación/);
});

test("pack-completed empaca varios lotes, todo o nada", async () => {
  const id = await createOrder();
  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  await call(ctl.sendItemToManufacturing, { params: line(id, 2) });
  let o = await load(id);
  const [b3, b2] = [o.items[3].manufacturingBatch, o.items[2].manufacturingBatch].map(String);
  await Batch.updateOne({ _id: b3 }, { status: "Completado" });

  let r = await call(batchCtl.packCompleted, { body: { batchIds: [b3, b2] } });
  assert.equal(r.status, 400, "uno sin completar rechaza todo");
  o = await load(id);
  assert.equal(o.items[3].packed, false);
  assert.equal((await Batch.findById(b3)).packedAt, undefined);

  await Batch.updateOne({ _id: b2 }, { status: "Completado" });
  r = await call(batchCtl.packCompleted, { body: { batchIds: [b3, b2] } });
  assert.equal(r.status, 200);
  o = await load(id);
  assert.equal(o.items[3].packed, true);
  assert.equal(o.items[2].packedLocation, "Fabricación");
  assert.equal(o.status, "Procesando");
});

// --- Empaque ----------------------------------------------------------------

test("empacar y desempacar; no se desverifica una línea empacada", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  let r = await call(ctl.packOrderItem, { params: line(id, 1) });
  assert.equal(r.status, 200);
  assert.equal((await load(id)).items[1].packedLocation, "Almacén");
  r = await call(ctl.unverifyOrderItem, { params: line(id, 1) });
  assert.equal(r.status, 409);
  r = await call(ctl.unpackOrderItem, { params: line(id, 1) });
  assert.equal(r.status, 200);
  assert.equal((await load(id)).items[1].packed, false);
});

// --- Eliminar pedido (solo los entregados) --------------------------------------

const objectId = () => new mongoose.Types.ObjectId();

// Pedido de la tienda ya entregado, con su vínculo de cliente. `routeStatus`:
// estado de la ruta donde viajó; null = el pedido no tiene ruta.
async function deliveredOrder({ routeStatus = "Completada" } = {}) {
  const id = await createOrder();
  const customerId = objectId();
  await CustomerOrder.create({ customer: customerId, order: id });
  const order = await load(id);
  let route = null;
  if (routeStatus) {
    route = await Route.create({
      number: 1,
      date: new Date("2026-05-04T00:00:00.000Z"),
      zone: "Zona de prueba",
      status: routeStatus,
      departedAt: new Date(),
      orders: [objectId(), order._id],
      deliveries: [{ order: order._id, at: new Date(), partial: false, position: 1 }],
    });
  }
  order.status = "Entregado";
  if (route) order.delivery = { route: route._id, dispatchStatus: "Entregado" };
  await order.save();
  return { id, customerId, routeId: route?._id };
}

test("eliminar un pedido entregado de una ruta completada: la ruta, el Ingreso, el vínculo de la tienda y los lotes se conservan", async () => {
  const { id, customerId, routeId } = await deliveredOrder();
  const before = await load(id);
  const orderNumber = before.orderNumber;
  const otherStop = (await Route.findById(routeId)).orders[0];

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await load(id), null);

  // Ruta: se conserva sin el pedido (ni como parada ni como entrega).
  const route = await Route.findById(routeId);
  assert.ok(route, "la ruta se conserva");
  assert.deepEqual(route.orders.map(String), [String(otherStop)]);
  assert.equal(route.deliveries.length, 0);

  // Finanzas: el Ingreso sigue, sin relatedOrder y con el N° de pedido.
  const sales = await Transaction.find({ category: "Ventas" });
  assert.equal(sales.length, 1);
  assert.equal(sales[0].relatedOrder, undefined);
  assert.equal(sales[0].orderNumber, orderNumber);
  assert.equal(sales[0].amount, 180);

  // Tienda: el vínculo sigue y trae el resumen del pedido.
  const link = await CustomerOrder.findOne({ customer: customerId });
  assert.ok(link, "el CustomerOrder se conserva");
  assert.equal(String(link.order), id, "conserva el id (no choca con el índice único)");
  assert.ok(link.deletedAt);
  assert.equal(link.snapshot.orderNumber, orderNumber);
  assert.equal(link.snapshot.total, 180);
  assert.equal(link.snapshot.status, "Entregado");
  assert.equal(link.snapshot.items.length, 4);
  assert.deepEqual(Object.keys(link.snapshot.items[0]).sort(), ["color", "product", "quantity", "subtotal", "unitPrice"]);
});

test("eliminar un pedido entregado no devuelve existencia ni toca los lotes", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  const batchId = (await load(id)).items[3].manufacturingBatch;
  await Batch.updateOne({ _id: batchId }, { status: "Completado" });
  assert.equal(await stock("Bodega A"), 300);
  await Order.updateOne({ _id: id }, { status: "Entregado" });

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega A"), 300, "no se devuelve lo entregado");
  assert.ok(await Batch.findById(batchId), "el lote completado se conserva");
});

test("eliminar un pedido entregado sin ruta funciona", async () => {
  const { id } = await deliveredOrder({ routeStatus: null });
  assert.equal((await call(ctl.deleteOrder, { params: { id } })).status, 200);
  assert.equal(await load(id), null);
});

test("un pedido que no está entregado no se elimina (409)", async () => {
  for (const status of ["Procesando", "En Fabricación", "Empacado", "En Tránsito"]) {
    const id = String((await createStoreOrder({ items: [{ product: "Silla", quantity: 1, unitPrice: 1, subtotal: 1 }], status }))._id);
    const r = await call(ctl.deleteOrder, { params: { id } });
    assert.equal(r.status, 409, status);
    assert.equal(r.payload.message, "Solo se pueden eliminar pedidos entregados");
    assert.ok(await load(id), "el pedido sigue existiendo");
  }
  assert.equal(await Transaction.countDocuments({ relatedOrder: { $exists: true } }), 4, "los Ingresos no se tocan");
});

test("un pedido entregado en una ruta activa no se elimina (409)", async () => {
  const { id, routeId } = await deliveredOrder({ routeStatus: "En tránsito" });
  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 409);
  assert.equal(r.payload.message, "El pedido está en una ruta activa");
  assert.ok(await load(id));
  assert.equal((await Route.findById(routeId)).deliveries.length, 1, "la ruta no se modificó");
  assert.equal((await CustomerOrder.findOne({ order: id })).snapshot, undefined);
});

test("eliminar un pedido que no existe responde 404", async () => {
  const r = await call(ctl.deleteOrder, { params: { id: objectId().toString() } });
  assert.equal(r.status, 404);
});

test("la ruta completada que se queda sin pedidos se puede eliminar", async () => {
  const id = await createOrder();
  const order = await load(id);
  const route = await Route.create({
    number: 1,
    date: new Date("2026-05-04T00:00:00.000Z"),
    zone: "Zona de prueba",
    status: "Completada",
    departedAt: new Date(),
    orders: [order._id],
    deliveries: [{ order: order._id, at: new Date(), partial: false, position: 0 }],
  });
  order.status = "Entregado";
  order.delivery = { route: route._id, dispatchStatus: "Entregado" };
  await order.save();

  assert.equal((await call(routesCtl.deleteRoute, { params: { id: String(route._id) } })).status, 409, "con el pedido, una ruta que salió no se elimina");
  assert.equal((await call(ctl.deleteOrder, { params: { id } })).status, 200);
  const emptied = await Route.findById(route._id);
  assert.equal(emptied.orders.length + emptied.deliveries.length, 0);
  assert.equal((await call(routesCtl.deleteRoute, { params: { id: String(route._id) } })).status, 200);
  assert.equal(await Route.findById(route._id), null);
});
