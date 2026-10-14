import { createRng } from "./rng.js";
import { createIdFactory } from "./ids.js";
import * as T from "./time.js";
import * as D from "./data.js";
import { makeEmployees, makeCustomers } from "./people.js";
import { makeIntents } from "./intents.js";
import { simulate } from "./sim.js";
import { generateAttendance, generateFinance, generateBudgets } from "./finance.js";
import { formatSequence } from "../../src/lib/counters.js";

/*
  Genera TODO el conjunto de datos en memoria (sin tocar la base): empleados con su asistencia,
  clientes, pedidos con su recorrido, lotes, inventario, rutas y Finanzas. Misma semilla y mismo
  «ahora» = mismos datos.
*/

export const START_KEY = "2026-01-01";
const MIN = 60000;
const r2 = (n) => Math.round(n * 100) / 100;
const roundTo = (n, step) => Math.round(n / step) * step;

// Valida contra el esquema de Mongoose y devuelve el documento tal como lo guardaría .save()
// (con valores por defecto, sin campos vacíos), más __v: 0.
export async function build(Model, data) {
  const doc = new Model(data);
  try {
    await doc.validate();
  } catch (error) {
    throw new Error(`${Model.modelName} inválido (${data.orderNumber || data.reference || data.batchNumber || data.code || data.email || data._id}): ${error.message}`);
  }
  const out = doc.toObject({ depopulate: true, versionKey: false });
  out.__v = 0;
  return out;
}

async function buildAll(Model, list, extra = (x) => x) {
  const out = [];
  for (const item of list) out.push(await build(Model, extra(item)));
  return out;
}

// Categorías de gasto por nombre exacto; si falta alguna, cae a «Otros» (o a la primera disponible).
function resolveCategoryNames(categories) {
  const live = categories.filter((c) => !c.archived);
  const byName = (name) => live.find((c) => c.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))?.name;
  const fallback = byName("Otros") || live[0]?.name;
  if (!fallback) throw new Error("No hay categorías de gasto activas.");
  const missing = [];
  const pick = (name) => {
    const found = byName(name);
    if (!found) missing.push(name);
    return found || fallback;
  };
  const names = {
    rawMaterial: pick("Materia Prima"),
    payroll: pick("Planilla"),
    logistics: pick("Logística"),
    services: pick("Servicios"),
    maintenance: pick("Mantenimiento"),
    other: fallback,
    otherIncome: "Otros ingresos",
  };
  return { names, missing };
}

