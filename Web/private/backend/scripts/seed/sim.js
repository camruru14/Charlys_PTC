import { computeOrderStatus, setOrderStatus } from "../../src/lib/orderStatus.js";
import { orderPickups, requiredPickups, computeRouteStatus } from "../../src/lib/routes.js";
import { formatSequence } from "../../src/lib/counters.js";
import * as T from "./time.js";
import * as D from "./data.js";
import { employedOn } from "./people.js";

/*
  Simulación del día a día: la compra llega de la tienda, Almacén verifica contra el stock, lo que no
  hay se fabrica en un lote «Pedido», se empaca, Logística arma rutas por zona y se entrega. Mientras
  tanto el stock se repone con lotes de stock («Diario») que se envían a bodega.

  Cada paso reproduce lo que hacen las funciones reales del backend (lib/orderLines.js, lib/batchFlow.js,
  lib/routes.js) y el estado de cada pedido sale de computeOrderStatus / setOrderStatus. Los eventos se
  ejecutan por orden de fecha hasta «ahora»: lo que todavía no pasó se queda a medias (pedidos recientes
  en todos los estados, rutas en curso, lotes en proceso).
*/

const r2 = (n) => Math.round(n * 100) / 100;
const toFixed2 = (n) => Number(n.toFixed(2));
const roundTo = (n, step) => Math.round(n / step) * step;
const floorTo = (n, step) => Math.floor(n / step) * step;
const hashStr = (s) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const MIN = 60000;
const RECENT_DAYS = 9;

