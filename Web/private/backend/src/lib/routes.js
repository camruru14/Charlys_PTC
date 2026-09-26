import mongoose from "mongoose";
import routeModel from "../models/Route.js";
import orderModel from "../models/Order.js";
import employeeModel from "../models/Employee.js";
import vehicleModel from "../models/Vehicle.js";
import { HttpError } from "./stock.js";
import { setOrderStatus, computeOrderStatus } from "./orderStatus.js";

/*
  Rutas de Logística (Fase 7). Cada función corre dentro de una transacción
  (recibe la `session`), valida el estado de la ruta y de sus pedidos, y
  guarda ruta y pedidos. El estado de la ruta se recalcula en cada cambio.
*/

const TZ = "America/El_Salvador";
const PICKUP_KEY = { "Almacén": "almacen", "Fabricación": "fabricacion" };
const ORDER_PICKUP_FIELD = { "Almacén": "pickupWarehouseAt", "Fabricación": "pickupFactoryAt" };

// Día (YYYY-MM-DD) de una fecha en hora de El Salvador.
export function localDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// "YYYY-MM-DD" (o hoy) -> Date a medianoche UTC, como se guarda Route.date.
export function parseDay(value) {
  const key = value || localDayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new HttpError(400, "Fecha inválida: usa AAAA-MM-DD");
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Fecha inválida: usa AAAA-MM-DD");
  return date;
}

const isSplit = (item) => item.fromStockQty != null && item.toManufactureQty != null;

// Línea que la ruta puede llevar: empacada por completo y sin entregar.
const isCarriable = (item) => Boolean(item.packed && !item.deliveredAt);

// Ubicaciones donde se recoge una línea empacada (dividida: las dos).
export function itemLocations(item) {
  if (!item.packed) return [];
  if (isSplit(item)) return ["Almacén", "Fabricación"];
  return item.packedLocation ? [item.packedLocation] : [];
}

// Recogidas que requiere un pedido / una ruta (según sus líneas por llevar).
export function orderPickups(order) {
  const set = new Set();
  (order.items || []).filter(isCarriable).forEach((i) => itemLocations(i).forEach((l) => set.add(l)));
  return ["Almacén", "Fabricación"].filter((l) => set.has(l));
}

export function requiredPickups(orders) {
  const set = new Set(orders.flatMap(orderPickups));
  return ["Almacén", "Fabricación"].filter((l) => set.has(l));
}

export const isConfirmed = (route, location) => Boolean(route.pickups?.[PICKUP_KEY[location]]?.confirmedAt);

export const isOrderDelivered = (order) => order.status === "Entregado" || Boolean(order.delivery?.deliveredAt);

// Estado de la ruta a partir de sus datos y de sus pedidos (en `orders`).
export function computeRouteStatus(route, orders) {
  if (route.departedAt) {
    const done = orders.length === 0 ? route.deliveries.length > 0 : orders.every(isOrderDelivered);
    return done ? "Completada" : "En tránsito";
  }
  if (route.driver && route.vehicle && route.orders.length > 0) return "Recolectando";
  return "Pendiente";
}

// `at`: fecha para completedAt si la ruta queda Completada (por defecto, ahora).
function applyRouteStatus(route, orders, at = new Date()) {
  route.status = computeRouteStatus(route, orders);
  if (route.status === "Completada") route.completedAt = route.completedAt || at;
  else route.completedAt = undefined;
}

function routeLabel(route) {
  return `la Ruta ${route.number} (${route.zone})`;
}

export async function loadRoute(id, session) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Ruta no encontrada");
  const route = await routeModel.findById(id).session(session);
  if (!route) throw new HttpError(404, "Ruta no encontrada");
  return route;
}

// Pedidos de la ruta en su orden de entrega.
async function loadRouteOrders(route, session) {
  const docs = await orderModel.find({ _id: { $in: route.orders } }).session(session);
  const byId = new Map(docs.map((o) => [String(o._id), o]));
  return route.orders.map((id) => byId.get(String(id))).filter(Boolean);
}