export async function generateDataset({ ctx, M, seed = 2026, now, startKey = START_KEY }) {
  const newId = createIdFactory(seed);
  const rngPeople = createRng(seed + 1);
  const rngOrders = createRng(seed + 2);
  const rngSim = createRng(seed + 3);
  const rngFin = createRng(seed + 4);
  const rngMisc = createRng(seed + 5);
  const todayKey = T.dayKeyOf(now);
  const activeProducts = ctx.products.filter((p) => p.active !== false);
  if (!activeProducts.length) throw new Error("El catálogo no tiene productos activos.");
  if (!ctx.warehouses.length || !ctx.productionLines.length || !ctx.vehicles.length) throw new Error("Faltan bodegas, líneas de producción o vehículos.");

  // ---- Personas ---------------------------------------------------------------------------
  const employees = makeEmployees({ rng: rngPeople, newId, startKey, todayKey, reservedEmails: ctx.admins.map((a) => a.email) });
  let customers = makeCustomers({ rng: rngPeople, newId, products: activeProducts });
  const made = makeIntents({ rng: rngOrders, customers, products: activeProducts, startKey, todayKey, now });
  const intents = made.intents;
  customers = made.customers;
  for (const c of customers) {
    c._id = newId(c.createdAt);
    c.addresses[0]._id = newId(c.createdAt);
  }

  // Demanda promedio por día de cada producto/color: base para reponer el stock.
  const totalDays = Math.max(1, T.diffDays(startKey, todayKey) + 1);
  const prior = new Map();
  for (const it of intents) for (const l of it.lines) prior.set(`${l.product}|${l.color || ""}`, (prior.get(`${l.product}|${l.color || ""}`) || 0) + l.quantity / totalDays);

  generateAttendance({ rng: rngPeople, employees, startKey, todayKey, now, schedule: ctx.workSchedule });

  // ---- Operación --------------------------------------------------------------------------
  const sim = simulate({ rng: rngSim, newId, ctx, employees, intents, now, todayKey, startKey, prior });
  ensureVariety({ sim, rng: rngMisc, now, todayKey, ctx, newId, activeProducts });

  // Números de lote correlativos por fecha de creación.
  const sorted = sim.batches.map((b, i) => [b, i]).sort((a, b) => a[0].createdAt - b[0].createdAt || a[1] - b[1]);
  sorted.forEach(([batch], i) => {
    batch.batchNumber = formatSequence("LOTE-2026", i + 1);
  });
  const inventory = sim.inventory;
  for (const item of inventory) {
    if (item.lastInbound) item.lastInbound = { quantity: item.lastInbound.quantity, batchNumber: item.lastInbound.batch.batchNumber, at: item.lastInbound.at };
  }

  // ---- Finanzas ---------------------------------------------------------------------------
  const { names: categoryNames, missing: missingCategories } = resolveCategoryNames(ctx.categories);
  const finance = generateFinance({
    rng: rngFin,
    employees,
    routes: sim.routes,
    sales: sim.sales,
    startKey,
    todayKey,
    now,
    categoryNames,
  });
  const { budgets, overspent, spend } = generateBudgets({ rng: rngFin, transactions: finance.transactions, categories: ctx.categories, todayKey });

  // Referencias TRAN correlativas por fecha de creación, compartidas por ventas y movimientos manuales.
  const txPlans = [];
  for (const s of sim.sales) txPlans.push({ kind: "sale", createdAt: s.createdAt, order: s.order });
  for (const m of finance.transactions) txPlans.push({ kind: "manual", createdAt: m.createdAt, m });
  txPlans.forEach((p, i) => (p.i = i));
  txPlans.sort((a, b) => a.createdAt - b.createdAt || a.i - b.i);
  const transactions = txPlans.map((p, idx) => {
    const reference = formatSequence("TRAN-2026", idx + 1);
    if (p.kind === "sale") {
      const o = p.order;
      return {
        _id: newId(p.createdAt),
        reference,
        concept: `Venta pedido ${o.orderNumber}`,
        type: "Ingreso",
        category: "Ventas",
        amount: o.total,
        status: "Completado",
        date: p.createdAt,
        relatedOrder: o._id,
        orderNumber: o.orderNumber,
        paymentMethod: "Wompi",
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      };
    }
    const m = p.m;
    const doc = {
      _id: newId(p.createdAt),
      reference,
      concept: m.concept,
      type: m.type,
      category: m.category,
      amount: m.amount,
      status: m.status,
      date: T.midnightUTC(m.dateKey),
      paymentMethod: m.paymentMethod,
      createdAt: p.createdAt,
      updatedAt: m.paidAt && m.paidAt > p.createdAt ? m.paidAt : p.createdAt,
    };
    if (m.status === "Pendiente" && m.dueKey) doc.dueDate = T.midnightUTC(m.dueKey);
    if (m.paidAt && m.status === "Completado") doc.paidAt = m.paidAt;
    return doc;
  });

  // ---- Materia prima y lotes diarios planificados ---------------------------------------------
  const firstOpen = T.nextOpenTime(T.svTime(startKey, 0));
  const rawMaterials = D.RAW_MATERIALS.map((r) => {
    const updatedAt = new Date(now.getTime() - rngMisc.int(1, 40) * 24 * 3600000);
    return {
      _id: newId(firstOpen),
      name: r.name,
      category: "Materia Prima",
      type: r.type,
      materialType: r.materialType,
      ...(r.color ? { color: r.color } : {}),
      unit: r.unit,
      stock: r.stock,
      minStock: r.minStock,
      unitCost: r.unitCost,
      location: rngMisc.pick(ctx.warehouses).name,
      createdAt: firstOpen,
      updatedAt: updatedAt < firstOpen ? firstOpen : updatedAt,
    };
  });

  const dailyBatches = [];
  {
    let key = todayKey;
    let n = 0;
    const created = new Date(now.getTime() - rngMisc.int(2, 20) * 3600000);
    for (let guard = 0; guard < 20 && dailyBatches.length < 8; guard += 1) {
      key = T.addDays(key, 1);
      if (!T.workWindow(key)) continue;
      const count = rngMisc.int(1, 2);
      for (let i = 0; i < count && dailyBatches.length < 8; i += 1) {
        const p = rngMisc.pick(activeProducts);
        const color = p.colors?.length ? rngMisc.pick(p.colors) : undefined;
        const d = prior.get(`${p.name}|${color || ""}`) || 100;
        n += 1;
        dailyBatches.push({
          _id: newId(created),
          dailyBatchNumber: `LTE-DIARIO-${String(n).padStart(4, "0")}`,
          date: T.midnightUTC(key),
          product: p.name,
          color,
          targetQuantity: Math.max(3000, roundTo(d * 12, 500)),
          createdAt: created,
          updatedAt: created,
        });
      }
    }
  }

  // ---- Contadores (el mayor número usado de cada secuencia) -------------------------------------
  const counters = [
    { _id: "ORD-2026", seq: sim.orders.length },
    { _id: "TRAN-2026", seq: transactions.length },
    { _id: "LOTE-2026", seq: sim.batches.length },
  ];

  // ---- Documentos listos para insertar ----------------------------------------------------------
  const stripSim = (o) => {
    const { _s, ...rest } = o;
    return rest;
  };
  const docs = {
    employees: await buildAll(M.Employee, employees, (e) => ({ ...stripSim(e), password: "pendiente" })),
    customers: await buildAll(M.Customer, customers, (c) => ({ ...stripSim(c), password: "pendiente" })),
    orders: await buildAll(M.Order, sim.orders),
    customerorders: await buildAll(M.CustomerOrder, sim.customerOrders),
    paymenttransactions: await buildAll(M.PaymentTransaction, sim.payments),
    transactions: await buildAll(M.Transaction, transactions),
    inventoryitems: await buildAll(M.InventoryItem, [...sim.inventory, ...rawMaterials]),
    productionbatches: await buildAll(M.ProductionBatch, sim.batches),
    dailybatches: await buildAll(M.DailyBatch, dailyBatches),
    routes: await buildAll(M.Route, sim.routes),
    counters: counters.map((c) => ({ ...c })),
  };

  const credentials = {
    employees: employees.map((e) => ({ id: String(e._id), name: `${e.name} ${e.lastName}`, email: e.email, department: e.department, position: e.position, password: e._s.plain })),
    customers: customers.map((c) => ({ id: String(c._id), email: c.email, password: c._s.plain })),
  };

  const meta = {
    seed,
    now,
    todayKey,
    startKey,
    stats: sim.stats,
    categoryNames,
    missingCategories,
    overspent,
    initialStock: new Map(sim.inventory.filter((i) => i.initial != null).map((i) => [String(i._id), i.initial])),
    ratios: finance.ratios,
    months: finance.months,
    salesByMonth: finance.salesByMonth,
    budgetSpend: spend,
    prior,
    notDelivered: sim.orders.filter((o) => o.status !== "Entregado").length,
  };
  return { docs, budgets, credentials, meta };
}

