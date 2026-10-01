// El «producto» de pedidos, lotes, producción diaria y artículos de Producto
// Terminado es el nombre de una subcategoría. Pruebas contra un MongoDB en
// memoria (nunca la base real).
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Subcategory from "../src/models/Subcategory.js";
import Order from "../src/models/Order.js";
import Transaction from "../src/models/Transaction.js";
import Inventory from "../src/models/InventoryItem.js";
import Batch from "../src/models/ProductionBatch.js";
import DailyBatch from "../src/models/DailyBatch.js";
import ordersCtl from "../src/controller/ordersController.js";
import batchCtl from "../src/controller/productionBatchesController.js";
import dailyCtl from "../src/controller/dailyBatchesController.js";
import inventoryCtl from "../src/controller/inventoryController.js";
import { createStoreOrder } from "./helpers/storeOrder.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test_product_names" });
  await Subcategory.syncIndexes();
  for (const m of [Order, Transaction, Inventory, Batch, DailyBatch]) await m.createCollection();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Subcategory, Order, Transaction, Inventory, Batch, DailyBatch].map((m) => m.deleteMany({})));
  await Subcategory.create([
    { name: "Pajilla jumbo", category: "Pajillas" },
    { name: "Pelota plástica", category: "Pelotas" },
    { name: "Pajilla vieja", category: "Pajillas", active: false },
  ]);
});

// Llama un handler con req/res mínimos; un error lanzado (HttpError) se
// traduce como lo hace el manejador global de app.js.
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
  try {
    await handler({ params, body }, res);
  } catch (error) {
    status = error.status || 500;
    payload = { message: error.message };
  }
  return { status, payload: JSON.parse(JSON.stringify(payload ?? null)) };
}

const NOT_FOUND = /no existe/;

// --- Producción diaria -------------------------------------------------------

test("producción diaria: crea con una subcategoría activa y guarda su nombre", async () => {
  const r = await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", product: "  pajilla JUMBO ", color: "Rojo" } });
  assert.equal(r.status, 200);
  const saved = await DailyBatch.findOne();
  assert.equal(saved.product, "Pajilla jumbo");
});

