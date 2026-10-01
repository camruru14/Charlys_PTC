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
import { nextRouteCode, localDayKey, weekRangeKeys } from "../src/lib/routes.js";
import { assignRouteCodes, planRouteCodes } from "../scripts/assign-route-codes.js";
import ordersCtl from "../src/controller/ordersController.js";
import { migrateDeliveryRoutes } from "../scripts/migrate-delivery-routes.js";
import { closeMigratedRoutes } from "../scripts/close-migrated-routes.js";

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
  assert.match(r.payload.message, /Ruta R-\d{4}-0001/);

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

test("cierre de rutas migradas: recoge lo que falta, entrega con la fecha real y rellena deliveredAt", async () => {
  const departedAt = new Date("2026-08-14T21:17:11.143Z");
  const deliveredOn = new Date("2026-08-15T18:00:00.000Z");
  // Pendiente: una línea ya recogida y otra de Fabricación cuya recogida falta confirmar.
  const pending = await newOrder([
    packedAlmacen("Pajilla"),
    packedFabrica("Cajón"),
  ], "En Tránsito");
  pending.items[0].pickedUpAt = departedAt;
  pending.markModified("items");
  // Ya entregado sin delivery.deliveredAt (dato viejo), con su paso a «Entregado» en statusHistory.
  const old = await newOrder([packedAlmacen("Pelota")], "Entregado");
  old.statusHistory = [{ status: "Entregado", at: deliveredOn }];
  const route = await Route.create({
    number: 1,
    date: new Date("2026-08-14T00:00:00.000Z"),
    zone: "Sin zona",
    driver: driver._id,
    vehicle: "P123-456",
    orders: [pending._id, old._id],
    status: "En tránsito",
    departedAt,
    pickups: { almacen: { confirmedAt: departedAt } },
  });
  for (const o of [pending, old]) {
    o.delivery = { route: route._id, driver: driver._id, vehicle: "P123-456", dispatchStatus: "A tiempo" };
    await o.save();
  }

  const lines = [];
  let s = await closeMigratedRoutes([String(route._id)], { dryRun: true, log: (l) => lines.push(l) });
  assert.equal(s.closed, 1);
  assert.equal((await Route.findById(route._id)).status, "En tránsito", "dry-run no escribe");
  assert.ok(lines.some((l) => l.includes("Fabricación")), "muestra la recogida a confirmar");
  assert.ok(lines.some((l) => l.includes(`Entregar ${pending.orderNumber}`)));
  assert.ok(lines.some((l) => l.includes(`Rellenar delivery.deliveredAt de ${old.orderNumber}`)));

  s = await closeMigratedRoutes([String(route._id)], { log: () => {} });
  assert.equal(s.closed, 1);
  const after = await Route.findById(route._id);
  assert.equal(after.status, "Completada");
  assert.equal(after.completedAt.toISOString(), deliveredOn.toISOString(), "completedAt = la entrega más tardía (incluido el relleno)");
  assert.equal(after.pickups.fabricacion.confirmedAt.toISOString(), departedAt.toISOString());
  const p = await load(pending._id);
  assert.equal(p.status, "Entregado");
  assert.equal(p.delivery.deliveredAt.toISOString(), departedAt.toISOString());
  assert.ok(p.items.every((i) => i.deliveredAt));
  assert.equal((await load(old._id)).delivery.deliveredAt.toISOString(), deliveredOn.toISOString());

  s = await closeMigratedRoutes([String(route._id)], { log: () => {} });
  assert.equal(s.skipped, 1, "idempotente");
  assert.equal(s.closed, 0);
});