// Deja a la vista de «ahora» al menos un lote en proceso, uno detenido y algunos programados, y
// lotes completados por enviar, sin importar a qué hora se corra el script. Son lotes de stock que
// aún no mueven inventario.
function ensureVariety({ sim, rng, now, todayKey, ctx, newId, activeProducts }) {
  const byStatus = (s) => sim.batches.filter((b) => b.status === s);
  const lineNames = ctx.productionLines.filter((l) => l.active !== false).map((l) => l.name);
  const operator = () => sim.pickOperator(now)._id;
  const randomCombo = () => {
    const p = rng.pick(activeProducts);
    return { product: p.name, color: p.colors?.length ? rng.pick(p.colors) : undefined };
  };
  const busyLines = () => new Set(sim.batches.filter((b) => b.status === "En Proceso" || b.status === "Detenido").map((b) => b.productionLine));
  const freeLine = () => lineNames.find((n) => !busyLines().has(n)) || rng.pick(lineNames);
  const inject = (fields, createdAt) => {
    const batch = sim.newBatch({ category: "Diario", producedQuantity: 0, ...randomCombo(), targetQuantity: roundTo(rng.range(5000, 12000), 500), ...fields }, createdAt);
    return batch;
  };

  if (!byStatus("En Proceso").length) {
    const startedAt = new Date(now.getTime() - rng.int(100, 200) * MIN);
    inject({ status: "En Proceso", productionLine: freeLine(), operator: operator(), startedAt, startDate: T.midnightUTC(T.dayKeyOf(startedAt)) }, new Date(startedAt.getTime() - rng.int(60, 300) * MIN));
  }
  if (!byStatus("Detenido").length) {
    const startedAt = new Date(now.getTime() - rng.int(240, 400) * MIN);
    const stoppedAt = new Date(now.getTime() - rng.int(20, 90) * MIN);
    inject(
      { status: "Detenido", productionLine: freeLine(), operator: operator(), startedAt, stoppedAt, stopReason: rng.pick(D.STOP_REASONS), startDate: T.midnightUTC(T.dayKeyOf(startedAt)), updatedAt: stoppedAt },
      new Date(startedAt.getTime() - rng.int(60, 300) * MIN),
    );
  }
  const programmed = byStatus("Programado").filter((b) => b.category === "Diario");
  for (let i = programmed.length; i < 3; i += 1) {
    let key = todayKey;
    for (let k = 0; k < 6; k += 1) {
      key = T.addDays(key, 1);
      if (T.workWindow(key) && k >= i) break;
    }
    inject({ status: "Programado", startDate: T.midnightUTC(key) }, new Date(now.getTime() - rng.int(30, 300) * MIN));
  }
  const toSend = sim.batches.filter((b) => b.status === "Completado" && b.category === "Diario" && !b.sentToWarehouseAt);
  if (!toSend.length) {
    const completedAt = new Date(now.getTime() - rng.int(30, 180) * MIN);
    const startedAt = new Date(completedAt.getTime() - rng.int(120, 300) * MIN);
    const batch = inject(
      { status: "Completado", productionLine: freeLine(), operator: operator(), startedAt, completedAt, startDate: T.midnightUTC(T.dayKeyOf(startedAt)), updatedAt: completedAt },
      new Date(startedAt.getTime() - rng.int(60, 300) * MIN),
    );
    batch.producedQuantity = Math.round(batch.targetQuantity * rng.range(0.97, 1.03));
  }
}