class Queue {
  constructor() {
    this.heap = [];
    this.seq = 0;
  }
  get size() {
    return this.heap.length;
  }
  less(a, b) {
    return a.t < b.t || (a.t === b.t && a.seq < b.seq);
  }
  push(date, fn) {
    const e = { t: date.getTime(), seq: this.seq++, fn };
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  peekTime() {
    return this.heap[0].t;
  }
  pop() {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}

export function simulate({ rng, newId, ctx, employees, intents, now, todayKey, startKey, prior, params = {} }) {
  const P = { ropDays: 4.5, targetDays: 13, minBatch: 3000, ...params };
  const q = new Queue();
  let clock = new Date(0);
  const at = (date, fn) => q.push(date < clock ? clock : date, fn);

  const products = ctx.products;
  const activeProducts = products.filter((p) => p.active !== false);
  const productByName = new Map(products.map((p) => [p.name, p]));
  const whNames = ctx.warehouses.map((w) => w.name);
  const plates = ctx.vehicles.map((v) => v.plate);

  // ---- Estado ---------------------------------------------------------------------------------
  const orders = [];
  const payments = [];
  const customerOrders = [];
  const sales = []; // { order, createdAt }
  const batches = [];
  const routes = [];
  const inv = new Map(); // «producto|color|bodega» -> artículo de Producto terminado
  const pending = new Map(); // «producto|color» -> unidades de lotes de stock por llegar
  const demand = new Map(); // «producto|color» -> [{ t, q }]
  const oinfo = new WeakMap();
  const stats = { linesStock: 0, linesManufactured: 0, linesSplit: 0, partialRoutes: 0, stockBatches: 0, orderBatches: 0 };
  let ordSeq = 0;
  let routeSeq = 0;

  const lines = ctx.productionLines.filter((l) => l.active !== false).map((l) => ({ name: l.name, busy: [] }));
  const drivers = employees
    .filter((e) => e.department === "Logística" && /motorista/i.test(e.position))
    .map((e) => ({ emp: e, busy: false }));
  const vehicles = plates.map((plate) => ({ plate, busy: false }));
  const operators = employees.filter((e) => e.department === "Fabricación" && /operari/i.test(e.position));

  const comboKey = (product, color) => `${product}|${color || ""}`;
  const primaryWh = (product, color) => whNames[hashStr(comboKey(product, color)) % whNames.length];

  const isRecent = (date) => now - date < RECENT_DAYS * 86400000;
  const lag = () => 0; // (el atraso de lo reciente lo definen los roles de pedido, ver «Arranque»)

  const touch = (order, date) => {
    if (!order.updatedAt || date > order.updatedAt) order.updatedAt = date;
  };
  const restatus = (order, date) => {
    setOrderStatus(order, computeOrderStatus(order), date);
    touch(order, date);
  };
  const setDelivery = (order, fields) => {
    const merged = { ...(order.delivery || {}), ...fields };
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
    order.delivery = merged;
  };

  // ---- Inventario -----------------------------------------------------------------------------
  function getItem(product, color, wh, date, create = false) {
    const key = `${comboKey(product, color)}|${wh}`;
    let item = inv.get(key);
    if (!item && create) {
      const p = productByName.get(product);
      const d = prior.get(comboKey(product, color)) || 0;
      item = {
        _id: newId(date),
        name: product,
        category: "Producto Terminado",
        color,
        unit: "unidad",
        stock: 0,
        minStock: wh === primaryWh(product, color) ? Math.max(200, roundTo(d * 1.5, 100)) : 0,
        unitCost: r2((p?.price || 0) * 0.52),
        location: wh,
        createdAt: date,
        updatedAt: date,
      };
      inv.set(key, item);
    }
    return item;
  }
  const totalStock = (product, color) => whNames.reduce((s, wh) => s + (getItem(product, color, wh)?.stock || 0), 0);
  function bestWarehouse(product, color) {
    let best = null;
    for (const wh of whNames) {
      const item = getItem(product, color, wh);
      if (item && (!best || item.stock > best.stock)) best = item;
    }
    return best;
  }
  function takeStock(item, quantity, date) {
    if (item.stock < quantity) throw new Error(`stock insuficiente ${item.name} ${item.color}`);
    item.stock -= quantity;
    item.updatedAt = date;
  }
  function addStock(product, color, wh, quantity, date, inbound) {
    const item = getItem(product, color, wh, date, true);
    item.stock += quantity;
    item.updatedAt = date;
    if (inbound) item.lastInbound = inbound;
    return item;
  }

  // ---- Fabricación ----------------------------------------------------------------------------
  function pickOperator(date) {
    const key = T.dayKeyOf(date);
    const ok = operators.filter((e) => employedOn(e, key));
    return rng.pick(ok.length ? ok : operators);
  }

  function productionMinutes(batch) {
    const p = productByName.get(batch.product);
    const rate = (p?.category === "Pelotas" ? 2200 : 3600) * rng.range(0.85, 1.15);
    return Math.max(60, Math.round((batch.targetQuantity / rate) * 60) + 30);
  }

  // Primer hueco de la línea (en horas de trabajo) donde cabe un lote que dura `total` minutos.
  function findSlot(line, earliest, total) {
    let start = T.nextOpenTime(earliest);
    for (let guard = 0; guard < 500; guard += 1) {
      const end = T.addWorkMinutes(start, total);
      const clash = line.busy.find((x) => x.start < end && start < x.end);
      if (!clash) return { start, end };
      start = T.nextOpenTime(clash.end);
    }
    throw new Error("sin hueco en la línea");
  }

  // Reserva una línea de producción y programa inicio, (a veces) una parada, y fin del lote.
  function scheduleProduction(batch, earliest, afterComplete, minWork = 0) {
    const work = Math.max(minWork, productionMinutes(batch));
    const incident = rng.chance(0.07);
    const stopWork = incident ? Math.round(work * rng.range(0.2, 0.7)) : 0;
    const stopFor = incident ? rng.int(60, 180) : 0;
    let best = null;
    for (const line of lines) {
      const slot = findSlot(line, earliest, work + stopFor);
      if (!best || slot.start < best.slot.start) best = { line, slot };
    }
    const { line } = best;
    const { start, end } = best.slot;
    line.busy.push({ start, end });

    at(start, () => {
      batch.status = "En Proceso";
      batch.productionLine = line.name;
      batch.operator = pickOperator(start)._id;
      batch.startedAt = start;
      batch.updatedAt = start;
    });
    if (incident) {
      const stopAt = T.addWorkMinutes(start, stopWork);
      const resumeAt = T.addWorkMinutes(stopAt, stopFor);
      at(stopAt, () => {
        batch.status = "Detenido";
        batch.stoppedAt = stopAt;
        batch.stopReason = rng.pick(D.STOP_REASONS);
        batch.updatedAt = stopAt;
      });
      at(resumeAt, () => {
        batch.status = "En Proceso";
        batch.stoppedAt = undefined;
        batch.stopReason = undefined;
        batch.updatedAt = resumeAt;
      });
    }
    at(end, () => {
      const target = batch.targetQuantity;
      batch.producedQuantity =
        batch.category === "Pedido" ? target + Math.round(target * rng.range(0, 0.02)) : Math.max(1, Math.round(target * rng.range(0.97, 1.03)));
      batch.status = "Completado";
      batch.completedAt = end;
      batch.updatedAt = end;
      afterComplete(end);
    });
    return { start, end };
  }

  function newBatch(fields, date) {
    const batch = {
      _id: newId(date),
      batchNumber: null,
      producedQuantity: 0,
      status: "Programado",
      createdAt: date,
      updatedAt: date,
      ...fields,
    };
    batches.push(batch);
    return batch;
  }

  function createOrderBatch(order, item, target, date) {
    const batch = newBatch({ product: item.product, color: item.color, category: "Pedido", targetQuantity: target }, date);
    stats.orderBatches += 1;
    const role = oinfo.get(order)?.role;
    let earliest = new Date(date.getTime() + rng.range(90, 600) * MIN);
    let minWork = 0;
    if (role === "fab") {
      // Cola de fabricación: unos esperan su turno (Programado), otros están en la máquina (En Proceso) y otros
      // ya se fabricaron y esperan que Fabricación los empaque.
      const u = rng.float();
      if (u < 0.55) earliest = new Date(now.getTime() + rng.range(60, 30 * 60) * MIN);
      else if (u < 0.85) {
        earliest = new Date(Math.max(date.getTime() + 60 * MIN, now.getTime() - rng.range(20, 90) * MIN));
        minWork = 300;
      } else earliest = new Date(Math.max(date.getTime() + 60 * MIN, now.getTime() - rng.range(5 * 60, 20 * 60) * MIN));
    } else if (role === "partial") earliest = new Date(now.getTime() + rng.range(120, 40 * 60) * MIN);
    else if (role === "wait" || role === "rec" || role === "transit") earliest = new Date(date.getTime() + rng.range(40, 120) * MIN);
    scheduleProduction(
      batch,
      earliest,
      (end) => {
        let packAt = T.nextOpenTime(new Date(end.getTime() + rng.range(20, 300) * MIN));
        if (role === "fab" || role === "partial") packAt = new Date(Math.max(packAt.getTime(), now.getTime() + rng.range(30, 600) * MIN));
        at(packAt, () => packManufactured(order, item, batch, packAt));
      },
      minWork,
    );
    return batch;
  }

  function createStockBatch(product, color, target, date) {
    const batch = newBatch({ product, color, category: "Diario", targetQuantity: target }, date);
    stats.stockBatches += 1;
    const combo = comboKey(product, color);
    pending.set(combo, (pending.get(combo) || 0) + target);
    const earliest = new Date(date.getTime() + rng.range(30, 360) * MIN);
    const { start } = scheduleProduction(batch, earliest, (end) => {
      const sendAt = T.nextOpenTime(new Date(end.getTime() + rng.range(30, 720) * MIN));
      at(sendAt, () => sendToWarehouse(batch, sendAt));
    });
    batch.startDate = T.midnightUTC(T.dayKeyOf(start));
    return batch;
  }

  function sendToWarehouse(batch, date) {
    const wh = rng.chance(0.88) ? primaryWh(batch.product, batch.color) : rng.pick(whNames);
    const quantity = batch.producedQuantity;
    const inbound = { quantity, batch, at: date };
    addStock(batch.product, batch.color, wh, quantity, date, inbound);
    batch.sentToWarehouseAt = date;
    batch.destinationWarehouse = wh;
    batch.sentQuantity = quantity;
    batch.updatedAt = date;
    const combo = comboKey(batch.product, batch.color);
    pending.set(combo, Math.max(0, (pending.get(combo) || 0) - batch.targetQuantity));
  }

  function planReplenishment(date) {
    for (const p of activeProducts) {
      for (const color of p.colors?.length ? p.colors : [undefined]) {
        const combo = comboKey(p.name, color);
        const log = demand.get(combo) || [];
        const since = date.getTime() - 28 * T.DAY;
        let trail = 0;
        for (let i = log.length - 1; i >= 0 && log[i].t >= since; i -= 1) trail += log[i].q;
        const d = 0.4 * (trail / 28) + 0.6 * (prior.get(combo) || 0);
        if (d <= 0) continue;
        const onHand = totalStock(p.name, color);
        const inflight = pending.get(combo) || 0;
        if (onHand + inflight < d * P.ropDays) {
          const target = Math.max(P.minBatch, roundTo(d * P.targetDays - onHand - inflight, 500));
          createStockBatch(p.name, color, target, date);
        }
      }
    }
  }

  // ---- Pedidos --------------------------------------------------------------------------------
  function packStockLine(order, item, date) {
    if (item.packed) return;
    if (item.fromStockQty != null) {
      if (item.stockPackedAt) return;
      item.stockPackedAt = date;
      if (item.manufacturePackedAt) {
        item.packed = true;
        item.packedAt = date;
      }
    } else {
      item.packed = true;
      item.packedAt = date;
      item.packedLocation = "Almacén";
    }
    oinfo.get(order).firstPackedAt ??= date;
    restatus(order, date);
  }

  function packManufactured(order, item, batch, date) {
    batch.packedAt = date;
    batch.updatedAt = date;
    if (item.fromStockQty != null) {
      item.manufacturePackedAt = date;
      if (item.stockPackedAt) {
        item.packed = true;
        item.packedAt = date;
      }
    } else {
      item.verified = true;
      item.packed = true;
      item.packedAt = date;
      item.packedLocation = "Fabricación";
    }
    oinfo.get(order).firstPackedAt ??= date;
    restatus(order, date);
  }

  function verifyOrder(order, date) {
    const role = oinfo.get(order).role;
    const quickPack = ["wait", "rec", "transit", "partial"].includes(role);
    const packDelay = () => (quickPack ? rng.range(60, 360) : rng.range(60, 26 * 60));
    for (const [idx, item] of order.items.entries()) {
      const best = bestWarehouse(item.product, item.color);
      // «fab»: todo el pedido va a fabricación (sin existencia); «partial»: la 1.ª línea sale de bodega y las demás se fabrican.
      const forceFab = role === "fab" || (role === "partial" && idx > 0);
      const bestStock = forceFab ? 0 : best?.stock || 0;
      if (bestStock >= item.quantity) {
        takeStock(best, item.quantity, date);
        item.verified = true;
        item.verifiedWarehouse = best.location;
        item.verifiedAt = date;
        stats.linesStock += 1;
        const packAt = T.nextOpenTime(new Date(date.getTime() + packDelay() * MIN));
        at(packAt, () => packStockLine(order, item, packAt));
      } else if (!forceFab && item.quantity >= 200 && bestStock >= 100 && rng.chance(0.55)) {
        // «Tomar X y fabricar Y»: existencia parcial.
        const take = Math.max(50, floorTo(Math.min(bestStock, item.quantity * 0.9), 50));
        const rest = item.quantity - take;
        takeStock(best, take, date);
        const batch = createOrderBatch(order, item, rest, date);
        item.fromStockQty = take;
        item.toManufactureQty = rest;
        item.verified = true;
        item.verifiedWarehouse = best.location;
        item.verifiedAt = date;
        item.sentToManufacturing = true;
        item.sentToManufacturingAt = date;
        item.manufacturingBatch = batch._id;
        item.manufacturedAt = date;
        stats.linesSplit += 1;
        const packAt = T.nextOpenTime(new Date(date.getTime() + packDelay() * MIN));
        at(packAt, () => packStockLine(order, item, packAt));
      } else {
        const batch = createOrderBatch(order, item, item.quantity, date);
        item.sentToManufacturing = true;
        item.sentToManufacturingAt = date;
        item.manufacturingBatch = batch._id;
        item.manufacturedAt = date;
        stats.linesManufactured += 1;
      }
    }
    restatus(order, date);
  }

  function handleIntent(it) {
    const t0 = it.t0;
    const c = it.customer;
    const items = it.lines.map((l) => ({
      product: l.product,
      color: l.color,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: toFixed2(l.unitPrice * l.quantity),
    }));
    const total = toFixed2(items.reduce((s, i) => s + i.subtotal, 0));
    ordSeq += 1;
    const order = {
      _id: newId(t0),
      orderNumber: formatSequence("ORD-2026", ordSeq),
      customer: { name: `${c.name} ${c.lastName}`.trim(), email: c.email, phone: c.phone, address: c.addresses[0].address },
      items,
      total,
      status: "Procesando",
      source: "ecommerce",
      notes: rng.chance(0.1) ? rng.pick(D.ORDER_NOTES) : undefined,
      sentToInventoryAt: t0,
      statusHistory: [{ status: "Procesando", at: t0 }],
      createdAt: t0,
      updatedAt: t0,
    };
    orders.push(order);
    orderById.set(String(order._id), order);
    oinfo.set(order, { zone: c._s.zone, customer: c, firstPackedAt: null, partialUsed: false, role: it.role, hold: ["wait", "rec", "transit"].includes(it.role), partialForce: it.role === "partial" });

    const stamp = new Date(t0.getTime() + rng.int(2, 18));
    customerOrders.push({ _id: newId(stamp), customer: c._id, order: order._id, createdAt: stamp, updatedAt: stamp });
    payments.push({
      _id: newId(stamp),
      order: order._id,
      provider: "wompi",
      idTransaccion: `SEED-${rng.int(0, 0xfffffff).toString(16).padStart(7, "0")}${rng.int(0, 0xffff).toString(16).padStart(4, "0")}`,
      monto: total,
      esAprobada: true,
      formaPago: rng.pick(["VISA", "MASTERCARD"]),
      codigoAutorizacion: String(rng.int(100000, 999999)),
      mensaje: "SEED: cobro ficticio aprobado (no se llamó a Wompi)",
      cardLast4: String(rng.int(1000, 9999)),
      status: "aprobado",
      createdAt: stamp,
      updatedAt: stamp,
    });
    sales.push({ order, createdAt: stamp });

    for (const item of items) {
      const k = comboKey(item.product, item.color);
      if (!demand.has(k)) demand.set(k, []);
      demand.get(k).push({ t: t0.getTime(), q: item.quantity });
    }
    // «proc»: pedidos que todavía no pasan por Almacén (la verificación queda para después de «ahora»).
    const verifyAt = it.role === "proc" ? new Date(now.getTime() + rng.range(20, 400) * MIN) : T.nextOpenTime(new Date(t0.getTime() + rng.range(20, rng.chance(0.25) ? 900 : 300) * MIN));
    at(verifyAt, () => verifyOrder(order, verifyAt));
  }

  // ---- Logística ------------------------------------------------------------------------------
  const carriable = (item) => Boolean(item.packed && !item.deliveredAt);
  const isDelivered = (order) => order.status === "Entregado" || Boolean(order.delivery?.deliveredAt);
  const routeOrders = (route) => route.orders.map((id) => orderById.get(String(id))).filter(Boolean);
  const orderById = new Map();

  function markPicked(order, route, date) {
    for (const item of order.items) {
      if (!carriable(item) || item.pickedUpAt) continue;
      const locs = item.fromStockQty != null ? ["Almacén", "Fabricación"] : item.packedLocation ? [item.packedLocation] : [];
      const key = { Almacén: "almacen", Fabricación: "fabricacion" };
      if (locs.length && locs.every((l) => route.pickups[key[l]].confirmedAt)) item.pickedUpAt = date;
    }
  }

  function confirmPickup(route, location, date) {
    const key = location === "Almacén" ? "almacen" : "fabricacion";
    if (route.pickups[key].confirmedAt) return;
    const list = routeOrders(route);
    route.pickups[key].confirmedAt = date;
    for (const order of list) {
      if (!orderPickups(order).includes(location)) continue;
      setDelivery(order, { [location === "Almacén" ? "pickupWarehouseAt" : "pickupFactoryAt"]: date });
      markPicked(order, route, date);
      touch(order, date);
    }
    route.updatedAt = date;
  }

  function releaseCrew(route) {
    const d = drivers.find((x) => String(x.emp._id) === String(route.driver));
    const v = vehicles.find((x) => x.plate === route.vehicle);
    if (d) d.busy = false;
    if (v) v.busy = false;
  }

  function depart(route, date) {
    // Confirma lo que aparezca pendiente (líneas empacadas después de armar la ruta).
    const list = routeOrders(route);
    for (const loc of requiredPickups(list)) confirmPickup(route, loc, new Date(date.getTime() - 60000));
    // Quita los pedidos sin nada recogido (no deberían quedar, pero la ruta no puede salir con ellos).
    for (const order of routeOrders(route)) {
      if (order.items.some((i) => carriable(i) && i.pickedUpAt)) continue;
      route.orders = route.orders.filter((id) => String(id) !== String(order._id));
      order.delivery = undefined;
      restatus(order, date);
    }
    const stops = routeOrders(route);
    if (!stops.length) {
      routes.splice(routes.indexOf(route), 1);
      releaseCrew(route);
      route.cancelled = true;
      return [];
    }
    route.departedAt = date;
    for (const order of stops) {
      setDelivery(order, { route: route._id, driver: route.driver, vehicle: route.vehicle, dispatchStatus: route.delayed ? "Demorado" : "A tiempo", dispatchedAt: date });
      setOrderStatus(order, "En Tránsito", date);
      touch(order, date);
    }
    route.status = computeRouteStatus(route, stops);
    route.updatedAt = date;
    return stops;
  }

  function deliver(route, order, date) {
    if (route.cancelled || isDelivered(order)) return;
    const position = route.orders.findIndex((id) => String(id) === String(order._id));
    if (position < 0) return;
    const pickedLines = order.items.filter((i) => i.pickedUpAt && !i.deliveredAt);
    if (!pickedLines.length) return;
    pickedLines.forEach((i) => {
      i.deliveredAt = date;
    });
    const partial = !order.items.every((i) => i.deliveredAt);
    if (partial) {
      route.orders.splice(position, 1);
      order.delivery = undefined;
      stats.partialRoutes += 1;
      setOrderStatus(order, computeOrderStatus(order), date);
    } else {
      setDelivery(order, { deliveredAt: date, dispatchStatus: "Entregado" });
      setOrderStatus(order, "Entregado", date);
    }
    touch(order, date);
    route.deliveries.push({ order: order._id, at: date, partial, position });
    route.status = computeRouteStatus(route, routeOrders(route));
    route.updatedAt = date;
    if (route.status === "Completada") {
      route.completedAt = route.completedAt || date;
      releaseCrew(route);
    }
  }

  function planRoutes(date, extra = null) {
    const key = T.dayKeyOf(date);
    const dow = T.dowOf(key);
    let zonesToday = extra ? Object.keys(D.ZONE_ROUTE_DAYS) : Object.keys(D.ZONE_ROUTE_DAYS).filter((z) => D.ZONE_ROUTE_DAYS[z].includes(dow));
    const waiting = [];
    for (const order of orders) {
      if (order.status === "Entregado" || order.delivery?.route) continue;
      if (!order.items.some(carriable)) continue;
      const info = oinfo.get(order);
      if (extra) {
        // Las rutas extra solo llevan los pedidos reservados para ellas (rol «transit» o «rec»).
        if (info.role !== extra.role || !info.hold) continue;
      } else {
        if (info.hold) continue;
        if (!zonesToday.includes(info.zone)) continue;
      }
      if (order.status === "Empacado") {
        waiting.push(order);
      } else if (!extra && !info.partialUsed && info.firstPackedAt && (info.partialForce ? date - info.firstPackedAt > 16 * 3600000 : date - info.firstPackedAt > 30 * 3600000 && rng.chance(isRecent(order.createdAt) ? 0.08 : 0.4))) {
        // «Llevar lo que hay»: la parte lista sale sin esperar el resto.
        info.partialUsed = true;
        waiting.push(order);
      }
    }
    waiting.sort((a, b) => (oinfo.get(a).firstPackedAt || 0) - (oinfo.get(b).firstPackedAt || 0));
    let slot = 0;
    if (extra) {
      // Ruta extra: la zona con más pedidos esperando.
      const counts = new Map();
      for (const o of waiting) counts.set(oinfo.get(o).zone, (counts.get(oinfo.get(o).zone) || 0) + 1);
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      zonesToday = best ? [best[0]] : [];
    }
    for (const zone of zonesToday) {
      const list = waiting.filter((o) => oinfo.get(o).zone === zone);
      const cap = extra ? extra.maxOrders : zone === "Zona Metropolitana" ? 9 : 8;
      for (let i = 0; i < list.length; i += cap) {
        if (extra && i > 0) break;
        const driverPool = drivers.filter((d) => !d.busy && employedOn(d.emp, key));
        const vehiclePool = vehicles.filter((v) => !v.busy);
        if (!driverPool.length || !vehiclePool.length) return;
        const driver = rng.pick(driverPool);
        const vehicle = rng.pick(vehiclePool);
        driver.busy = true;
        vehicle.busy = true;
        const chunk = list.slice(i, i + cap);
        const t0 = new Date(Math.min(now.getTime(), date.getTime() + slot * 4 * MIN + rng.int(0, 120000)));
        slot += 1;
        routeSeq += 1;
        const route = {
          _id: newId(t0),
          code: formatSequence("R-2026", routeSeq),
          number: routeSeq,
          date: T.midnightUTC(key),
          zone,
          driver: driver.emp._id,
          vehicle: vehicle.plate,
          orders: [],
          status: "Pendiente",
          delayed: rng.chance(0.08),
          pickups: { almacen: {}, fabricacion: {} },
          deliveries: [],
          createdAt: t0,
          updatedAt: t0,
        };
        routes.push(route);
        route.endEst = new Date(t0.getTime() + (60 + chunk.length * 42) * MIN);
        chunk.forEach((order, k) => {
          const added = new Date(Math.min(now.getTime(), t0.getTime() + (k + 1) * 45000));
          route.orders.push(order._id);
          oinfo.get(order).hold = false;
          setDelivery(order, { route: route._id, driver: route.driver, vehicle: route.vehicle, dispatchStatus: "Saliendo", address: order.customer.address });
          touch(order, added);
          route.updatedAt = added;
        });
        route.status = computeRouteStatus(route, routeOrders(route));

        const need = requiredPickups(routeOrders(route));
        let cursor = new Date(t0.getTime() + rng.range(30, 55) * MIN);
        for (const loc of need) {
          const when = cursor;
          at(when, () => confirmPickup(route, loc, when));
          cursor = new Date(cursor.getTime() + rng.range(15, 35) * MIN);
        }
        const departAt = new Date(cursor.getTime() + rng.range(5, 20) * MIN);
        route.departPlanned = departAt;
        at(departAt, () => {
          if (route.cancelled) return;
          const stops = depart(route, departAt);
          let t = departAt;
          for (const order of stops) {
            t = T.nextOpenTime(new Date(t.getTime() + rng.range(25, 55) * MIN));
            const when = t;
            at(when, () => deliver(route, order, when));
            t = new Date(t.getTime() + 10 * MIN);
          }
        });
      }
    }
  }

  // ---- Arranque -------------------------------------------------------------------------------
  const firstOpen = T.nextOpenTime(T.svTime(startKey, 0));
  at(new Date(firstOpen.getTime() - 60000), () => {
    // Existencias con las que arrancó el año (antes de cualquier verificación).
    for (const p of activeProducts) {
      for (const color of p.colors?.length ? p.colors : [undefined]) {
        const d = prior.get(comboKey(p.name, color)) || 0;
        const qty = Math.max(500, roundTo(d * rng.range(4, 9), 100));
        const item = getItem(p.name, color, primaryWh(p.name, color), clock, true);
        item.stock = qty;
        item.initial = qty;
      }
    }
  });
  for (const key of T.daysBetween(startKey, todayKey)) {
    if (!T.workWindow(key)) continue;
    const tick = T.svTime(key, 7, 30);
    if (tick <= now) at(tick, () => planReplenishment(tick));
    const plan = T.svTime(key, 8, 0);
    if (plan <= now) at(plan, () => planRoutes(plan));
  }
  // Roles de los pedidos de los últimos días: reparten lo abierto entre los estados del panel.
  {
    const age = (it) => (now - it.t0) / 86400000;
    const recentIts = intents.filter((it) => age(it) < RECENT_DAYS);
    const assigned = new Set();
    const metro = (it) => it.customer._s.zone === "Zona Metropolitana";
    const take = (pool, n, role) => {
      for (const it of rng.shuffle(pool.filter((x) => !assigned.has(x))).slice(0, n)) {
        it.role = role;
        assigned.add(it);
      }
    };
    take(recentIts.filter((it) => metro(it) && age(it) >= 1 && age(it) < 5), 7, "transit");
    take(recentIts.filter((it) => metro(it) && age(it) >= 1 && age(it) < 6.5), 5, "rec");
    take(recentIts.filter((it) => metro(it) && it.lines.length >= 2 && age(it) >= 3 && age(it) <= 8), 3, "partial");
    take(recentIts.slice(-16), 8, "proc");
    take(recentIts.filter((it) => age(it) >= 1 && age(it) < 7), 7, "wait");
    take(recentIts.filter((it) => age(it) >= 0.5 && age(it) < 9), 10, "fab");
  }
  // Dos rutas reservadas cerca de «ahora» (en horario de trabajo): una que ya salió y otra recolectando.
  const onRoad = new Date(now.getTime() - 150 * MIN);
  const gathering = new Date(now.getTime() - 25 * MIN);
  for (const [when, role] of [[onRoad, "transit"], [gathering, "rec"]]) {
    if (T.nextOpenTime(when).getTime() !== when.getTime()) continue;
    at(when, () => planRoutes(when, { maxOrders: 12, role }));
  }
  for (const it of intents) at(it.t0, () => handleIntent(it));

  for (;;) {
    if (!q.size || q.peekTime() > now.getTime()) break;
    const e = q.pop();
    clock = new Date(e.t);
    e.fn();
  }

  stats.roles = {};
  for (const o of orders) { const r = oinfo.get(o).role; if (r) { const k = r + " → " + o.status + (o.delivery && o.delivery.route ? "*" : ""); stats.roles[k] = (stats.roles[k] || 0) + 1; } }

  return { orders, oinfo, payments, customerOrders, sales, batches, routes, inventory: [...inv.values()], pending, stats, lines, drivers, operators, pickOperator, newBatch, scheduleLines: lines };
}
