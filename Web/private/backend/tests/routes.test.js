// Pruebas de las rutas de Logística (Fase 7) contra un MongoDB en memoria
// (replica set, para poder usar transacciones). Nunca tocan la base real.
//   npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../src/models/Order.js";
import Route from "../src/models/Route.js";
import Employee from "../src/models/Employee.js";
import Vehicle from "../src/models/Vehicle.js";
import ctl from "../src/controller/routesController.js";
import ordersCtl from "../src/controller/ordersController.js";
import { migrateDeliveryRoutes } from "../scripts/migrate-delivery-routes.js";

let replSet;
let driver;
let otherDriver;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replSet.getUri(), { dbName: "charly_test_routes" });
  for (const m of [Order, Route, Employee, Vehicle]) await m.createCollection();
  await Route.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Route.deleteMany({}), Employee.deleteMany({}), Vehicle.deleteMany({})]);
  [driver, otherDriver] = await Employee.create([
    { name: "Mario", lastName: "Pérez", email: "mario@charly.test", password: "x", department: "Logística" },
    { name: "Ana", lastName: "Ruiz", email: "ana@charly.test", password: "x", department: "Fabricación" },
  ]);
  await Vehicle.create([{ plate: "P123-456" }, { plate: "C987-654" }]);
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
  return { status, payload };
}

const line = (product, extra = {}) => ({ product, color: "Azul", quantity: 10, unitPrice: 1, subtotal: 10, ...extra });
let seq = 0;
async function newOrder(items, status = "Procesando") {
  seq += 1;
  return Order.create({
    orderNumber: `ORD-T-${seq}`,
    customer: { name: `Cliente ${seq}`, address: "San Salvador" },
    items,
    total: 10 * items.length,
    status,
  });
}
const packedAlmacen = (p) => line(p, { verified: true, packed: true, packedLocation: "Almacén" });
const packedFabrica = (p) => line(p, { verified: true, packed: true, packedLocation: "Fabricación" });
const load = (id) => Order.findById(id);
const idOf = (doc) => String(doc._id);

