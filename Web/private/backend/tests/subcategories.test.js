// Pruebas de Subcategorías (/subcategories) contra un MongoDB en memoria.
// Nunca tocan la base real.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Subcategory from "../src/models/Subcategory.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import ProductionBatch from "../src/models/ProductionBatch.js";
import DailyBatch from "../src/models/DailyBatch.js";
import InventoryItem from "../src/models/InventoryItem.js";
import ctl from "../src/controller/subcategoriesController.js";

let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "charly_test_subcategories" });
  await Subcategory.syncIndexes(); // índice único sin distinguir mayúsculas
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Promise.all(
    [Subcategory, Product, Order, ProductionBatch, DailyBatch, InventoryItem].map((m) => m.deleteMany({})),
  );
});

async function call(handler, { params = {}, body = {}, query = {} } = {}) {
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
  return { status, payload: JSON.parse(JSON.stringify(payload ?? null)) };
}

const create = (body) => call(ctl.insertSubcategory, { body });

test("crear guarda nombre sin espacios de más, categoría y activa por defecto", async () => {
  const { status, payload } = await create({ name: "  Pajilla jumbo ", category: "Pajillas" });
  assert.equal(status, 201);
  assert.equal(payload.name, "Pajilla jumbo");
  assert.equal(payload.category, "Pajillas");
  assert.equal(payload.active, true);
  assert.equal(payload.inUse, false);
});

test("crear valida nombre vacío y categoría", async () => {
  assert.equal((await create({ name: "  ", category: "Pajillas" })).status, 400);
  assert.equal((await create({ category: "Pajillas" })).status, 400);
  assert.equal((await create({ name: "X", category: "Otra" })).status, 400);
  assert.equal((await create({ name: "X" })).status, 400);
  assert.equal(await Subcategory.countDocuments(), 0);
});

test("crear con un nombre repetido (sin distinguir mayúsculas) responde 409", async () => {
  await create({ name: "Pajilla jumbo", category: "Pajillas" });
  const dup = await create({ name: "PAJILLA JUMBO", category: "Pajillas" });
  assert.equal(dup.status, 409);
  assert.match(dup.payload.message, /Ya existe una subcategoría llamada «PAJILLA JUMBO»/);
  // También entre categorías distintas: el nombre es el "producto" del sistema.
  assert.equal((await create({ name: "pajilla jumbo", category: "Pelotas" })).status, 409);
  assert.equal(await Subcategory.countDocuments(), 1);
});

test("el listado va ordenado por categoría y nombre, y filtra por categoría y activas", async () => {
  await create({ name: "Smoothie", category: "Pajillas" });
  await create({ name: "Jumbo", category: "Pajillas" });
  await create({ name: "Plástica 80 mm", category: "Pelotas" });
  const inactive = (await create({ name: "Antigua", category: "Pajillas" })).payload;
  await call(ctl.updateSubcategory, { params: { id: inactive._id }, body: { active: false } });

  const all = await call(ctl.getSubcategories);
  assert.deepEqual(all.payload.map((s) => s.name), ["Antigua", "Jumbo", "Smoothie", "Plástica 80 mm"]);

  const pajillas = await call(ctl.getSubcategories, { query: { category: "Pajillas" } });
  assert.deepEqual(pajillas.payload.map((s) => s.name), ["Antigua", "Jumbo", "Smoothie"]);

  const active = await call(ctl.getSubcategories, { query: { active: "true" } });
  assert.deepEqual(active.payload.map((s) => s.name), ["Jumbo", "Smoothie", "Plástica 80 mm"]);

  const both = await call(ctl.getSubcategories, { query: { category: "Pelotas", active: "true" } });
  assert.deepEqual(both.payload.map((s) => s.name), ["Plástica 80 mm"]);

  assert.equal((await call(ctl.getSubcategories, { query: { category: "Otra" } })).status, 400);
});