test("cierre de rutas migradas: no toca una ruta con líneas sin empacar", async () => {
  const order = await newOrder([packedAlmacen("Pajilla"), line("Vaso")], "En Tránsito");
  order.items[0].pickedUpAt = new Date();
  order.markModified("items");
  await order.save();
  const route = await Route.create({
    number: 1, date: new Date("2026-08-08T00:00:00.000Z"), zone: "Sin zona", driver: driver._id, vehicle: "P123-456",
    orders: [order._id], status: "En tránsito", departedAt: new Date(), pickups: { almacen: { confirmedAt: new Date() } },
  });
  const s = await closeMigratedRoutes([String(route._id)], { log: () => {} });
  assert.equal(s.blocked, 1);
  assert.equal((await Route.findById(route._id)).status, "En tránsito");
  assert.equal((await load(order._id)).status, "En Tránsito");
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

// --- Quitar un pedido de su ruta (solo antes de salir y de recoger su lugar) ---

async function routeWith(orders, { crew = true } = {}) {
  let r = await call(ctl.createRoute, { body: { zone: "Zona Centro" } });
  const id = String(r.payload._id);
  for (const o of orders) await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(o) } });
  if (crew) await call(ctl.updateRoute, { params: { id }, body: { driver: String(driver._id), vehicle: "P123-456" } });
  return id;
}
const remove = (id, order) => call(ctl.removeOrder, { params: { id, orderId: idOf(order) } });
const confirm = (id, location) => call(ctl.confirmPickup, { params: { id }, body: { location } });

test("quitar un pedido: ruta Pendiente (sin motorista) → 200 y el pedido queda sin ruta", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const id = await routeWith([a], { crew: false });
  assert.equal((await Route.findById(id)).status, "Pendiente");
  const r = await remove(id, a);
  assert.equal(r.status, 200);
  assert.equal(r.payload.orders.length, 0);
  assert.equal((await load(a._id)).delivery, undefined, "queda como estaba antes de asignarse");
  assert.equal((await load(a._id)).status, "Empacado");
});

test("quitar un pedido: ruta Recolectando sin recogidas confirmadas → 200; recalcula estado y conteos; vacía queda Pendiente", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const b = await newOrder([packedFabrica("Cajón")], "Empacado");
  const id = await routeWith([a, b]);
  assert.equal((await Route.findById(id)).status, "Recolectando");

  let r = await remove(id, a);
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "Recolectando", "todavía tiene un pedido");
  assert.deepEqual(r.payload.orders.map((o) => String(o._id)), [idOf(b)]);
  assert.equal((await load(a._id)).delivery, undefined);
  assert.equal(String((await load(b._id)).delivery.route), id, "el otro pedido sigue en la ruta");

  r = await remove(id, b);
  assert.equal(r.status, 200);
  assert.equal(r.payload.status, "Pendiente", "sin pedidos vuelve a Pendiente");
  assert.equal(r.payload.orders.length, 0);
  assert.ok(await Route.findById(id), "la ruta no se borra");
});

test("quitar un pedido: recogida de su lugar confirmada → 409; el de otro lugar sí se puede", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const b = await newOrder([packedFabrica("Cajón")], "Empacado");
  const id = await routeWith([a, b]);
  assert.equal((await confirm(id, "Almacén")).status, 200);

  let r = await remove(id, a);
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /Ya se confirmó la recolección de este pedido en Almacén; no se puede quitar/);
  assert.equal(String((await load(a._id)).delivery.route), id, "sigue en la ruta");

  r = await remove(id, b);
  assert.equal(r.status, 200, "Fabricación todavía no se confirmó");
  assert.equal(r.payload.pickups.almacen.confirmedAt !== undefined, true, "la recogida de Almacén sigue confirmada");
});

test("quitar un pedido con productos en Almacén y Fabricación: con una sola recogida confirmada → 409", async () => {
  const a = await newOrder([packedAlmacen("Pajilla"), packedFabrica("Cajón")], "Empacado");
  const id = await routeWith([a]);
  assert.equal((await confirm(id, "Fabricación")).status, 200);
  const r = await remove(id, a);
  assert.equal(r.status, 409);
  assert.match(r.payload.message, /en Fabricación; no se puede quitar/);
  assert.ok(await load(a._id).then((o) => o.delivery?.route), "sigue en la ruta");
});

test("quitar un pedido: ruta que ya salió → 409 «La ruta ya salió»", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const id = await routeWith([a]);
  await confirm(id, "Almacén");
  assert.equal((await call(ctl.depart, { params: { id } })).status, 200);
  const r = await remove(id, a);
  assert.equal(r.status, 409);
  assert.equal(r.payload.message, "La ruta ya salió");
});