test("producción diaria: un producto inexistente, vacío o inactivo da 400", async () => {
  const missing = await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", product: "Pajilla", color: "Rojo" } });
  assert.equal(missing.status, 400);
  assert.match(missing.payload.message, NOT_FOUND);
  assert.equal((await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", product: "  ", color: "Rojo" } })).status, 400);
  assert.equal((await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", color: "Rojo" } })).status, 400);
  const inactive = await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", product: "Pajilla vieja", color: "Rojo" } });
  assert.equal(inactive.status, 400);
  assert.match(inactive.payload.message, /inactivo/);
  assert.equal(await DailyBatch.countDocuments(), 0);
});

test("producción diaria: editar conserva un producto ya inactivo, pero no cambia a otro inválido", async () => {
  await call(dailyCtl.insertBatch, { body: { date: "2026-09-30", product: "Pajilla jumbo", color: "Rojo" } });
  const batch = await DailyBatch.findOne();
  await Subcategory.updateOne({ name: "Pajilla jumbo" }, { active: false });

  const same = await call(dailyCtl.updateBatch, { params: { id: String(batch._id) }, body: { date: "2026-10-01", product: "Pajilla jumbo", color: "Azul" } });
  assert.equal(same.status, 200);
  assert.equal((await DailyBatch.findById(batch._id)).color, "Azul");

  const other = await call(dailyCtl.updateBatch, { params: { id: String(batch._id) }, body: { date: "2026-10-01", product: "Pajilla vieja", color: "Azul" } });
  assert.equal(other.status, 400);
  const unknown = await call(dailyCtl.updateBatch, { params: { id: String(batch._id) }, body: { date: "2026-10-01", product: "Nada", color: "Azul" } });
  assert.equal(unknown.status, 400);
});

// --- Lotes de fabricación ----------------------------------------------------

test("lote: crea con subcategoría, rechaza un producto inexistente y conserva uno viejo al editar", async () => {
  const ok = await call(batchCtl.insertBatch, { body: { product: "Pelota plástica", color: "Verde", targetQuantity: 100, status: "Programado" } });
  assert.equal(ok.status, 200);
  const batch = await Batch.findOne({ batchNumber: ok.payload.batchNumber });
  assert.equal(batch.product, "Pelota plástica");

  const bad = await call(batchCtl.insertBatch, { body: { product: "Pelota", color: "Verde", targetQuantity: 100 } });
  assert.equal(bad.status, 400);
  assert.match(bad.payload.message, NOT_FOUND);
  assert.equal(await Batch.countDocuments(), 1);

  // Lote anterior a las subcategorías ("Pajilla" ya no existe): se edita sin tocar el producto.
  const legacy = await Batch.create({ batchNumber: "LOTE-OLD", product: "Pajilla", color: "Rojo", targetQuantity: 10 });
  const edit = await call(batchCtl.updateBatch, { params: { id: String(legacy._id) }, body: { product: "Pajilla", targetQuantity: 20 } });
  assert.equal(edit.status, 200);
  assert.equal((await Batch.findById(legacy._id)).targetQuantity, 20);
  // Editar sin mandar el producto tampoco lo valida ni lo cambia.
  assert.equal((await call(batchCtl.updateBatch, { params: { id: String(legacy._id) }, body: { targetQuantity: 30 } })).status, 200);
  // Pero cambiarlo exige una subcategoría válida.
  assert.equal((await call(batchCtl.updateBatch, { params: { id: String(legacy._id) }, body: { product: "Nada" } })).status, 400);
  assert.equal((await call(batchCtl.updateBatch, { params: { id: String(legacy._id) }, body: { product: "Pajilla jumbo" } })).status, 200);
});

// --- Pedidos -------------------------------------------------------------------

// Los pedidos solo los crea la tienda: el panel ya no crea ni edita pedidos, así
// que aquí solo se prueba lo que sigue usando el nombre de la subcategoría.
const orderBody = (items) => ({ customer: { name: "Cliente" }, items, total: 10 });
const item = (product, color = "Rojo", quantity = 100) => ({ product, color, quantity, unitPrice: 0.1, subtotal: quantity * 0.1 });

test("pedido: verificar y empacar descuenta el inventario de la subcategoría + color + bodega", async () => {
  await Inventory.create([
    { name: "Pajilla jumbo", color: "Rojo", category: "Producto Terminado", location: "Central", stock: 500, unit: "unidad" },
    { name: "Pajilla jumbo", color: "Azul", category: "Producto Terminado", location: "Central", stock: 300, unit: "unidad" },
    { name: "Pajilla", color: "Rojo", category: "Producto Terminado", location: "Central", stock: 999, unit: "unidad" },
  ]);
  const stock = async (name, color) => (await Inventory.findOne({ name, color, location: "Central" })).stock;

  const id = String((await createStoreOrder(orderBody([item("Pajilla jumbo", "Rojo", 120)])))._id);
  const line = { id, index: "0" };

  const verify = await call(ordersCtl.verifyOrderItem, { params: line, body: { warehouse: "Central" } });
  assert.equal(verify.status, 200);
  assert.equal(await stock("Pajilla jumbo", "Rojo"), 380);
  assert.equal(await stock("Pajilla jumbo", "Azul"), 300, "otro color no se toca");
  assert.equal(await stock("Pajilla", "Rojo"), 999, "el artículo viejo «Pajilla» no se toca");

  const pack = await call(ordersCtl.packOrderItem, { params: line });
  assert.equal(pack.status, 200);
  assert.equal((await Order.findById(id)).items[0].packed, true);

  assert.equal((await call(ordersCtl.unpackOrderItem, { params: line })).status, 200);
  assert.equal((await call(ordersCtl.unverifyOrderItem, { params: line })).status, 200);
  assert.equal(await stock("Pajilla jumbo", "Rojo"), 500);
});

// --- Inventario: Producto Terminado ------------------------------------------

test("inventario: un producto terminado usa una subcategoría; la materia prima no se valida", async () => {
  const bad = await call(inventoryCtl.insertItem, { body: { name: "Pajilla", category: "Producto Terminado", color: "Rojo", stock: 1 } });
  assert.equal(bad.status, 400);
  assert.match(bad.payload.message, NOT_FOUND);
  assert.equal((await call(inventoryCtl.insertItem, { body: { name: "Pajilla vieja", category: "Producto Terminado", color: "Rojo" } })).status, 400);

  const ok = await call(inventoryCtl.insertItem, { body: { name: "pajilla jumbo", category: "Producto Terminado", color: "Rojo", stock: 5, location: "Central" } });
  assert.equal(ok.status, 200);
  const saved = await Inventory.findOne({ category: "Producto Terminado" });
  assert.equal(saved.name, "Pajilla jumbo");

  const raw = await call(inventoryCtl.insertItem, { body: { name: "Polietileno", category: "Materia Prima", materialType: "Polimero" } });
  assert.equal(raw.status, 200);

  // Editar: conserva el nombre aunque la subcategoría se desactive.
  await Subcategory.updateOne({ name: "Pajilla jumbo" }, { active: false });
  const edit = await call(inventoryCtl.updateItem, { params: { id: String(saved._id) }, body: { name: "Pajilla jumbo", category: "Producto Terminado", color: "Rojo", stock: 9 } });
  assert.equal(edit.status, 200);
  assert.equal((await Inventory.findById(saved._id)).stock, 9);
  assert.equal((await call(inventoryCtl.updateItem, { params: { id: String(saved._id) }, body: { name: "Nada", category: "Producto Terminado" } })).status, 400);
});
