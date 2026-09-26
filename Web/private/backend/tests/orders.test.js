// Pruebas de ordersController contra un MongoDB en memoria (replica set, para
// poder usar transacciones). Nunca tocan la base real del .env.
//   npm test
// La primera vez descarga un binario de MongoDB (queda en caché).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import Inventory from "../src/models/InventoryItem.js";
import Batch from "../src/models/ProductionBatch.js";
import ctl from "../src/controller/ordersController.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test" });
  // Las colecciones deben existir antes de usarlas dentro de una transacción.
  for (const m of [Order, Inventory, Batch]) await m.createCollection();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Inventory.deleteMany({}), Batch.deleteMany({})]);
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
  const { payload } = await call(ctl.insertOrder, {
    body: {
      customer: { name: "Distribuidora San Miguel" },
      items: [
        { product: "Silla", color: "Verde", quantity: 60, unitPrice: 1, subtotal: 60 },
        { product: "Silla", color: "Verde", quantity: 100, unitPrice: 1, subtotal: 100 },
        { product: "Silla", color: "Verde", quantity: 10, unitPrice: 1, subtotal: 10 },
        { product: "Mesa", color: "Roja", quantity: 5, unitPrice: 2, subtotal: 10 },
      ],
      total: 180,
    },
  });
  return String(payload._id);
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

// --- Editar pedido ----------------------------------------------------------

test("editar: quitar una línea empacada se rechaza y reducir una verificada devuelve el stock", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  await call(ctl.packOrderItem, { params: line(id, 1) });
  let o = await load(id);
  const base = o.toObject().items.map((it, i) => ({ ...it, sourceIndex: i }));

  let r = await call(ctl.updateOrder, {
    params: { id },
    body: { items: base.filter((_, i) => i !== 1), total: 80, status: o.status, paymentStatus: "Pendiente" },
  });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /deshaz el empaque desde Inventario/);
  assert.equal((await load(id)).items.length, 4);

  await call(ctl.unpackOrderItem, { params: line(id, 1) });
  const edited = base.map((it) => (it.sourceIndex === 1 ? { ...it, quantity: 50, subtotal: 50 } : it));
  r = await call(ctl.updateOrder, { params: { id }, body: { items: edited, total: 130, status: o.status, paymentStatus: "Pendiente" } });
  assert.equal(r.status, 200);
  o = await load(id);
  assert.equal(await stock("Bodega A"), 400);
  assert.equal(o.items[1].verified, false);
  assert.equal(o.items[1].quantity, 50);
});

test("editar sin sourceIndex (Movil) no mueve stock", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 2), body: { warehouse: "Bodega B" } });
  const o = await load(id);
  const r = await call(ctl.updateOrder, {
    params: { id },
    body: { items: o.toObject().items, total: o.total, status: o.status, paymentStatus: "Pagado" },
  });
  assert.equal(r.status, 200);
  assert.equal(await stock("Bodega B"), 15);
  assert.equal((await load(id)).items[2].verified, true);
});

// --- Eliminar pedido --------------------------------------------------------

test("eliminar un pedido sin nada procesado", async () => {
  const id = await createOrder();
  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await load(id), null);
  assert.equal(await stock("Bodega A"), 400);
  assert.equal(await stock("Bodega B"), 25);
});

test("eliminar un pedido con una línea verificada devuelve su stock", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  await call(ctl.splitPartialItem, { params: line(id, 0), body: { warehouse: "Bodega B", quantity: 25 } });
  assert.equal(await stock("Bodega A"), 300);
  assert.equal(await stock("Bodega B"), 0);

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await load(id), null);
  assert.equal(await stock("Bodega A"), 400, "vuelve lo verificado");
  assert.equal(await stock("Bodega B"), 25, "vuelve lo tomado de la línea dividida");
});

test("no se elimina un pedido con una línea empacada", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  await call(ctl.verifyOrderItem, { params: line(id, 2), body: { warehouse: "Bodega A" } });
  await call(ctl.packOrderItem, { params: line(id, 1) });

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /deshaz el empaque desde Inventario para poder eliminar el pedido/);
  assert.ok(await load(id), "el pedido sigue existiendo");
  assert.equal(await stock("Bodega A"), 290, "no se devolvió nada (la transacción no se aplicó)");
});

test("no se elimina un pedido con un lote En Proceso", async () => {
  const id = await createOrder();
  await call(ctl.verifyOrderItem, { params: line(id, 1), body: { warehouse: "Bodega A" } });
  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  const o = await load(id);
  await Batch.updateOne({ _id: o.items[3].manufacturingBatch }, { status: "En Proceso" });

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /Resuélvelo desde Fabricación antes de eliminar el pedido/i);
  assert.ok(await load(id));
  assert.equal(await stock("Bodega A"), 300, "el stock verificado no se devolvió");
  assert.ok(await Batch.findById(o.items[3].manufacturingBatch));
});

test("eliminar un pedido con un lote Programado borra el lote", async () => {
  const id = await createOrder();
  await call(ctl.sendItemToManufacturing, { params: line(id, 3) });
  const batchId = (await load(id)).items[3].manufacturingBatch;
  assert.ok(await Batch.findById(batchId));

  const r = await call(ctl.deleteOrder, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(await load(id), null);
  assert.equal(await Batch.findById(batchId), null);
});

test("eliminar un pedido que no existe responde 200", async () => {
  const r = await call(ctl.deleteOrder, { params: { id: new mongoose.Types.ObjectId().toString() } });
  assert.equal(r.status, 200);
});