test("editar libre: renombrar, cambiar de categoría y desactivar; valida y detecta duplicados", async () => {
  const a = (await create({ name: "Jumbo", category: "Pajillas" })).payload;
  await create({ name: "Smoothie", category: "Pajillas" });

  const renamed = await call(ctl.updateSubcategory, { params: { id: a._id }, body: { name: " Jumbo XL " } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.payload.name, "Jumbo XL");

  const moved = await call(ctl.updateSubcategory, { params: { id: a._id }, body: { category: "Pelotas", active: false } });
  assert.equal(moved.payload.category, "Pelotas");
  assert.equal(moved.payload.active, false);

  const dup = await call(ctl.updateSubcategory, { params: { id: a._id }, body: { name: "smoothie" } });
  assert.equal(dup.status, 409);

  assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: { name: "  " } })).status, 400);
  assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: { category: "Otra" } })).status, 400);
  assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: { active: "si" } })).status, 400);
  assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: {} })).status, 400);
  assert.equal((await call(ctl.updateSubcategory, { params: { id: new mongoose.Types.ObjectId() }, body: { active: true } })).status, 404);
});

test("eliminar una subcategoría libre funciona y la segunda vez responde 404", async () => {
  const a = (await create({ name: "Jumbo", category: "Pajillas" })).payload;
  const first = await call(ctl.deleteSubcategory, { params: { id: a._id } });
  assert.equal(first.status, 200);
  assert.equal(await Subcategory.countDocuments(), 0);
  assert.equal((await call(ctl.deleteSubcategory, { params: { id: a._id } })).status, 404);
});

// Un registro en cada colección que guarda el nombre como texto.
const USES = {
  "products.subcategory": (name) => Product.create({ name: "P", slug: "p", category: "Pajillas", price: 1, subcategory: name }),
  "orders.items.product": (name) =>
    Order.collection.insertOne({ orderNumber: "ORD-T-1", items: [{ product: name, quantity: 1, unitPrice: 1, subtotal: 1 }] }),
  "productionbatches.product": (name) => ProductionBatch.collection.insertOne({ batchNumber: "LOTE-T", product: name }),
  "dailybatches.product": (name) => DailyBatch.collection.insertOne({ date: new Date(), product: name }),
  "inventoryitems.name (Producto Terminado)": (name) =>
    InventoryItem.collection.insertOne({ name, category: "Producto Terminado", stock: 1 }),
};

for (const [where, seed] of Object.entries(USES)) {
  test(`en uso por ${where}: inUse, no se elimina, no se renombra, sí se desactiva`, async () => {
    const a = (await create({ name: "Jumbo", category: "Pajillas" })).payload;
    const free = (await create({ name: "Libre", category: "Pelotas" })).payload;
    await seed("jumbo"); // el uso se detecta sin distinguir mayúsculas

    const list = (await call(ctl.getSubcategories)).payload;
    assert.equal(list.find((s) => s.name === "Jumbo").inUse, true);
    assert.equal(list.find((s) => s.name === "Libre").inUse, false);

    const del = await call(ctl.deleteSubcategory, { params: { id: a._id } });
    assert.equal(del.status, 409);
    assert.equal(del.payload.message, "No se puede eliminar: la subcategoría ya se usa en registros. Puedes desactivarla.");

    assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: { name: "Jumbo 2" } })).status, 409);
    assert.equal((await call(ctl.updateSubcategory, { params: { id: a._id }, body: { category: "Pelotas" } })).status, 409);

    const off = await call(ctl.updateSubcategory, { params: { id: a._id }, body: { active: false } });
    assert.equal(off.status, 200);
    assert.equal(off.payload.active, false);
    assert.equal(off.payload.inUse, true);

    // La libre sigue sin restricciones.
    assert.equal((await call(ctl.deleteSubcategory, { params: { id: free._id } })).status, 200);
    assert.equal(await Subcategory.countDocuments(), 1);
  });
}

test("un inventario de Materia Prima con el mismo nombre NO cuenta como uso", async () => {
  const a = (await create({ name: "Jumbo", category: "Pajillas" })).payload;
  await InventoryItem.collection.insertOne({ name: "Jumbo", category: "Materia Prima", stock: 1 });
  assert.equal((await call(ctl.getSubcategories)).payload[0].inUse, false);
  assert.equal((await call(ctl.deleteSubcategory, { params: { id: a._id } })).status, 200);
});

test("guardar el mismo nombre y categoría en una subcategoría en uso no cuenta como cambio", async () => {
  const a = (await create({ name: "Jumbo", category: "Pajillas" })).payload;
  await USES["products.subcategory"]("Jumbo");
  const r = await call(ctl.updateSubcategory, { params: { id: a._id }, body: { name: "Jumbo", category: "Pajillas", active: false } });
  assert.equal(r.status, 200);
});
