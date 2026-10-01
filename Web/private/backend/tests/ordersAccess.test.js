// Acceso a los pedidos por HTTP (app.js completo) contra un MongoDB en memoria:
//  - el panel ya no crea ni edita pedidos (POST /api/orders y PUT /api/orders/:id → 404);
//  - eliminar un pedido es solo de administradores (403 si no);
//  - la sesión dice si el empleado es administrador (isAdmin).
//   npm test
import "./helpers/passwordKey.js";
process.env.JWT_Secret_key = "clave-de-prueba";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jsonwebtoken from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import Transaction from "../src/models/Transaction.js";
import Route from "../src/models/Route.js";
import CustomerOrder from "../src/models/CustomerOrder.js";
import Employee from "../src/models/Employee.js";
import { createStoreOrder } from "./helpers/storeOrder.js";

let replSet;
let server;
let base;
let admin;
let seller;
let inactiveAdmin;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test_access" });
  for (const m of [Order, Transaction, Route, CustomerOrder, Employee]) await m.createCollection();
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order, Transaction, Route, CustomerOrder, Employee].map((m) => m.deleteMany({})));
  [admin, seller, inactiveAdmin] = await Employee.create([
    { name: "Ada", lastName: "Gómez", email: "ada@charly.test", password: "x", department: "Administración", position: "Administradora" },
    { name: "Vera", lastName: "Soto", email: "vera@charly.test", password: "x", department: "Administración", position: "Ejecutiva de ventas" },
    { name: "Inés", lastName: "Paz", email: "ines@charly.test", password: "x", department: "Administración", position: "Gerente", isActive: false },
  ]);
});

const tokenOf = (employee) => jsonwebtoken.sign({ id: employee._id }, process.env.JWT_Secret_key);

async function request(method, path, employee, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(employee ? { Authorization: `Bearer ${tokenOf(employee)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const delivered = async () =>
  createStoreOrder({ items: [{ product: "Silla", color: "Verde", quantity: 2, unitPrice: 3, subtotal: 6 }], status: "Entregado" });

test("el panel ya no crea ni edita pedidos", async () => {
  const order = await delivered();
  const created = await request("POST", "/orders", admin, { customer: { name: "X" }, items: [], total: 0 });
  assert.equal(created.status, 404);
  const edited = await request("PUT", `/orders/${order._id}`, admin, { total: 1 });
  assert.equal(edited.status, 404);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal((await Order.findById(order._id)).total, 6, "el pedido no cambió");
  // Consultar sigue funcionando.
  const list = await request("GET", "/orders", seller);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal("paymentStatus" in list.body[0], false, "la API ya no trae estado de pago");
});

test("eliminar un pedido: sin sesión 403, empleado que no es administrador 403, administrador inactivo 403", async () => {
  const order = await delivered();
  assert.equal((await request("DELETE", `/orders/${order._id}`, null)).status, 403);
  const asSeller = await request("DELETE", `/orders/${order._id}`, seller);
  assert.equal(asSeller.status, 403);
  assert.equal(asSeller.body.message, "Solo un administrador puede hacer esto");
  assert.equal(asSeller.body.code, "ADMIN_ONLY", "los clientes lo distinguen de una sesión vencida");
  assert.equal((await request("DELETE", `/orders/${order._id}`, inactiveAdmin)).status, 403);
  assert.ok(await Order.findById(order._id), "el pedido sigue existiendo");
});

test("un administrador elimina un pedido entregado; uno que no está entregado da 409", async () => {
  const done = await delivered();
  const pending = await createStoreOrder({ items: [{ product: "Silla", quantity: 1, unitPrice: 1, subtotal: 1 }] });

  const blocked = await request("DELETE", `/orders/${pending._id}`, admin);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.message, "Solo se pueden eliminar pedidos entregados");

  const ok = await request("DELETE", `/orders/${done._id}`, admin);
  assert.equal(ok.status, 200);
  assert.equal(await Order.findById(done._id), null);
  const sale = await Transaction.findOne({ orderNumber: done.orderNumber });
  assert.ok(sale, "el Ingreso se conserva");
  assert.equal(sale.relatedOrder, undefined);
});

test("quien tiene el campo heredado role «admin» también es administrador", async () => {
  const legacy = await Employee.create({ name: "Leo", lastName: "Ruiz", email: "leo@charly.test", password: "x", department: "Finanzas" });
  await Employee.collection.updateOne({ _id: legacy._id }, { $set: { role: "admin" } });
  const order = await delivered();
  assert.equal((await request("DELETE", `/orders/${order._id}`, legacy)).status, 200);
});

test("la sesión (GET /auth/me) indica si es administrador", async () => {
  const asAdmin = await request("GET", "/auth/me", admin);
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.body.isAdmin, true);
  const asSeller = await request("GET", "/auth/me", seller);
  assert.equal(asSeller.body.isAdmin, false);
});