test("quitar un pedido que no está en la ruta → 409", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const b = await newOrder([packedAlmacen("Pelota")], "Empacado");
  const id = await routeWith([a]);
  const r = await remove(id, b);
  assert.equal(r.status, 409);
});

test("agregar y deshacer: agregar a una ruta con la recogida confirmada la reabre, así que quitarlo enseguida se puede", async () => {
  const a = await newOrder([packedAlmacen("Pajilla")], "Empacado");
  const id = await routeWith([a]);
  await confirm(id, "Almacén");
  const b = await newOrder([packedAlmacen("Pelota")], "Empacado");
  let r = await call(ctl.addOrder, { params: { id }, body: { orderId: idOf(b) } });
  assert.equal(r.payload.pickups.almacen.confirmedAt, undefined);
  r = await remove(id, b);
  assert.equal(r.status, 200);
});

// --- Código único, listado por rango y disponibilidad sin día --------------------

const YEAR = localDayKey().slice(0, 4);
const day = (key, hour = 12) => new Date(`${key}T${String(hour + 6).padStart(2, "0")}:00:00.000Z`); // hora de El Salvador (UTC−6)
const shiftDay = (key, n) => new Date(Date.parse(`${key}T00:00:00.000Z`) + n * 86400000).toISOString().slice(0, 10);
const dateOnly = (key) => new Date(`${key}T00:00:00.000Z`); // Route.date: medianoche UTC del día local
const makeRoute = (fields) => Route.create({ zone: "Zona", date: dateOnly(localDayKey()), ...fields });

test("código de ruta: R-AAAA-NNNN consecutivo, sin reiniciar cada día", async () => {
  let r = await call(ctl.createRoute, { body: { zone: "A" } });
  assert.equal(r.payload.code, `R-${YEAR}-0001`);
  // Pasa un día: la ruta de «ayer» no reinicia el consecutivo.
  await Route.updateOne({ _id: r.payload._id }, { date: day(shiftDay(localDayKey(), -1), 0) });
  r = await call(ctl.createRoute, { body: { zone: "B" } });
  assert.equal(r.payload.code, `R-${YEAR}-0002`);
  r = await call(ctl.createRoute, { body: { zone: "C" } });
  assert.equal(r.payload.code, `R-${YEAR}-0003`);
  assert.deepEqual((await Route.find().sort({ code: 1 })).map((x) => x.code), [`R-${YEAR}-0001`, `R-${YEAR}-0002`, `R-${YEAR}-0003`]);
});

test("código de ruta: empieza en 0001 al cambiar de año y pasa de 9999 sin romper el orden", async () => {
  await makeRoute({ code: "R-2025-0007", number: 7 });
  assert.equal((await nextRouteCode(null, "2026")).code, "R-2026-0001");
  assert.equal((await nextRouteCode(null, "2025")).code, "R-2025-0008");
  await makeRoute({ code: "R-2026-9999", number: 9999 });
  assert.equal((await nextRouteCode(null, "2026")).code, "R-2026-10000");
  await makeRoute({ code: "R-2026-10000", number: 10000 });
  assert.equal((await nextRouteCode(null, "2026")).code, "R-2026-10001");
});

test("código de ruta: rutas creadas al mismo tiempo reciben códigos distintos", async () => {
  const results = await Promise.all([1, 2, 3, 4].map((n) => call(ctl.createRoute, { body: { zone: `Z${n}` } })));
  assert.ok(results.every((r) => r.status === 201), results.map((r) => r.status).join(","));
  const codes = results.map((r) => r.payload.code).sort();
  assert.equal(new Set(codes).size, 4);
  assert.deepEqual(codes, [1, 2, 3, 4].map((n) => `R-${YEAR}-000${n}`));
});

