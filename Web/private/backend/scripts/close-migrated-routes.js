// Cierre de rutas migradas que quedaron «En tránsito» (corrección Fase 7).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   npm run close:routes -- --dry-run   (solo muestra lo que haría)
//   npm run close:routes
//   npm run close:routes -- <routeId> <routeId> …   (otras rutas; por defecto las dos de abajo)
//
// Es idempotente. Por cada ruta:
//   - Si ya está Completada, no hace nada.
//   - Confirma las recogidas requeridas que falten (applyPickup, la misma
//     lógica de PATCH /routes/:id/pickup) con la fecha de salida de la ruta.
//   - Entrega cada pedido que no esté Entregado (deliverOrder, el mismo de
//     PATCH /routes/:id/orders/:orderId/deliver) con at = departedAt de la
//     ruta, así las fechas quedan reales. Eso recalcula el pedido y la ruta.
//   - A los pedidos que ya estaban Entregado sin delivery.deliveredAt les
//     copia la fecha de su paso a «Entregado» en statusHistory.
//   - completedAt de la ruta = el delivery.deliveredAt más tardío de sus
//     pedidos (incluidos los rellenados).
//   Si algún pedido tiene líneas sin empacar o que no quedarían recogidas,
//   deliverOrder lo entregaría a medias: esa ruta no se toca y se avisa.
//   Cada ruta va en su propia transacción (todo o nada).
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import routeModel from "../src/models/Route.js";
import orderModel from "../src/models/Order.js";
import { withTransaction } from "../src/lib/stock.js";
import {
  requiredPickups,
  isConfirmed,
  itemLocations,
  isOrderDelivered,
  applyPickup,
  deliverOrder,
} from "../src/lib/routes.js";

export const DEFAULT_ROUTE_IDS = ["6ab73d66bf1d384633575c00", "6ab73d67bf1d384633575c02"];

const iso = (d) => (d ? new Date(d).toISOString() : "—");
const lineText = (item, index) => `[${index}] ${item.product}${item.color ? ` ${item.color}` : ""} ×${item.quantity}`;

function deliveredHistoryAt(order) {
  const entries = (order.statusHistory || []).filter((h) => h.status === "Entregado");
  return entries.length ? entries[entries.length - 1].at : null;
}

// La más tardía de las fechas de entrega de los pedidos.
function latestDelivery(orders) {
  const times = orders.map((o) => o.delivery?.deliveredAt).filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? new Date(Math.max(...times)) : undefined;
}

// completedAt que quedaría: la entrega más tardía entre las ya registradas,
// las que hará deliverOrder (at) y los rellenos.
function expectedCompletedAt(plan) {
  const dates = [
    ...plan.alreadyDelivered,
    ...plan.deliveries.map(() => plan.at),
    ...plan.backfills.map((b) => b.at),
  ].filter(Boolean);
  return dates.length ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))) : undefined;
}

async function loadOrders(route, session) {
  const docs = await orderModel.find({ _id: { $in: route.orders } }).session(session || null);
  const byId = new Map(docs.map((o) => [String(o._id), o]));
  return route.orders.map((id) => byId.get(String(id))).filter(Boolean);
}

// Plan de una ruta: qué recogidas confirmar, qué pedidos entregar (y sus
// líneas), qué pedidos rellenar y qué impide cerrarla.
function planRoute(route, orders) {
  const at = route.departedAt;
  const pickups = requiredPickups(orders).filter((l) => !isConfirmed(route, l));
  const willBeConfirmed = (l) => isConfirmed(route, l) || pickups.includes(l);
  const problems = [];
  if (route.status !== "En tránsito") problems.push(`la ruta está «${route.status}», no «En tránsito»`);
  if (!at) problems.push("la ruta no tiene departedAt");

  const deliveries = [];
  const backfills = [];
  for (const order of orders) {
    if (isOrderDelivered(order)) {
      if (!order.delivery?.deliveredAt) {
        const when = deliveredHistoryAt(order);
        if (when) backfills.push({ order, at: when });
        else problems.push(`${order.orderNumber} está Entregado pero no tiene «Entregado» en statusHistory`);
      }
      continue;
    }
    const lines = [];
    (order.items || []).forEach((item, index) => {
      if (item.deliveredAt) return;
      const picked = item.pickedUpAt || (item.packed && itemLocations(item).length && itemLocations(item).every(willBeConfirmed));
      if (!picked) problems.push(`${order.orderNumber} ${lineText(item, index)} ${item.packed ? "no quedaría recogida" : "no está empacada"}`);
      else lines.push(lineText(item, index));
    });
    deliveries.push({ order, lines });
  }
  const alreadyDelivered = orders.map((o) => o.delivery?.deliveredAt).filter(Boolean);
  return { at, pickups, deliveries, backfills, problems, alreadyDelivered };
}