async function loadOrder(id, session) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Pedido no encontrado");
  const order = await orderModel.findById(id).session(session);
  if (!order) throw new HttpError(404, "Pedido no encontrado");
  return order;
}

function setDelivery(order, fields) {
  const current = order.delivery ? order.delivery.toObject() : {};
  order.delivery = { ...current, ...fields };
  order.markModified("delivery");
}

// Copia motorista, vehículo y ruta al pedido.
function syncOrder(order, route) {
  setDelivery(order, { route: route._id, driver: route.driver || undefined, vehicle: route.vehicle || undefined });
}

// Motorista válido (activo, área Logística) y libre ese día; vehículo de
// Configuración y libre ese día. Libre = no está en otra ruta del mismo día
// que no esté Completada.
async function assertDriver(route, driverId, session) {
  if (!mongoose.isValidObjectId(driverId)) throw new HttpError(400, "Motorista inválido");
  const driver = await employeeModel.findById(driverId).session(session);
  if (!driver || !driver.isActive || driver.department !== "Logística") {
    throw new HttpError(400, "El motorista debe ser un empleado activo del área Logística");
  }
  const other = await routeModel
    .findOne({ _id: { $ne: route._id }, date: route.date, status: { $ne: "Completada" }, driver: driver._id })
    .session(session);
  if (other) throw new HttpError(409, `${driver.name} ${driver.lastName} ya va en ${routeLabel(other)}`);
  return driver;
}

async function assertVehicle(route, plate, session) {
  const vehicle = await vehicleModel.findOne({ plate }).session(session);
  if (!vehicle) throw new HttpError(400, `El vehículo ${plate} no está en Configuración > Vehículos`);
  const other = await routeModel
    .findOne({ _id: { $ne: route._id }, date: route.date, status: { $ne: "Completada" }, vehicle: plate })
    .session(session);
  if (other) throw new HttpError(409, `El vehículo ${plate} ya va en ${routeLabel(other)}`);
}

// Asigna motorista/vehículo si llegan en `fields` ("" o null los quita).
async function applyCrew(route, fields, session) {
  if ("driver" in fields) {
    if (fields.driver) {
      await assertDriver(route, fields.driver, session);
      route.driver = fields.driver;
    } else {
      route.driver = undefined;
    }
  }
  if ("vehicle" in fields) {
    const plate = typeof fields.vehicle === "string" ? fields.vehicle.trim() : fields.vehicle;
    if (plate) {
      await assertVehicle(route, plate, session);
      route.vehicle = plate;
    } else {
      route.vehicle = undefined;
    }
  }
}

function pick(body, keys) {
  return Object.fromEntries(keys.filter((k) => body && Object.prototype.hasOwnProperty.call(body, k)).map((k) => [k, body[k]]));
}

// --- Acciones -----------------------------------------------------------------

export async function createRoute(body, session) {
  const zone = typeof body?.zone === "string" ? body.zone.trim() : "";
  if (!zone) throw new HttpError(400, "Escribe la zona de la ruta");
  const date = parseDay();
  const last = await routeModel.findOne({ date }).sort({ number: -1 }).session(session);
  const route = new routeModel({ number: (last?.number || 0) + 1, date, zone });
  await applyCrew(route, pick(body, ["driver", "vehicle"]), session);
  applyRouteStatus(route, []);
  await route.save({ session });
  return route;
}

