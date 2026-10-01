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

// Código para mostrar: «R-2026-0042». Una ruta vieja que todavía no tiene
// código usa «Ruta N» (respaldo temporal hasta correr migrate-route-codes).
export function routeLabel(route) {
  return route.code || `Ruta ${route.number}`;
}

// Cómo se nombra la ruta dentro de los mensajes: «la Ruta R-2026-0042 (Zona Norte)».
function routeRef(route) {
  return `la Ruta ${route.code || route.number} (${route.zone})`;
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

// Motorista válido (activo, área Logística) y libre; vehículo de Configuración
// y libre. Libre = no está en ninguna otra ruta que no esté Completada, sea del
// día que sea (la misma regla de availability()).
async function assertDriver(route, driverId, session) {
  if (!mongoose.isValidObjectId(driverId)) throw new HttpError(400, "Motorista inválido");
  const driver = await employeeModel.findById(driverId).session(session);
  if (!driver || !driver.isActive || driver.department !== "Logística") {
    throw new HttpError(400, "El motorista debe ser un empleado activo del área Logística");
  }
  const other = await routeModel
    .findOne({ _id: { $ne: route._id }, status: { $ne: "Completada" }, driver: driver._id })
    .session(session);
  if (other) throw new HttpError(409, `${driver.name} ${driver.lastName} ya va en ${routeRef(other)}`);
  return driver;
}

async function assertVehicle(route, plate, session) {
  const vehicle = await vehicleModel.findOne({ plate }).session(session);
  if (!vehicle) throw new HttpError(400, `El vehículo ${plate} no está en Configuración > Vehículos`);
  const other = await routeModel
    .findOne({ _id: { $ne: route._id }, status: { $ne: "Completada" }, vehicle: plate })
    .session(session);
  if (other) throw new HttpError(409, `El vehículo ${plate} ya va en ${routeRef(other)}`);
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

// Siguiente código R-AAAA-NNNN: el último del año + 1 (el consecutivo reinicia
// cada año, no cada día). Si dos rutas toman el mismo a la vez, el índice único
// rechaza una y el controlador reintenta.
export async function nextRouteCode(session, year = localDayKey().slice(0, 4)) {
  const last = await routeModel
    .findOne({ code: { $regex: `^R-${year}-\\d+$` } })
    .collation({ locale: "en", numericOrdering: true })
    .sort({ code: -1 })
    .select("code")
    .session(session);
  const seq = last ? Number(last.code.split("-")[2]) + 1 : 1;
  return { code: `R-${year}-${String(seq).padStart(4, "0")}`, seq };
}

export async function createRoute(body, session) {
  const zone = typeof body?.zone === "string" ? body.zone.trim() : "";
  if (!zone) throw new HttpError(400, "Escribe la zona de la ruta");
  const date = parseDay();
  const { code, seq } = await nextRouteCode(session);
  // `number` solo por compatibilidad con la app móvil (ver models/Route.js).
  const route = new routeModel({ code, number: seq, date, zone });
  await applyCrew(route, pick(body, ["driver", "vehicle"]), session);
  applyRouteStatus(route, []);
  await route.save({ session });
  return route;
}

export async function updateRoute(id, body, session) {
  const route = await loadRoute(id, session);
  if (route.status === "Completada") throw new HttpError(409, `${routeRef(route)} ya se completó`);
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
  if (route.orders.length || route.deliveries.length) {
    if (route.departedAt) throw new HttpError(409, `${routeRef(route)} ya salió; no se puede eliminar`);
    throw new HttpError(409, `${routeRef(route)} tiene pedidos; quítalos antes de eliminarla`);
  }
  // Una ruta que salió solo se elimina si ya se completó y quedó vacía (sus
  // pedidos se eliminaron del panel).
  if (route.departedAt && route.status !== "Completada") throw new HttpError(409, `${routeRef(route)} ya salió; no se puede eliminar`);
  await routeModel.deleteOne({ _id: route._id }, { session });
}

export async function addOrder(id, orderId, session) {
  const route = await loadRoute(id, session);
  if (route.departedAt) throw new HttpError(409, `${routeRef(route)} ya salió; no se le agregan pedidos`);
  const order = await loadOrder(orderId, session);

  if (order.delivery?.route) {
    if (String(order.delivery.route) === String(route._id)) {
      throw new HttpError(409, `${order.orderNumber} ya está en ${routeRef(route)}`);
    }
    const other = await routeModel.findById(order.delivery.route).session(session);
    if (other && other.status !== "Completada") throw new HttpError(409, `${order.orderNumber} ya está en ${routeRef(other)}`);
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

// Por qué un pedido no se puede quitar de su ruta (o null si sí). Misma regla
// que canRemoveFromRoute / removeBlocker de Web/private/frontend/src/lib/
// logistics.js y de Movil/src/lib/logistics.js: debe mantenerse igual.
//   - la ruta ya salió (departedAt), o
//   - ya se confirmó la recogida de alguno de los lugares donde están
//     empacados los productos del pedido (Almacén y/o Fabricación).
export function removeBlocker(order, route) {
  if (route.departedAt) return "La ruta ya salió";
  const confirmed = orderPickups(order).filter((l) => isConfirmed(route, l));
  if (confirmed.length) {
    return `Ya se confirmó la recolección de este pedido en ${confirmed.join(" y ")}; no se puede quitar`;
  }
  return null;
}

export async function removeOrder(id, orderId, session) {
  const route = await loadRoute(id, session);
  const order = await loadOrder(orderId, session);
  const index = route.orders.findIndex((o) => String(o) === String(order._id));
  if (index < 0) {
    if (route.departedAt) throw new HttpError(409, "La ruta ya salió");
    throw new HttpError(409, `${order.orderNumber} no está en ${routeRef(route)}`);
  }
  const blocker = removeBlocker(order, route);
  if (blocker) throw new HttpError(409, blocker);

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
  if (route.departedAt) throw new HttpError(409, `${routeRef(route)} ya salió`);
  if (route.status !== "Recolectando") {
    throw new HttpError(409, "Asigna motorista, vehículo y al menos un pedido antes de confirmar recogidas");
  }
  const orders = await loadRouteOrders(route, session);
  if (!requiredPickups(orders).includes(location)) {
    throw new HttpError(409, `${routeRef(route)} no tiene productos empacados en ${location}`);
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
  if (route.departedAt) throw new HttpError(409, `${routeRef(route)} ya salió`);
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
  if (route.status !== "En tránsito") throw new HttpError(409, `${routeRef(route)} no está en tránsito`);
  const order = await loadOrder(orderId, session);
  const position = route.orders.findIndex((o) => String(o) === String(order._id));
  if (position < 0) throw new HttpError(409, `${order.orderNumber} no es una parada de ${routeRef(route)}`);
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
  if (entryIndex < 0) throw new HttpError(409, `${order.orderNumber} no tiene una entrega registrada en ${routeRef(route)}`);
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

// Motoristas (activos, área Logística) y vehículos con su disponibilidad. No
// depende del día: están ocupados si tienen CUALQUIER ruta sin completar; al
// completarse la ruta quedan libres.
export async function availability() {
  const [routes, drivers, vehicles] = await Promise.all([
    routeModel.find({ status: { $ne: "Completada" } }),
    employeeModel.find({ isActive: true, department: "Logística" }).select("name lastName phone").sort({ name: 1 }),
    vehicleModel.find().sort({ plate: 1 }),
  ]);
  const brief = (r) => ({ _id: r._id, code: r.code, number: r.number, zone: r.zone, status: r.status });
  const byDriver = new Map(routes.filter((r) => r.driver).map((r) => [String(r.driver), brief(r)]));
  const byVehicle = new Map(routes.filter((r) => r.vehicle).map((r) => [r.vehicle, brief(r)]));
  return {
    date: localDayKey(), // solo informativo
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

// --- Listado por rango --------------------------------------------------------

// El Salvador no usa horario de verano: UTC−6 todo el año.
const SV_UTC_OFFSET_MS = 6 * 3600000;
const DAY_MS = 86400000;

// Inicio y fin (instantes) de un día "YYYY-MM-DD" en hora de El Salvador.
function dayBounds(key) {
  const start = parseDay(key).getTime() + SV_UTC_OFFSET_MS;
  return [new Date(start), new Date(start + DAY_MS - 1)];
}

// «Esta semana»: lunes a hoy, igual que el rango «Esta semana» de Finanzas y
// del resto del panel (context/DateRangeContext.jsx: del lunes a las 00:00 al
// final de hoy). Devuelve { from, to } como "YYYY-MM-DD" de El Salvador.
export function weekRangeKeys(now = new Date()) {
  const to = localDayKey(now);
  const weekday = new Date(`${to}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  const from = new Date(Date.parse(`${to}T00:00:00.000Z`) - ((weekday + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
  return { from, to };
}

/*
  Filtro de GET /routes?from=YYYY-MM-DD&to=YYYY-MM-DD (fechas de El Salvador):
    a) TODAS las rutas sin completar (Pendiente, Recolectando, En tránsito), sin
       importar su fecha, y
    b) las Completadas cuya fecha de completado (completedAt; si no tiene, su
       date) cae dentro del rango.
  Sin from/to, el rango es esta semana. Un solo extremo: from sin to llega
  hasta hoy; to sin from parte de 1970.
  COMPATIBILIDAD: ?date=YYYY-MM-DD equivale a from=to=date; se conserva hasta
  que la app móvil use el rango y se puede quitar después.
*/
export function routesFilter(query = {}, now = new Date()) {
  let { from, to } = query;
  if (!from && !to && query.date) from = to = query.date;
  if (!from && !to) ({ from, to } = weekRangeKeys(now));
  from = from || "1970-01-01";
  to = to || localDayKey(now);
  const [start] = dayBounds(from);
  const [, end] = dayBounds(to);
  if (start > end) throw new HttpError(400, "Rango inválido: «desde» es posterior a «hasta»");
  return {
    $or: [
      { status: { $ne: "Completada" } },
      { status: "Completada", completedAt: { $gte: start, $lte: end } },
      { status: "Completada", completedAt: null, date: { $gte: parseDay(from), $lte: parseDay(to) } },
    ],
  };
}