test("ciclo completo: crear, 2 pedidos, recoger, salir, entregar completo y parcial, deshacer", async () => {
  // A: una línea de Almacén y otra de Fabricación, todo empacado (entrega completa).
  const a = await newOrder([packedAlmacen("Pajilla"), packedFabrica("Cajón")], "Empacado");
  // B: una línea empacada en Almacén y otra sin empacar (entrega parcial).
  const b = await newOrder([packedAlmacen("Pelota"), line("Vaso")]);

  let r = await call(ctl.createRoute, { body: { zone: "Zona Norte" } });
  assert.equal(r.status, 201);
  const route = r.payload;
  assert.equal(route.number, 1);
  assert.equal(route.status, "Pendiente");
  const id = String(route._id);

  r = await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(a) } });
  assert.equal(r.payload.status, "Pendiente", "sin motorista ni vehículo sigue Pendiente");
  r = await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(b) } });
  assert.equal(r.payload.orders.length, 2);

  r = await call(ctl.updateRoute, { params: { id }, body: { driver: String(otherDriver._id) } });
  assert.equal(r.status, 400, "el motorista debe ser del área Logística");
  r = await call(ctl.updateRoute, { params: { id }, body: { driver: String(driver._id), vehicle: "P123-456" } });
  assert.equal(r.payload.status, "Recolectando");
  assert.equal(String((await load(a._id)).delivery.driver), String(driver._id), "el pedido copia el motorista");
  assert.equal((await load(b._id)).delivery.vehicle, "P123-456");

  r = await call(ctl.depart, { params: { id } });
  assert.equal(r.status, 409, "no sale sin confirmar recogidas");

  r = await call(ctl.confirmPickup, { params: { id }, body: { location: "Almacén" } });
  assert.equal(r.status, 200);
  let oa = await load(a._id);
  assert.ok(oa.delivery.pickupWarehouseAt);
  assert.ok(oa.items[0].pickedUpAt, "la línea de Almacén queda recogida");
  assert.equal(oa.items[1].pickedUpAt, undefined, "la de Fabricación todavía no");

  r = await call(ctl.confirmPickup, { params: { id }, body: { location: "Fabricación" } });
  assert.equal(r.status, 200);
  assert.ok((await load(a._id)).items[1].pickedUpAt);

  r = await call(ctl.depart, { params: { id } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "En tránsito");
  oa = await load(a._id);
  assert.equal(oa.status, "En Tránsito");
  assert.equal(oa.delivery.dispatchStatus, "A tiempo");
  assert.equal(oa.statusHistory.at(-1).status, "En Tránsito");

  r = await call(ctl.updateRoute, { params: { id }, body: { vehicle: "C987-654" } });
  assert.equal(r.status, 409, "después de salir no se cambia el vehículo");
  const late = await newOrder([packedAlmacen("Plato")]);
  r = await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(late) } });
  assert.equal(r.status, 409, "después de salir no se agregan pedidos");

  // Entrega completa de A.
  r = await call(ctl.deliverOrder, { params: { id, orderId: idOf(a) } });
  assert.equal(r.status, 200);
  oa = await load(a._id);
  assert.equal(oa.status, "Entregado");
  assert.ok(oa.delivery.deliveredAt);
  assert.ok(oa.items.every((i) => i.deliveredAt));
  assert.equal(r.payload.status, "En tránsito", "falta B");

  // Entrega parcial de B: sale de la ruta con lo pendiente y la ruta se completa.
  r = await call(ctl.deliverOrder, { params: { id, orderId: idOf(b) } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "Completada");
  assert.ok(r.payload.completedAt);
  assert.equal(r.payload.orders.length, 1);
  let ob = await load(b._id);
  assert.ok(ob.items[0].deliveredAt);
  assert.equal(ob.items[1].deliveredAt, undefined);
  assert.equal(ob.delivery, undefined, "B queda disponible para despacho");
  assert.notEqual(ob.status, "Entregado");

  // Deshacer la entrega parcial: B vuelve a la ruta y la ruta a En tránsito.
  r = await call(ctl.undeliverOrder, { params: { id, orderId: idOf(b) } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "En tránsito");
  assert.equal(r.payload.completedAt, undefined);
  assert.deepEqual(r.payload.orders.map((o) => String(o._id)), [idOf(a), idOf(b)]);
  ob = await load(b._id);
  assert.equal(ob.status, "En Tránsito");
  assert.equal(String(ob.delivery.route), id);
  assert.equal(ob.items[0].deliveredAt, undefined);

  // Deshacer la entrega completa de A.
  r = await call(ctl.undeliverOrder, { params: { id, orderId: idOf(a) } });
  assert.equal(r.status, 200);
  oa = await load(a._id);
  assert.equal(oa.status, "En Tránsito");
  assert.equal(oa.delivery.deliveredAt, undefined);

  // Entregar de un día anterior no se deshace.
  await call(ctl.deliverOrder, { params: { id, orderId: idOf(a) } });
  await Route.updateOne({ _id: id }, { $set: { "deliveries.0.at": new Date(Date.now() - 3 * 86400000) } });
  r = await call(ctl.undeliverOrder, { params: { id, orderId: idOf(a) } });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /mismo día/);
});

test("validaciones: pedidos, motorista y vehículo ocupados, eliminar", async () => {
  const unpacked = await newOrder([line("Vaso")]);
  const packed = await newOrder([packedAlmacen("Pajilla")]);

  const r1 = (await call(ctl.createRoute, { body: { zone: "Zona Norte", driver: String(driver._id), vehicle: "P123-456" } })).payload;
  const r2 = (await call(ctl.createRoute, { body: { zone: "Zona Sur" } })).payload;
  assert.equal(r2.number, 2, "correlativo por día");

  let r = await call(ctl.createRoute, { body: { zone: "  " } });
  assert.equal(r.status, 400, "la zona es obligatoria");

  r = await call(ctl.addOrder, { params: { id: String(r1._id) }, body: { orderId: idOf(unpacked) } });
  assert.equal(r.status, 409, "sin líneas empacadas no entra");

  r = await call(ctl.addOrder, { params: { id: String(r1._id) }, body: { orderId: idOf(packed) } });
  assert.equal(r.status, 200);
  r = await call(ctl.addOrder, { params: { id: String(r2._id) }, body: { orderId: idOf(packed) } });
  assert.equal(r.status, 409, "no puede estar en dos rutas activas");
  assert.match(r.payload.message, /Ruta 1/);

  r = await call(ctl.updateRoute, { params: { id: String(r2._id) }, body: { driver: String(driver._id) } });
  assert.equal(r.status, 409, "motorista ocupado en otra ruta del día");
  r = await call(ctl.updateRoute, { params: { id: String(r2._id) }, body: { vehicle: "P123-456" } });
  assert.equal(r.status, 409, "vehículo ocupado en otra ruta del día");

  r = await call(ctl.getAvailability, { query: {} });
  const mario = r.payload.drivers.find((d) => d.name === "Mario");
  assert.equal(mario.busy, true);
  assert.equal(mario.route.number, 1);
  assert.equal(r.payload.drivers.length, 1, "solo empleados activos de Logística");
  assert.equal(r.payload.vehicles.find((v) => v.plate === "C987-654").busy, false);

  // Editar el pedido desde Pedidos no lo saca de la ruta.
  r = await call(ordersCtl.updateStatus, { params: { id: idOf(packed) }, body: { status: "Procesando" } });
  assert.equal(String((await load(packed._id)).delivery.route), String(r1._id));

  r = await call(ctl.deleteRoute, { params: { id: String(r1._id) } });
  assert.equal(r.status, 409, "no se elimina con pedidos");
  r = await call(ctl.removeOrder, { params: { id: String(r1._id), orderId: idOf(packed) } });
  assert.equal(r.status, 200);
  assert.equal((await load(packed._id)).delivery, undefined);
  r = await call(ctl.deleteRoute, { params: { id: String(r1._id) } });
  assert.equal(r.status, 200);

  r = await call(ctl.getRoutes, { query: {} });
  assert.deepEqual(r.payload.map((x) => x.number), [2]);
});