test("GET /routes: las activas salen siempre; las completadas solo dentro del rango", async () => {
  const today = localDayKey();
  const { from } = weekRangeKeys();
  const lastWeekDay = shiftDay(from, -3);
  const lastWeek = { from: shiftDay(from, -7), to: shiftDay(from, -1) };
  await makeRoute({ code: `R-${YEAR}-0101`, date: dateOnly(shiftDay(today, -1)), status: "Pendiente" });
  await makeRoute({ code: `R-${YEAR}-0102`, date: dateOnly(shiftDay(today, -20)), status: "En tránsito", departedAt: day(shiftDay(today, -20)) });
  await makeRoute({ code: `R-${YEAR}-0103`, date: dateOnly(today), status: "Completada", completedAt: new Date() });
  await makeRoute({ code: `R-${YEAR}-0104`, date: dateOnly(lastWeekDay), status: "Completada", completedAt: day(lastWeekDay) });
  await makeRoute({ code: `R-${YEAR}-0105`, date: dateOnly(lastWeekDay), status: "Completada" }); // sin completedAt: usa su date
  const codesOf = async (query) => (await call(ctl.getRoutes, { query })).payload.map((r) => r.code).sort();

  // Esta semana (por defecto): activas + completada de esta semana.
  assert.deepEqual(await codesOf({}), [`R-${YEAR}-0101`, `R-${YEAR}-0102`, `R-${YEAR}-0103`]);
  // Semana pasada: activas + las completadas de esa semana (también la que no tiene completedAt, por su date).
  assert.deepEqual(await codesOf(lastWeek), [`R-${YEAR}-0101`, `R-${YEAR}-0102`, `R-${YEAR}-0104`, `R-${YEAR}-0105`]);
  // Un rango cualquiera, incluso lejano: la Pendiente de ayer sigue saliendo.
  assert.deepEqual(await codesOf({ from: "2020-01-01", to: "2020-01-02" }), [`R-${YEAR}-0101`, `R-${YEAR}-0102`]);
  // Compatibilidad: ?date= equivale a from=to=date.
  assert.deepEqual(await codesOf({ date: lastWeekDay }), [`R-${YEAR}-0101`, `R-${YEAR}-0102`, `R-${YEAR}-0104`, `R-${YEAR}-0105`]);
  // Rango inválido.
  assert.equal((await call(ctl.getRoutes, { query: { from: today, to: shiftDay(today, -3) } })).status, 400);
  assert.equal((await call(ctl.getRoutes, { query: { from: "mañana" } })).status, 400);
});