export async function updateRoute(id, body, session) {
  const route = await loadRoute(id, session);
  if (route.status === "Completada") throw new HttpError(409, `${routeLabel(route)} ya se completó`);
  const fields = pick(body, ["zone", "driver", "vehicle", "delayed"]);

  if ("zone" in fields) {
    const zone = typeof fields.zone === "string" ? fields.zone.trim() : "";
    if (!zone) throw new HttpError(400, "Escribe la zona de la ruta");
    route.zone = zone;
  }
  if (("driver" in fields || "vehicle" in fields) && route.departedAt) {
    throw new HttpError(409, "La ruta ya salió: no se cambia el motorista ni el vehículo");
  }
  await applyCrew(route, fields, session);

  const orders = await loadRouteOrders(route, session);
  if ("delayed" in fields) route.delayed = Boolean(fields.delayed);
  for (const order of orders) {
    syncOrder(order, route);
    if (route.departedAt && !isOrderDelivered(order)) {
      setDelivery(order, { dispatchStatus: route.delayed ? "Demorado" : "A tiempo" });
    }
    await order.save({ session });
  }
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

export async function deleteRoute(id, session) {
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeLabel(route)} ya salió; no se puede eliminar`);
  if (route.orders.length || route.deliveries.length) {
    throw new HttpError(409, `${routeLabel(route)} tiene pedidos; quítalos antes de eliminarla`);
  }
  await routeModel.deleteOne({ _id: route._id }, { session });
}

export async function addOrder(id, orderId, session) {
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeLabel(route)} ya salió; no se le agregan pedidos`);
  const order = await loadOrder(orderId, session);

  if (order.delivery?.route) {
    if (String(order.delivery.route) === String(route._id)) {
      throw new HttpError(409, `${order.orderNumber} ya está en ${routeLabel(route)}`);
    }
    const other = await routeModel.findById(order.delivery.route).session(session);
    if (other && other.status !== "Completada") throw new HttpError(409, `${order.orderNumber} ya está en ${routeLabel(other)}`);
  }
  if (order.status === "Entregado") throw new HttpError(409, `${order.orderNumber} ya se entregó`);
  if (order.status === "En Tránsito") throw new HttpError(409, `${order.orderNumber} ya está en tránsito`);
  if (!(order.items || []).some(isCarriable)) {
    throw new HttpError(409, `${order.orderNumber} no tiene productos empacados por despachar`);
  }

  route.orders.push(order._id);
  // Si el pedido necesita una recogida ya confirmada, esa recogida vuelve a
  // quedar pendiente: sus líneas todavía no se recogieron.
  for (const location of orderPickups(order)) {
    if (isConfirmed(route, location)) {
      route.pickups[PICKUP_KEY[location]].confirmedAt = undefined;
      route.markModified("pickups");
    }
  }
  setDelivery(order, {
    route: route._id,
    driver: route.driver || undefined,
    vehicle: route.vehicle || undefined,
    dispatchStatus: "Saliendo",
    address: order.delivery?.address || order.customer?.address,
    pickupWarehouseAt: undefined,
    pickupFactoryAt: undefined,
    deliveredAt: undefined,
    dispatchedAt: undefined,
  });
  await order.save({ session });

  const orders = await loadRouteOrders(route, session);
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

export async function removeOrder(id, orderId, session) {
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeLabel(route)} ya salió; no se le quitan pedidos`);
  const order = await loadOrder(orderId, session);
  const index = route.orders.findIndex((o) => String(o) === String(order._id));
  if (index < 0) throw new HttpError(409, `${order.orderNumber} no está en ${routeLabel(route)}`);

  route.orders.splice(index, 1);
  order.delivery = undefined;
  (order.items || []).forEach((item) => {
    if (!item.deliveredAt) item.pickedUpAt = undefined;
  });
  order.markModified("items");
  setOrderStatus(order, computeOrderStatus(order));
  await order.save({ session });

  const orders = await loadRouteOrders(route, session);
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

// Marca como recogidas las líneas por llevar cuyas ubicaciones ya están todas confirmadas.
function markPicked(order, route, at) {
  (order.items || []).forEach((item) => {
    if (!isCarriable(item) || item.pickedUpAt) return;
    const locations = itemLocations(item);
    if (locations.length && locations.every((l) => isConfirmed(route, l))) item.pickedUpAt = at;
  });
  order.markModified("items");
}

export async function confirmPickup(id, location, session) {
  if (!PICKUP_KEY[location]) throw new HttpError(400, "Ubicación inválida: usa «Almacén» o «Fabricación»");
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeLabel(route)} ya salió`);
  if (route.status !== "Recolectando") {
    throw new HttpError(409, "Asigna motorista, vehículo y al menos un pedido antes de confirmar recogidas");
  }
  const orders = await loadRouteOrders(route, session);
  if (!requiredPickups(orders).includes(location)) {
    throw new HttpError(409, `${routeLabel(route)} no tiene productos empacados en ${location}`);
  }
  if (isConfirmed(route, location)) throw new HttpError(409, `La recogida en ${location} ya está confirmada`);

  await applyPickup(route, orders, location, new Date(), session);
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

