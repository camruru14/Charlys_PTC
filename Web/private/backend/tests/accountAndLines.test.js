// Pruebas de Líneas de producción (/productionLines), del CRUD de empleados
// con DUI y de «Mi cuenta» (/auth/me) contra un MongoDB en memoria. Nunca
// tocan la base real.
//   npm test
import "./helpers/passwordKey.js";
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
import { decryptPassword, encryptPassword, isEncryptedPassword, verifyPassword } from "../src/lib/passwordCrypto.js";

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
    cookie() {
      return this;
    },
  };
  await handler({ params, body, query: {}, user }, res);
  // El login responde dentro del callback de jsonwebtoken.sign: se espera a que llegue.
  for (let i = 0; payload === undefined && i < 100; i += 1) await new Promise((r) => setTimeout(r, 5));
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

test("renombrar una línea actualiza los lotes que la usan; nombre repetido da 400", async () => {
  const [l1] = await ProductionLine.create([{ name: "Línea 1" }, { name: "Línea 2" }]);
  await ProductionBatch.create({ batchNumber: "LOTE-9", product: "Pajilla", productionLine: "Línea 1", status: "Completado" });
  assert.equal((await call(linesCtl.updateLine, { params: { id: l1._id }, body: { name: "Línea A" } })).status, 200);
  assert.equal((await ProductionBatch.findOne({ batchNumber: "LOTE-9" })).productionLine, "Línea A");
  assert.equal((await call(linesCtl.updateLine, { params: { id: l1._id }, body: { name: "Línea 2" } })).status, 400);
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

// ---- Contraseñas reversibles

test("encriptar y desencriptar: ida y vuelta, IV distinto cada vez y valor alterado rechazado", () => {
  const a = encryptPassword("secreta1");
  const b = encryptPassword("secreta1");
  assert.ok(isEncryptedPassword(a));
  assert.notEqual(a, b);
  assert.equal(decryptPassword(a), "secreta1");
  const tampered = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
  assert.equal(decryptPassword(tampered), null);
});

test("empleado nuevo: la contraseña queda encriptada, se puede leer y sirve para iniciar sesión", async () => {
  await call(employeesCtl.insertEmployee, {
    body: { name: "Ana", lastName: "Ruiz", email: "ana@charly.test", password: "clave123", department: "Finanzas" },
  });
  const e = await Employee.findOne({ email: "ana@charly.test" });
  assert.ok(isEncryptedPassword(e.password));
  assert.deepEqual((await call(employeesCtl.getPassword, { params: { id: e._id } })).payload, { password: "clave123", legacy: false });
  const ok = await call(authCtl.login, { body: { email: "ana@charly.test", password: "clave123" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.message, "Login successful");
  assert.equal((await call(authCtl.login, { body: { email: "ana@charly.test", password: "otra" } })).status, 401);
});

test("empleado con hash bcrypt viejo: entra con su contraseña, no se puede mostrar, y al asignarle una nueva pasa al formato nuevo", async () => {
  const hash = await bcryptjs.hash("original1", 10);
  const e = await Employee.create({ name: "Rosa", lastName: "Alas", email: "rosa@charly.test", password: hash, department: "Fabricación" });

  assert.equal((await call(authCtl.login, { body: { email: "rosa@charly.test", password: "original1" } })).payload.message, "Login successful");
  assert.deepEqual((await call(employeesCtl.getPassword, { params: { id: e._id } })).payload, { password: null, legacy: true });

  // Guardar sin contraseña (o reenviando el hash tal cual) no la cambia.
  await call(employeesCtl.updateEmployee, { params: { id: e._id }, body: { name: "Rosa" } });
  await call(employeesCtl.updateEmployee, { params: { id: e._id }, body: { name: "Rosa", password: hash } });
  assert.equal((await Employee.findById(e._id)).password, hash);

  await call(employeesCtl.updateEmployee, { params: { id: e._id }, body: { name: "Rosa", password: "nueva789" } });
  const updated = await Employee.findById(e._id);
  assert.ok(isEncryptedPassword(updated.password));
  assert.deepEqual((await call(employeesCtl.getPassword, { params: { id: e._id } })).payload, { password: "nueva789", legacy: false });
  assert.equal((await call(authCtl.login, { body: { email: "rosa@charly.test", password: "nueva789" } })).payload.message, "Login successful");
  assert.equal((await call(authCtl.login, { body: { email: "rosa@charly.test", password: "original1" } })).status, 401);
});

test("editar reenviando la misma contraseña desencriptada no la vuelve a encriptar", async () => {
  const stored = encryptPassword("igual123");
  const e = await Employee.create({ name: "Luis", lastName: "Ortiz", email: "luis@charly.test", password: stored, department: "Almacén" });
  await call(employeesCtl.updateEmployee, { params: { id: e._id }, body: { name: "Luis", password: "igual123" } });
  assert.equal((await Employee.findById(e._id)).password, stored);
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
  assert.ok(isEncryptedPassword(saved.password));
  assert.ok(await verifyPassword("nueva456", saved.password));
  assert.deepEqual((await call(authCtl.getMyPassword, { user })).payload, { password: "nueva456", legacy: false });

  assert.equal((await call(authCtl.updateCredentials, { user, body: { currentPassword: "nueva456", newPassword: "123" } })).status, 400);
});
