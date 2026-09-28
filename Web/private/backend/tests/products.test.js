// Pruebas de la administración del Catálogo (/products) contra un MongoDB en
// memoria. Nunca tocan la base real. Las subidas y borrados en Cloudinary no
// se prueban aquí (salen a la red): los productos de prueba no tienen imágenes.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../src/models/Product.js";
import ctl from "../src/controller/productsController.js";

let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "charly_test_products" });
  await Product.init(); // índice único de slug
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
});

async function call(handler, { params = {}, body = {}, files } = {}) {
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
  await handler({ params, body, query: {}, files }, res);
  return { status, payload: JSON.parse(JSON.stringify(payload ?? null)) };
}

const base = { name: "Pelota plástica 60 mm", category: "Pelotas", price: 0.25 };

test("crear genera el slug sin acentos y evita colisiones", async () => {
  const first = await call(ctl.createProduct, { body: base });
  assert.equal(first.status, 201);
  assert.equal(first.payload.slug, "pelota-plastica-60-mm");
  assert.equal(first.payload.active, true);
  assert.equal(first.payload.featured, false);

  const second = await call(ctl.createProduct, { body: base });
  assert.equal(second.status, 201);
  assert.notEqual(second.payload.slug, first.payload.slug);
  assert.ok(second.payload.slug.startsWith("pelota-plastica-60-mm-"));
});

test("crear respeta «activo» cuando el panel lo manda en falso", async () => {
  const { payload } = await call(ctl.createProduct, { body: { ...base, active: false } });
  assert.equal(payload.active, false);
});

test("crear exige nombre, categoría y precio, y valida la categoría", async () => {
  assert.equal((await call(ctl.createProduct, { body: { name: "X", category: "Pelotas" } })).status, 400);
  assert.equal((await call(ctl.createProduct, { body: { ...base, category: "Otra" } })).status, 400);
  assert.equal(await Product.countDocuments(), 0);
});

test("el listado de administración incluye los desactivados, más nuevos primero", async () => {
  await call(ctl.createProduct, { body: { ...base, name: "Uno" } });
  await call(ctl.createProduct, { body: { ...base, name: "Dos", active: false } });
  const { status, payload } = await call(ctl.getAllProductsAdmin);
  assert.equal(status, 200);
  assert.deepEqual(payload.map((p) => p.name), ["Dos", "Uno"]);
});

test("editar actualiza, valida y responde 404 si no existe", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: base });
  const updated = await call(ctl.updateProduct, { params: { id: created._id }, body: { price: 0.3, active: false } });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.price, 0.3);
  assert.equal(updated.payload.active, false);

  assert.equal((await call(ctl.updateProduct, { params: { id: created._id }, body: { price: -1 } })).status, 400);
  assert.equal((await call(ctl.updateProduct, { params: { id: new mongoose.Types.ObjectId() }, body: { price: 1 } })).status, 404);
  assert.equal((await call(ctl.updateProduct, { params: { id: "no-es-un-id" }, body: { price: 1 } })).status, 400);
});

test("eliminar borra el producto y responde 404 la segunda vez", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: base });
  assert.equal((await call(ctl.deleteProduct, { params: { id: created._id } })).status, 200);
  assert.equal(await Product.countDocuments(), 0);
  assert.equal((await call(ctl.deleteProduct, { params: { id: created._id } })).status, 404);
});

test("subir imágenes sin archivos responde 400 sin tocar el producto", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: base });
  const { status } = await call(ctl.addImages, { params: { id: created._id }, files: [] });
  assert.equal(status, 400);
  assert.equal((await Product.findById(created._id)).images.length, 0);
});
