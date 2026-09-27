// Pruebas de Líneas de producción (/productionLines), del CRUD de empleados
// con DUI y de «Mi cuenta» (/auth/me) contra un MongoDB en memoria. Nunca
// tocan la base real.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import ProductionLine from "../src/models/ProductionLine.js";
import ProductionBatch from "../src/models/ProductionBatch.js";
import Employee from "../src/models/Employee.js";
import linesCtl from "../src/controller/productionLinesController.js";
import employeesCtl from "../src/controller/employeesController.js";
import authCtl from "../src/controller/authController.js";

let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "charly_test_account" });
  await Employee.syncIndexes();
  await ProductionLine.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Promise.all([ProductionLine.deleteMany({}), ProductionBatch.deleteMany({}), Employee.deleteMany({})]);
});

async function call(handler, { params = {}, body = {}, user } = {}) {
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
  await handler({ params, body, query: {}, user }, res);
  return { status, payload };
}

// ---- Líneas de producción

test("la primera lectura crea Línea 1–4 más las que ya usan los lotes", async () => {
  await ProductionBatch.create({ batchNumber: "LOTE-1", product: "Pajilla", productionLine: "Línea 7" });
  const { payload } = await call(linesCtl.getLines);
  assert.deepEqual(payload.map((l) => l.name), ["Línea 1", "Línea 2", "Línea 3", "Línea 4", "Línea 7"]);
  assert.ok(payload.every((l) => l.active));
});

test("agregar una línea y rechazar nombres repetidos o vacíos", async () => {
  assert.equal((await call(linesCtl.insertLine, { body: { name: " Línea 5 " } })).status, 201);
  assert.equal((await call(linesCtl.insertLine, { body: { name: "Línea 5" } })).status, 400);
  assert.equal((await call(linesCtl.insertLine, { body: { name: "  " } })).status, 400);
});

test("no se elimina una línea con un lote en proceso, y avisa por qué", async () => {
  const [l1] = await ProductionLine.create([{ name: "Línea 1" }, { name: "Línea 2" }]);
  await ProductionBatch.create({ batchNumber: "LOTE-2", product: "Pajilla", productionLine: "Línea 1", status: "En Proceso" });
  const { status, payload } = await call(linesCtl.deleteLine, { params: { id: l1._id } });
  assert.equal(status, 409);
  assert.match(payload.message, /1 lote en proceso/);
  assert.equal(await ProductionLine.countDocuments(), 2);
});

test("se elimina una línea sin lotes en proceso, pero nunca la última activa", async () => {
  const [l1, l2] = await ProductionLine.create([{ name: "Línea 1" }, { name: "Línea 2" }]);
  assert.equal((await call(linesCtl.deleteLine, { params: { id: l1._id } })).status, 200);
  assert.equal((await call(linesCtl.deleteLine, { params: { id: l2._id } })).status, 409);
  assert.equal((await call(linesCtl.updateLine, { params: { id: l2._id }, body: { active: false } })).status, 409);
});

// ---- Empleados: DUI

test("el DUI se acepta con guion y se guarda en 9 dígitos; formato inválido o correo repetido dan 400", async () => {
  const base = { name: "Ana", lastName: "Ruiz", email: "ana@charly.test", password: "secreto1", department: "Finanzas" };
  assert.equal((await call(employeesCtl.insertEmployee, { body: { ...base, dui: "12345678-9" } })).status, 200);
  assert.equal((await Employee.findOne({ email: "ana@charly.test" })).dui, "123456789");
  assert.equal((await call(employeesCtl.insertEmployee, { body: { ...base, email: "otro@charly.test", dui: "1234" } })).status, 400);
  const dup = await call(employeesCtl.insertEmployee, { body: base });
  assert.equal(dup.status, 400);
  assert.match(dup.payload.message, /correo/);
});

// ---- Mi cuenta

async function sessionEmployee() {
  const e = await Employee.create({
    name: "QA", lastName: "Admin", email: "qa@charly.test", password: await bcryptjs.hash("actual123", 10), department: "Administración",
  });
  return { id: String(e._id) };
}

test("Mi cuenta edita teléfono y DUI sin pedir contraseña", async () => {
  const user = await sessionEmployee();
  const { status, payload } = await call(authCtl.updateMe, { user, body: { phone: "7777-0000", dui: "98765432-1" } });
  assert.equal(status, 200);
  assert.equal(payload.phone, "7777-0000");
  assert.equal(payload.dui, "987654321");
  assert.equal(payload.password, undefined);
});

test("cambiar correo o contraseña exige la contraseña actual", async () => {
  const user = await sessionEmployee();
  const wrong = await call(authCtl.updateCredentials, { user, body: { currentPassword: "mala", email: "nuevo@charly.test" } });
  assert.equal(wrong.status, 400);
  assert.equal((await Employee.findById(user.id)).email, "qa@charly.test");

  const ok = await call(authCtl.updateCredentials, { user, body: { currentPassword: "actual123", email: "Nuevo@Charly.test", newPassword: "nueva456" } });
  assert.equal(ok.status, 200);
  const saved = await Employee.findById(user.id);
  assert.equal(saved.email, "nuevo@charly.test");
  assert.ok(await bcryptjs.compare("nueva456", saved.password));

  assert.equal((await call(authCtl.updateCredentials, { user, body: { currentPassword: "nueva456", newPassword: "123" } })).status, 400);
});