export async function closeMigratedRoutes(ids = DEFAULT_ROUTE_IDS, { dryRun = false, log = console.log } = {}) {
  const summary = { closed: 0, skipped: 0, blocked: 0, delivered: 0, backfilled: 0 };

  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      log(`\n✖ ${id}: no es un ObjectId válido`);
      summary.blocked += 1;
      continue;
    }
    const route = await routeModel.findById(id);
    if (!route) {
      log(`\n✖ ${id}: ruta no encontrada`);
      summary.blocked += 1;
      continue;
    }
    const title = `Ruta ${route.number} · ${iso(route.date).slice(0, 10)} · ${route.zone} · _id ${route._id}`;
    if (route.status === "Completada") {
      log(`\n= ${title}: ya está Completada, no se toca`);
      summary.skipped += 1;
      continue;
    }

    const plan = planRoute(route, await loadOrders(route));
    log(`\n${dryRun ? "»" : "✔"} ${title} · status ${route.status} · salió ${iso(plan.at)}`);
    log(`  Recogidas a confirmar: ${plan.pickups.length ? plan.pickups.map((l) => `${l} (confirmedAt ${iso(plan.at)})`).join(", ") : "ninguna (ya confirmadas)"}`);
    if (!plan.deliveries.length) log("  Pedidos a entregar: ninguno");
    plan.deliveries.forEach(({ order, lines }) => {
      log(`  Entregar ${order.orderNumber} (${order.status}) con deliveredAt ${iso(plan.at)}:`);
      lines.forEach((l) => log(`    ${l}`));
    });
    plan.backfills.forEach(({ order, at }) =>
      log(`  Rellenar delivery.deliveredAt de ${order.orderNumber} (ya Entregado) con ${iso(at)} (statusHistory «Entregado»)`),
    );
    if (plan.problems.length) {
      log("  ✖ No se toca esta ruta:");
      plan.problems.forEach((p) => log(`    - ${p}`));
      summary.blocked += 1;
      continue;
    }
    log(`  Resultado esperado: ruta Completada con completedAt ${iso(expectedCompletedAt(plan))}; todos sus pedidos Entregado con delivery.deliveredAt`);
    summary.delivered += plan.deliveries.length;
    summary.backfilled += plan.backfills.length;
    summary.closed += 1;
    if (dryRun) continue;

    await withTransaction(async (session) => {
      const current = await routeModel.findById(route._id).session(session);
      if (current.status === "Completada") return;
      const orders = await loadOrders(current, session);
      const { at, pickups, deliveries, backfills } = planRoute(current, orders);
      for (const location of pickups) await applyPickup(current, orders, location, at, session);
      if (pickups.length) await current.save({ session });
      for (const { order } of deliveries) await deliverOrder(current._id, order._id, session, at);
      for (const { order, at: when } of backfills) {
        order.delivery.deliveredAt = when;
        order.markModified("delivery");
        await order.save({ session });
      }
      const after = await routeModel.findById(current._id).session(session);
      if (after.status !== "Completada") throw new Error(`La Ruta ${after.number} no quedó Completada (${after.status})`);
      // completedAt = la entrega más tardía de sus pedidos (incluidos los
      // rellenados), para que la ruta nunca quede completada antes de una entrega.
      after.completedAt = latestDelivery(await loadOrders(after, session));
      await after.save({ session });
    });
  }
  return summary;
}

async function main() {
  const { config } = await import("../config.js");
  if (!config.db.URI) throw new Error("Falta DB_URI en el .env de Web/private/backend");
  const dryRun = process.argv.includes("--dry-run");
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  await mongoose.connect(config.db.URI);
  if (dryRun) console.log("Modo --dry-run: no se escribe nada.");
  const s = await closeMigratedRoutes(ids.length ? ids : DEFAULT_ROUTE_IDS, { dryRun });
  console.log("");
  console.log(`Rutas ${dryRun ? "que se cerrarían" : "cerradas"}: ${s.closed}`);
  console.log(`Pedidos ${dryRun ? "que se entregarían" : "entregados"}: ${s.delivered}`);
  console.log(`Pedidos con delivery.deliveredAt ${dryRun ? "a rellenar" : "rellenado"}: ${s.backfilled}`);
  console.log(`Ya completadas (sin cambios): ${s.skipped}`);
  if (s.blocked) {
    console.log(`⚠ Rutas que no se tocan: ${s.blocked}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error("Error:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
