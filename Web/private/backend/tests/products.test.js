// Pruebas de la administración del Catálogo (/products) contra un MongoDB en
// memoria. Nunca tocan la base real. Las subidas y borrados en Cloudinary no
// se prueban aquí (salen a la red): los productos de prueba no tienen imágenes.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../src/models/Product.js";
import Subcategory from "../src/models/Subcategory.js";
import ctl from "../src/controller/productsController.js";

let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "charly_test_products" });
  await Product.init(); // índice único de slug
  await Subcategory.init();
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Subcategory.deleteMany({});
  await Subcategory.create([
    { name: "Pelota plástica", category: "Pelotas" },
    { name: "Pelota mini", category: "Pelotas" },
    { name: "Pajilla jumbo", category: "Pajillas" },
    { name: "Pajilla larga", category: "Pajillas" },
    { name: "Pajilla vieja", category: "Pajillas", active: false },
  ]);
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

// El nombre del producto no se manda: el backend lo toma de la subcategoría.
const base = { category: "Pelotas", subcategory: "Pelota plástica", price: 0.25 };

test("crear sin name: el nombre es el de la subcategoría y el slug sale de él, sin acentos", async () => {
  const { status, payload } = await call(ctl.createProduct, { body: base });
  assert.equal(status, 201);
  assert.equal(payload.name, "Pelota plástica");
  assert.equal(payload.slug, "pelota-plastica");
  assert.equal(payload.subcategory, "Pelota plástica");
  assert.equal(payload.active, true);
  assert.equal(payload.featured, false);
});

test("crear ignora el name del cuerpo y evita colisiones de slug", async () => {
  // Un producto anterior ya usa ese slug.
  await Product.create({ name: "Otro", slug: "pelota-plastica", category: "Pelotas", price: 1 });
  const { status, payload } = await call(ctl.createProduct, { body: { ...base, name: "Nombre cualquiera" } });
  assert.equal(status, 201);
  assert.equal(payload.name, "Pelota plástica");
  assert.ok(payload.slug.startsWith("pelota-plastica-"));
  assert.notEqual(payload.slug, "pelota-plastica");
});

test("crear respeta «activo» cuando el panel lo manda en falso", async () => {
  const { payload } = await call(ctl.createProduct, { body: { ...base, active: false } });
  assert.equal(payload.active, false);
});

test("crear exige categoría, subcategoría y precio, y valida la categoría", async () => {
  const noPrice = await call(ctl.createProduct, { body: { category: "Pelotas", subcategory: "Pelota plástica" } });
  assert.equal(noPrice.status, 400);
  assert.equal(noPrice.payload.message, "category, subcategory y price son obligatorios.");
  assert.equal((await call(ctl.createProduct, { body: { subcategory: "Pelota plástica", price: 1 } })).status, 400);
  assert.equal((await call(ctl.createProduct, { body: { ...base, category: "Otra" } })).status, 400);
  assert.equal(await Product.countDocuments(), 0);
});

test("el listado de administración incluye los desactivados, más nuevos primero", async () => {
  await call(ctl.createProduct, { body: base });
  await call(ctl.createProduct, { body: { ...base, subcategory: "Pelota mini", active: false } });
  const { status, payload } = await call(ctl.getAllProductsAdmin);
  assert.equal(status, 200);
  assert.deepEqual(payload.map((p) => p.name), ["Pelota mini", "Pelota plástica"]);
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

// --- Subcategoría obligatoria al crear y editar ---------------------------

test("crear exige una subcategoría que exista, esté activa y sea de la categoría", async () => {
  const { subcategory, ...sinSub } = base;
  const missing = await call(ctl.createProduct, { body: sinSub });
  assert.equal(missing.status, 400);
  assert.equal(missing.payload.message, "category, subcategory y price son obligatorios.");
  const blank = await call(ctl.createProduct, { body: { ...base, subcategory: "   " } });
  assert.equal(blank.status, 400);
  assert.equal(blank.payload.message, "Elige una subcategoría.");

  const unknown = await call(ctl.createProduct, { body: { ...base, subcategory: "No existe" } });
  assert.equal(unknown.status, 400);
  assert.match(unknown.payload.message, /no existe/);

  const inactive = await call(ctl.createProduct, { body: { ...base, subcategory: "Pajilla vieja", category: "Pajillas" } });
  assert.equal(inactive.status, 400);
  assert.match(inactive.payload.message, /inactiva/);

  const mismatch = await call(ctl.createProduct, { body: { ...base, subcategory: "Pajilla jumbo" } });
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.payload.message, /pertenece a «Pajillas»/);

  assert.equal(await Product.countDocuments(), 0);
});

test("crear guarda el nombre de la subcategoría tal como está en Configuración", async () => {
  const { status, payload } = await call(ctl.createProduct, { body: { ...base, subcategory: "  pelota PLÁSTICA " } });
  assert.equal(status, 201);
  assert.equal(payload.subcategory, "Pelota plástica");
  assert.equal(payload.name, "Pelota plástica");
});

test("editar: cambiar de categoría exige una subcategoría de la nueva categoría", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: base });
  const bad = await call(ctl.updateProduct, { params: { id: created._id }, body: { category: "Pajillas" } });
  assert.equal(bad.status, 400);
  const ok = await call(ctl.updateProduct, { params: { id: created._id }, body: { category: "Pajillas", subcategory: "Pajilla jumbo" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.subcategory, "Pajilla jumbo");
  assert.equal(ok.payload.name, "Pajilla jumbo");
});