test("migración: agrupa por día, motorista y vehículo, y es idempotente", async () => {
  const day = new Date();
  const base = { driver: driver._id, vehicle: "P123-456" };
  const delivered = await newOrder([packedAlmacen("Pajilla")], "Entregado");
  delivered.delivery = { ...base, dispatchStatus: "Entregado", dispatchedAt: day };
  await delivered.save();
  const transit = await newOrder([packedAlmacen("Pelota")], "En Tránsito");
  transit.delivery = { ...base, dispatchStatus: "A tiempo", dispatchedAt: day, pickupWarehouseAt: day };
  await transit.save();
  const waiting = await newOrder([packedFabrica("Cajón")], "Empacado");
  waiting.delivery = { driver: driver._id, vehicle: "C987-654", dispatchStatus: "Saliendo" };
  await waiting.save();

  let summary = await migrateDeliveryRoutes({ log: () => {} });
  assert.equal(summary.created, 2);
  assert.deepEqual(summary.byStatus, { "En tránsito": 1, Recolectando: 1 });
  const routes = await Route.find().sort({ number: 1 });
  assert.deepEqual(routes.map((r) => r.number), [1, 2]);
  const inTransit = routes.find((r) => r.status === "En tránsito");
  assert.equal(inTransit.orders.length, 2);
  assert.equal(inTransit.deliveries.length, 1, "el entregado queda registrado");
  assert.ok((await load(transit._id)).items[0].pickedUpAt, "lo que ya salió queda recogido");
  assert.equal(String((await load(waiting._id)).delivery.route), String(routes.find((r) => r.status === "Recolectando")._id));

  // La ruta migrada funciona: se entrega lo que faltaba y se completa.
  const r = await call(ctl.deliverOrder, { params: { id: String(inTransit._id), orderId: idOf(transit) } });
  assert.equal(r.payload.status, "Completada");

  summary = await migrateDeliveryRoutes({ log: () => {} });
  assert.equal(summary.created, 0, "idempotente");
  assert.equal(await Route.countDocuments(), 2);
});

test("un pedido agregado después de una recogida la vuelve a dejar pendiente", async () => {
  const first = await newOrder([packedAlmacen("Pajilla")]);
  const second = await newOrder([packedAlmacen("Pelota")]);
  const route = (await call(ctl.createRoute, { body: { zone: "Centro", driver: String(driver._id), vehicle: "P123-456" } })).payload;
  const id = String(route._id);
  await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(first) } });
  await call(ctl.confirmPickup, { params: { id }, body: { location: "Almacén" } });

  let r = await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(second) } });
  assert.equal(r.payload.pickups.almacen.confirmedAt, undefined);
  r = await call(ctl.depart, { params: { id } });
  assert.equal(r.status, 409);
  await call(ctl.confirmPickup, { params: { id }, body: { location: "Almacén" } });
  assert.ok((await load(second._id)).items[0].pickedUpAt);
  r = await call(ctl.confirmPickup, { params: { id }, body: { location: "Fabricación" } });
  assert.equal(r.status, 409, "no hay nada que recoger en Fabricación");
  r = await call(ctl.depart, { params: { id } });
  assert.equal(r.status, 200);
});