test("«esta semana» es del lunes a hoy (como en Finanzas)", () => {
  // miércoles 30 sep 2026 → lunes 28 sep; domingo 4 oct 2026 → lunes 28 sep; lunes 5 oct → él mismo.
  assert.deepEqual(weekRangeKeys(new Date("2026-09-30T18:00:00Z")), { from: "2026-09-28", to: "2026-09-30" });
  assert.deepEqual(weekRangeKeys(new Date("2026-10-04T18:00:00Z")), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(weekRangeKeys(new Date("2026-10-05T18:00:00Z")), { from: "2026-10-05", to: "2026-10-05" });
  // De noche en UTC todavía es el día anterior en El Salvador.
  assert.deepEqual(weekRangeKeys(new Date("2026-10-05T03:00:00Z")), { from: "2026-09-28", to: "2026-10-04" });
});

test("disponibilidad sin día: motorista y placa con una ruta activa de ayer siguen ocupados; al completarla, libres", async () => {
  const ayer = day(shiftDay(localDayKey(), -1), 0);
  const old = await makeRoute({ code: `R-${YEAR}-0201`, date: ayer, status: "Recolectando", driver: driver._id, vehicle: "P123-456" });

  let r = await call(ctl.getAvailability, { query: { date: "1999-01-01" } }); // ?date= se ignora
  const mario = r.payload.drivers.find((d) => d.name === "Mario");
  assert.equal(mario.busy, true, "ocupado por la ruta activa de ayer");
  assert.equal(mario.route.code, `R-${YEAR}-0201`);
  assert.equal(r.payload.vehicles.find((v) => v.plate === "P123-456").busy, true);
  assert.equal(r.payload.vehicles.find((v) => v.plate === "C987-654").busy, false);

  // No se puede asignar a otra ruta de hoy.
  const created = await call(ctl.createRoute, { body: { zone: "Hoy" } });
  const id = String(created.payload._id);
  r = await call(ctl.updateRoute, { params: { id }, body: { driver: String(driver._id) } });
  assert.equal(r.status, 409);
  assert.match(r.payload.message, new RegExp(`R-${YEAR}-0201`));
  r = await call(ctl.updateRoute, { params: { id }, body: { vehicle: "P123-456" } });
  assert.equal(r.status, 409);

  // Al completarse la ruta quedan libres y ya se pueden asignar.
  await Route.updateOne({ _id: old._id }, { status: "Completada", completedAt: new Date() });
  r = await call(ctl.getAvailability, {});
  assert.equal(r.payload.drivers.find((d) => d.name === "Mario").busy, false);
  assert.equal(r.payload.vehicles.find((v) => v.plate === "P123-456").busy, false);
  r = await call(ctl.updateRoute, { params: { id }, body: { driver: String(driver._id), vehicle: "P123-456" } });
  assert.equal(r.status, 200);
});

test("asignar códigos: rutas viejas por orden cronológico, continúa el consecutivo, respalda y es idempotente", async () => {
  const mk = (number, daysAgo, extra = {}) =>
    Route.collection.insertOne({ zone: "Z", number, status: "Completada", date: dateOnly(shiftDay(localDayKey(), -daysAgo)), createdAt: day(shiftDay(localDayKey(), -daysAgo)), updatedAt: new Date(), orders: [], deliveries: [], pickups: {}, ...extra });
  await mk(1, 3);
  await mk(1, 2); // mismo número otro día: el caso que repetía
  await mk(2, 2);
  await mk(1, 1, { code: `R-${YEAR}-0005` }); // ya tiene código
  const quiet = { log: () => {} };
  const db = mongoose.connection.db;
  const backups = [];
  const fs = await import("node:fs");

  let summary = await assignRouteCodes(db, { dryRun: true, ...quiet });
  assert.equal(summary.assigned, 3);
  assert.equal(await Route.countDocuments({ code: { $exists: true } }), 1, "--dry-run no escribe");

  summary = await assignRouteCodes(db, { dryRun: false, ...quiet });
  assert.equal(summary.assigned, 3);
  assert.ok(summary.backupDir && fs.existsSync(summary.backupDir + "/routes.json") && fs.existsSync(summary.backupDir + "/manifest.json"), "respaldo de routes");
  backups.push(summary.backupDir);
  const codes = (await Route.find().sort({ createdAt: 1, number: 1 })).map((r) => r.code);
  assert.deepEqual(codes, [`R-${YEAR}-0006`, `R-${YEAR}-0007`, `R-${YEAR}-0008`, `R-${YEAR}-0005`]);
  const doc = await Route.collection.findOne({ code: `R-${YEAR}-0006` });
  assert.equal(doc.zone, "Z", "solo cambia code");
  assert.ok((await Route.collection.indexes()).some((i) => i.key?.code === 1 && i.unique), "índice único de code");

  summary = await assignRouteCodes(db, { dryRun: false, ...quiet });
  assert.equal(summary.assigned, 0, "idempotente");
  assert.equal(summary.backupDir, null, "sin cambios no respalda");
  for (const dir of backups) fs.rmSync(dir, { recursive: true, force: true });
});

test("asignar códigos: reinicia por año según createdAt, empata por _id y detecta duplicados", () => {
  const route = (id, createdAt, extra = {}) => ({ _id: id, zone: "Z", status: "Completada", date: new Date(createdAt), createdAt: new Date(createdAt), ...extra });
  const plan = planRouteCodes([
    route("b", "2025-12-30T20:00:00Z"),
    route("a", "2025-12-30T20:00:00Z"), // mismo instante: desempata por _id
    route("c", "2026-01-02T20:00:00Z"),
    route("d", "2026-01-03T20:00:00Z", { code: "R-2026-0009" }),
  ]);
  assert.deepEqual(plan.assignments.map((x) => [x._id, x.code]), [["a", "R-2025-0001"], ["b", "R-2025-0002"], ["c", "R-2026-0010"]]);
  assert.deepEqual(plan.problems, []);
  assert.ok(planRouteCodes([route("x", "2026-01-01T12:00:00Z", { code: "R-2026-0001" }), route("y", "2026-01-02T12:00:00Z", { code: "R-2026-0001" })]).problems.length > 0, "código repetido");
});