// Confirma la recogida en `location` (sin validar el estado de la ruta: eso
// lo hace quien llama): guarda confirmedAt en la ruta y, en cada pedido que
// la requiere, pickupWarehouseAt/pickupFactoryAt y pickedUpAt de sus líneas.
// Guarda los pedidos; la ruta la guarda quien llama.
export async function applyPickup(route, orders, location, at, session) {
  route.pickups[PICKUP_KEY[location]].confirmedAt = at;
  route.markModified("pickups");
  for (const order of orders) {
    if (!orderPickups(order).includes(location)) continue;
    setDelivery(order, { [ORDER_PICKUP_FIELD[location]]: at });
    markPicked(order, route, at);
    await order.save({ session });
  }
}

export async function depart(id, session) {
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeLabel(route)} ya salió`);
  if (!route.driver) throw new HttpError(409, "Asigna un motorista antes de salir");
  if (!route.vehicle) throw new HttpError(409, "Asigna un vehículo antes de salir");
  const orders = await loadRouteOrders(route, session);
  if (!orders.length) throw new HttpError(409, "Agrega al menos un pedido antes de salir");
  const missing = requiredPickups(orders).filter((l) => !isConfirmed(route, l));
  if (missing.length) throw new HttpError(409, `Falta confirmar la recogida en ${missing.join(" y ")}`);
  const empty = orders.find((o) => !(o.items || []).some((i) => isCarriable(i) && i.pickedUpAt));
  if (empty) throw new HttpError(409, `${empty.orderNumber} no tiene productos recogidos`);

  const now = new Date();
  route.departedAt = now;
  for (const order of orders) {
    syncOrder(order, route);
    setDelivery(order, { dispatchStatus: route.delayed ? "Demorado" : "A tiempo", dispatchedAt: now });
    setOrderStatus(order, "En Tránsito", now);
    await order.save({ session });
  }
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

// Entrega una parada: marca deliveredAt en sus líneas recogidas. Si todas
// las líneas del pedido quedan entregadas, el pedido pasa a Entregado; si no
// («Llevar lo que hay»), sale de la ruta con lo pendiente. `at` es la hora de
// la entrega (por defecto, ahora; los scripts de corrección pasan la real).
export async function deliverOrder(id, orderId, session, at = new Date()) {
  const route = await loadRoute(id, session);
  if (route.status !== "En tránsito") throw new HttpError(409, `${routeLabel(route)} no está en tránsito`);
  const order = await loadOrder(orderId, session);
  const position = route.orders.findIndex((o) => String(o) === String(order._id));
  if (position < 0) throw new HttpError(409, `${order.orderNumber} no es una parada de ${routeLabel(route)}`);
  if (isOrderDelivered(order)) throw new HttpError(409, `${order.orderNumber} ya se entregó`);
  const lines = (order.items || []).filter((i) => i.pickedUpAt && !i.deliveredAt);
  if (!lines.length) throw new HttpError(409, `${order.orderNumber} no tiene productos recogidos por entregar`);

  const now = at;
  lines.forEach((i) => {
    i.deliveredAt = now;
  });
  order.markModified("items");
  const partial = !(order.items || []).every((i) => i.deliveredAt);

  if (partial) {
    route.orders.splice(position, 1);
    order.delivery = undefined;
    setOrderStatus(order, computeOrderStatus(order), now);
  } else {
    setDelivery(order, { deliveredAt: now, dispatchStatus: "Entregado" });
    setOrderStatus(order, "Entregado", now);
  }
  await order.save({ session });
  route.deliveries.push({ order: order._id, at: now, partial, position });

  const orders = await loadRouteOrders(route, session);
  applyRouteStatus(route, orders, now);
  await route.save({ session });
  return route;
}

// Deshacer una entrega (solo el mismo día). Si la ruta había quedado
// Completada, vuelve a En tránsito; una entrega parcial devuelve el pedido a
// su posición en la ruta.
export async function undeliverOrder(id, orderId, session) {
  const route = await loadRoute(id, session);
  const order = await loadOrder(orderId, session);
  const entryIndex = route.deliveries.map((d) => String(d.order)).lastIndexOf(String(order._id));
  if (entryIndex < 0) throw new HttpError(409, `${order.orderNumber} no tiene una entrega registrada en ${routeLabel(route)}`);
  const entry = route.deliveries[entryIndex];
  if (localDayKey(entry.at) !== localDayKey()) throw new HttpError(409, "Solo se puede deshacer una entrega el mismo día");

  const at = entry.at.getTime();
  if (entry.partial) {
    if (order.delivery?.route && String(order.delivery.route) !== String(route._id)) {
      throw new HttpError(409, `${order.orderNumber} ya está en otra ruta; no se puede deshacer su entrega aquí`);
    }
    if (order.status === "Entregado") throw new HttpError(409, `${order.orderNumber} ya se entregó por completo`);
    route.orders.splice(Math.min(entry.position, route.orders.length), 0, order._id);
    order.delivery = {
      route: route._id,
      driver: route.driver,
      vehicle: route.vehicle,
      dispatchStatus: route.delayed ? "Demorado" : "A tiempo",
      dispatchedAt: route.departedAt,
      address: order.customer?.address,
      pickupWarehouseAt: route.pickups?.almacen?.confirmedAt,
      pickupFactoryAt: route.pickups?.fabricacion?.confirmedAt,
    };
  } else {
    setDelivery(order, { deliveredAt: undefined, dispatchStatus: route.delayed ? "Demorado" : "A tiempo" });
  }
  (order.items || []).forEach((i) => {
    if (i.deliveredAt && i.deliveredAt.getTime() === at) i.deliveredAt = undefined;
  });
  order.markModified("items");
  setOrderStatus(order, "En Tránsito");
  await order.save({ session });

  route.deliveries.splice(entryIndex, 1);
  const orders = await loadRouteOrders(route, session);
  applyRouteStatus(route, orders);
  await route.save({ session });
  return route;
}

// Motoristas (activos, área Logística) y vehículos con su disponibilidad del día.
export async function availability(dateValue) {
  const date = parseDay(dateValue);
  const [routes, drivers, vehicles] = await Promise.all([
    routeModel.find({ date, status: { $ne: "Completada" } }),
    employeeModel.find({ isActive: true, department: "Logística" }).select("name lastName phone").sort({ name: 1 }),
    vehicleModel.find().sort({ plate: 1 }),
  ]);
  const brief = (r) => ({ _id: r._id, number: r.number, zone: r.zone, status: r.status });
  const byDriver = new Map(routes.filter((r) => r.driver).map((r) => [String(r.driver), brief(r)]));
  const byVehicle = new Map(routes.filter((r) => r.vehicle).map((r) => [r.vehicle, brief(r)]));
  return {
    date: localDayKeyOfStored(date),
    drivers: drivers.map((d) => ({
      _id: d._id,
      name: d.name,
      lastName: d.lastName,
      phone: d.phone,
      busy: byDriver.has(String(d._id)),
      route: byDriver.get(String(d._id)) || null,
    })),
    vehicles: vehicles.map((v) => ({
      _id: v._id,
      plate: v.plate,
      busy: byVehicle.has(v.plate),
      route: byVehicle.get(v.plate) || null,
    })),
  };
}

// Route.date (medianoche UTC) -> "YYYY-MM-DD".
export function localDayKeyOfStored(date) {
  return new Date(date).toISOString().slice(0, 10);
}
