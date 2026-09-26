// Migración de entregas a rutas de Logística (Fase 7).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   npm run migrate:routes -- --dry-run   (solo muestra lo que haría)
//   npm run migrate:routes
//
// Agrupa los pedidos con delivery.driver y delivery.vehicle que todavía no
// tienen delivery.route por día (hora de El Salvador), motorista y vehículo,
// y crea una Route por grupo con esos pedidos. Es idempotente: los pedidos
// que ya tienen delivery.route no se tocan, así que correrla otra vez no crea
// nada nuevo.
//   - Día del grupo: delivery.dispatchedAt, o el paso a «En Tránsito» en
//     statusHistory, o updatedAt.
//   - Número: correlativo por día, después de las rutas que ya existan.
//   - Zona: «Sin zona» (los pedidos no guardan zona).
//   - Estado: Completada si todos se entregaron; En tránsito si alguno ya
//     salió; si no, Recolectando.
//   - Recogidas: confirmadas cuando todos los pedidos que las requieren ya
//     tenían pickupWarehouseAt / pickupFactoryAt. Las líneas empacadas de
//     los pedidos que ya salieron (o cuya recogida estaba confirmada) quedan
//     con pickedUpAt, para poder entregarlas desde la ruta.
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import orderModel from "../src/models/Order.js";
import routeModel from "../src/models/Route.js";
import { localDayKey, parseDay, orderPickups, itemLocations } from "../src/lib/routes.js";
import { withTransaction } from "../src/lib/stock.js";

const ZONE = "Sin zona";

const historyAt = (order, status) => {
  const entries = (order.statusHistory || []).filter((h) => h.status === status);
  return entries.length ? entries[entries.length - 1].at : null;
};
const isDelivered = (o) => o.status === "Entregado" || Boolean(o.delivery?.deliveredAt);
const hasLeft = (o) => isDelivered(o) || o.status === "En Tránsito" || Boolean(o.delivery?.dispatchedAt);
const departedAtOf = (o) => o.delivery?.dispatchedAt || historyAt(o, "En Tránsito") || (hasLeft(o) ? o.updatedAt : null);
const deliveredAtOf = (o) => o.delivery?.deliveredAt || historyAt(o, "Entregado") || o.updatedAt;
const minDate = (dates) => (dates.length ? new Date(Math.min(...dates.map((d) => new Date(d).getTime()))) : undefined);
const maxDate = (dates) => (dates.length ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))) : undefined);
const PICKUP_FIELD = { "Almacén": "pickupWarehouseAt", "Fabricación": "pickupFactoryAt" };

export async function migrateDeliveryRoutes({ dryRun = false, log = console.log } = {}) {
  const orders = await orderModel
    .find({
      "delivery.driver": { $exists: true, $ne: null },
      "delivery.vehicle": { $exists: true, $nin: [null, ""] },
      "delivery.route": { $exists: false },
    })
    .sort({ createdAt: 1 });

  const groups = new Map();
  for (const order of orders) {
    const day = localDayKey(new Date(order.delivery.dispatchedAt || historyAt(order, "En Tránsito") || order.updatedAt));
    const key = `${day}|${order.delivery.driver}|${order.delivery.vehicle}`;
    if (!groups.has(key)) groups.set(key, { day, driver: order.delivery.driver, vehicle: order.delivery.vehicle, orders: [] });
    groups.get(key).orders.push(order);
  }

  const summary = { created: 0, orders: 0, byStatus: {} };
  const nextNumber = new Map();
  const sorted = [...groups.values()].sort((a, b) => a.day.localeCompare(b.day));

  for (const group of sorted) {
    const date = parseDay(group.day);
    if (!nextNumber.has(group.day)) {
      const last = await routeModel.findOne({ date }).sort({ number: -1 });
      nextNumber.set(group.day, (last?.number || 0) + 1);
    }
    const number = nextNumber.get(group.day);
    nextNumber.set(group.day, number + 1);

    const list = group.orders;
    const allDelivered = list.every(isDelivered);
    const anyLeft = list.some(hasLeft);
    const status = allDelivered ? "Completada" : anyLeft ? "En tránsito" : "Recolectando";
    const departedAt = anyLeft ? minDate(list.map(departedAtOf).filter(Boolean)) : undefined;

    // Recogida confirmada si todos los pedidos que la requieren ya la tenían.
    const pickups = {};
    for (const [location, key] of [["Almacén", "almacen"], ["Fabricación", "fabricacion"]]) {
      const needing = list.filter((o) => orderPickups(o).includes(location) || o.delivery?.[PICKUP_FIELD[location]]);
      const dates = needing.map((o) => o.delivery?.[PICKUP_FIELD[location]]).filter(Boolean);
      pickups[key] = { confirmedAt: needing.length && dates.length === needing.length ? maxDate(dates) : undefined };
    }

    summary.created += 1;
    summary.orders += list.length;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    log(`${dryRun ? "Crearía" : "Creada"} Ruta ${number} · ${group.day} · ${group.vehicle} · ${list.length} pedido(s) · ${status}`);
    if (dryRun) continue;

    // Ruta y pedidos del grupo en una transacción: si algo falla, el grupo
    // queda sin migrar y se reintenta en la próxima corrida.
    await withTransaction(async (session) => {
      const [route] = await routeModel.create(
        [
          {
            number,
            date,
            zone: ZONE,
            driver: group.driver,
            vehicle: group.vehicle,
            orders: list.map((o) => o._id),
            status,
            departedAt,
            completedAt: allDelivered ? maxDate(list.map(deliveredAtOf)) : undefined,
            pickups,
            deliveries: list
              .map((o, position) => ({ o, position }))
              .filter(({ o }) => isDelivered(o))
              .map(({ o, position }) => ({ order: o._id, at: deliveredAtOf(o), partial: false, position })),
          },
        ],
        { session },
      );
      await linkOrders(list, route, session);
    });
  }
  return summary;
}

// Enlaza los pedidos del grupo a su ruta y marca como recogidas las líneas
// empacadas de los que ya salieron (o cuya recogida estaba confirmada).
async function linkOrders(list, route, session) {
  for (const order of list) {
    order.delivery.route = route._id;
    if (!isDelivered(order)) {
      (order.items || []).forEach((item) => {
        if (!item.packed || item.deliveredAt || item.pickedUpAt) return;
        const picked = hasLeft(order) || itemLocations(item).every((l) => order.delivery?.[PICKUP_FIELD[l]]);
        if (picked) item.pickedUpAt = departedAtOf(order) || order.delivery?.pickupWarehouseAt || order.delivery?.pickupFactoryAt;
      });
      order.markModified("items");
    }
    order.markModified("delivery");
    await order.save({ session });
  }
}

async function main() {
  const { config } = await import("../config.js");
  if (!config.db.URI) throw new Error("Falta DB_URI en el .env de Web/private/backend");
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(config.db.URI);
  if (dryRun) console.log("Modo --dry-run: no se escribe nada.\n");
  const summary = await migrateDeliveryRoutes({ dryRun });
  console.log("");
  console.log(`Rutas ${dryRun ? "que se crearían" : "creadas"}: ${summary.created}`);
  console.log(`Pedidos vinculados:            ${summary.orders}`);
  for (const [status, n] of Object.entries(summary.byStatus)) console.log(`  ${status}: ${n}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error("Error en la migración:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
