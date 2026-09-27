// Pruebas de Configuración > Empresa (/settings/company) contra un MongoDB en
// memoria. Nunca tocan la base real. La subida del logo a Cloudinary no se
// prueba aquí (sale a la red); solo que sin archivo responde 400.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import CompanySettings from "../src/models/CompanySettings.js";
import WorkSchedule from "../src/models/WorkSchedule.js";
import ctl from "../src/controller/settingsController.js";

let server;

before(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: "charly_test_settings" });
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

beforeEach(async () => {
  await Promise.all([CompanySettings.deleteMany({}), WorkSchedule.deleteMany({})]);
});

async function call(handler, { body = {}, file } = {}) {
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
  await handler({ params: {}, body, query: {}, file }, res);
  return { status, payload };
}

test("sin ficha guardada responde los valores por defecto y no escribe nada", async () => {
  const { status, payload } = await call(ctl.getCompany);
  assert.equal(status, 200);
  assert.equal(payload.name, "Industrias Charly");
  assert.equal(payload.currency, "USD");
  assert.equal(payload.nit, "");
  assert.equal(payload.logoUrl, null);
  assert.equal(payload.updatedAt, null);
  assert.equal(await CompanySettings.countDocuments(), 0);
});

test("guardar crea un solo documento, limpia espacios y marca updatedAt", async () => {
  const body = { name: "  Industrias Charly S.A. ", nit: "0614-010101-101-1", email: "Ventas@Charly.com", phone: "2222-2222", address: "San Salvador" };
  const first = await call(ctl.updateCompany, { body });
  assert.equal(first.status, 200);
  assert.equal(first.payload.name, "Industrias Charly S.A.");
  assert.equal(first.payload.email, "ventas@charly.com");
  assert.ok(first.payload.updatedAt);

  await call(ctl.updateCompany, { body: { ...body, phone: "7777-7777" } });
  assert.equal(await CompanySettings.countDocuments(), 1);
  const { payload } = await call(ctl.getCompany);
  assert.equal(payload.phone, "7777-7777");
  assert.equal(payload.nit, "0614-010101-101-1");
});

test("la moneda no se puede cambiar desde el panel", async () => {
  const { payload } = await call(ctl.updateCompany, { body: { name: "Charly", currency: "EUR" } });
  assert.equal(payload.currency, "USD");
});

test("rechaza nombre vacío y correo inválido", async () => {
  assert.equal((await call(ctl.updateCompany, { body: { name: "   " } })).status, 400);
  assert.equal((await call(ctl.updateCompany, { body: { name: "Charly", email: "no-es-correo" } })).status, 400);
  assert.equal(await CompanySettings.countDocuments(), 0);
});

test("guardar la empresa no toca el horario laboral", async () => {
  await call(ctl.updateWorkSchedule, { body: { startTime: "06:30", workdayHours: 9 } });
  await call(ctl.updateCompany, { body: { name: "Charly" } });
  const { payload } = await call(ctl.getWorkSchedule);
  assert.deepEqual(payload, { startTime: "06:30", workdayHours: 9 });
});

test("subir logo sin archivo responde 400", async () => {
  const { status } = await call(ctl.updateLogo);
  assert.equal(status, 400);
});