test("editar permite conservar la subcategoría actual aunque ya esté inactiva", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: { ...base, category: "Pajillas", subcategory: "Pajilla jumbo" } });
  await Subcategory.updateOne({ name: "Pajilla jumbo" }, { active: false });
  const same = await call(ctl.updateProduct, { params: { id: created._id }, body: { price: 0.4 } });
  assert.equal(same.status, 200);
  assert.equal(same.payload.subcategory, "Pajilla jumbo");
  // Pero no se puede cambiar a otra inactiva.
  const other = await call(ctl.updateProduct, { params: { id: created._id }, body: { subcategory: "Pajilla vieja" } });
  assert.equal(other.status, 400);
});

test("editar un producto anterior a las subcategorías exige asignarle una", async () => {
  const legacy = await Product.create({ name: "Viejo", slug: "viejo", category: "Pelotas", price: 1 });
  const without = await call(ctl.updateProduct, { params: { id: legacy._id }, body: { price: 2 } });
  assert.equal(without.status, 400);
  const withSub = await call(ctl.updateProduct, { params: { id: legacy._id }, body: { price: 2, subcategory: "Pelota plástica" } });
  assert.equal(withSub.status, 200);
  assert.equal(withSub.payload.subcategory, "Pelota plástica");
});

// --- El nombre sigue a la subcategoría; una subcategoría = un producto -------

test("editar cambiando de subcategoría cambia el name pero no el slug, e ignora name y slug del cuerpo", async () => {
  const { payload: created } = await call(ctl.createProduct, { body: base });
  assert.equal(created.slug, "pelota-plastica");

  const changed = await call(ctl.updateProduct, {
    params: { id: created._id },
    body: { subcategory: "Pelota mini", name: "Otro nombre", slug: "otro-slug", price: 0.5 },
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.payload.subcategory, "Pelota mini");
  assert.equal(changed.payload.name, "Pelota mini");
  assert.equal(changed.payload.slug, "pelota-plastica", "el slug no cambia al editar");
  assert.equal(changed.payload.price, 0.5);

  // Editar otros campos con la misma subcategoría deja el name como está y no pelea consigo mismo.
  const same = await call(ctl.updateProduct, { params: { id: created._id }, body: { subcategory: "Pelota mini", name: "Otro", price: 0.6 } });
  assert.equal(same.status, 200);
  assert.equal(same.payload.name, "Pelota mini");
  assert.equal(same.payload.slug, "pelota-plastica");
});

test("editar sincroniza el name de un producto anterior con su subcategoría", async () => {
  const legacy = await Product.create({ name: "Pelotas", slug: "pelotas", category: "Pelotas", subcategory: "Pelota plástica", price: 1 });
  const r = await call(ctl.updateProduct, { params: { id: legacy._id }, body: { price: 2 } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.name, "Pelota plástica");
  assert.equal(r.payload.slug, "pelotas");
});

test("una subcategoría = un producto: crear con una ya usada responde 409", async () => {
  await call(ctl.createProduct, { body: base });
  const dup = await call(ctl.createProduct, { body: { ...base, subcategory: "pelota PLÁSTICA" } });
  assert.equal(dup.status, 409);
  assert.equal(dup.payload.message, "La subcategoría «Pelota plástica» ya tiene un producto en el catálogo.");
  assert.equal(await Product.countDocuments(), 1);
  // Otra libre sí.
  assert.equal((await call(ctl.createProduct, { body: { ...base, subcategory: "Pelota mini" } })).status, 201);
});

test("una subcategoría = un producto: editar hacia una ya usada responde 409 y no cambia nada", async () => {
  const { payload: a } = await call(ctl.createProduct, { body: base });
  await call(ctl.createProduct, { body: { ...base, subcategory: "Pelota mini" } });
  const taken = await call(ctl.updateProduct, { params: { id: a._id }, body: { subcategory: "Pelota mini" } });
  assert.equal(taken.status, 409);
  assert.match(taken.payload.message, /ya tiene un producto/);
  const stored = await Product.findById(a._id);
  assert.equal(stored.subcategory, "Pelota plástica");
  assert.equal(stored.name, "Pelota plástica");
});

test("editar un producto con una subcategoría repetida por datos anteriores no se bloquea si no la cambia", async () => {
  const one = await Product.create({ name: "A", slug: "a", category: "Pajillas", subcategory: "Pajilla jumbo", price: 1 });
  await Product.create({ name: "B", slug: "b", category: "Pajillas", subcategory: "Pajilla jumbo", price: 1 });
  const r = await call(ctl.updateProduct, { params: { id: one._id }, body: { price: 3 } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.price, 3);
});
