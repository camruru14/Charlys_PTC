const dashboardController = {};

import Order from "../models/Order.js";
import ProductionBatch from "../models/ProductionBatch.js";
import Transaction from "../models/Transaction.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import Route from "../models/Route.js";

/*
  GET /api/dashboard?from=&to= — resumen ejecutivo: KPIs con su período anterior, mini series,
  ventas y gastos de 12 meses, ventas por producto, producción diaria, pedidos activos y gastos por
  categoría. Todo sale de datos que ya existen (pedidos, lotes de fabricación, transacciones, rutas).

  FECHAS. Los días se cuentan en el calendario de la empresa (El Salvador, UTC−6, sin horario de
  verano), no en el del servidor (UTC en Render). Igual que Finanzas (lib/transactionFilters.js):
    · una venta de la tienda guarda el instante real del pago  -> su día es el día local de ese instante;
    · un movimiento manual guarda `date` como medianoche UTC (fecha sin hora) -> su día es su fecha UTC;
    · un lote usa su fecha efectiva (startDate, medianoche UTC, o si no hay, createdAt) con el mismo criterio.
  El rango que llega (`from`/`to`, instantes del navegador) se convierte a días locales «AAAA-MM-DD» y
  todo se compara por día. Sin `from`/`to` («Todo») se usan los últimos 12 meses calendario.

  PERÍODO ANTERIOR. El de la misma duración justo antes del rango. Si el rango es UN mes calendario
  completo, se compara contra el mes anterior: contra el mismo número de días si el mes está en curso
  (1–31 oct con hoy 13 -> 1–13 sep) o contra el mes completo si ya terminó. Sin rango no hay anterior.

  ENTREGA A TIEMPO. Al entregar, el pedido pasa a dispatchStatus «Entregado» y el «Demorado» se pierde,
  pero conserva delivery.route. Un pedido entregado cuenta como a tiempo si su dispatchStatus no fue
  «Demorado» y su ruta no quedó marcada `delayed` (Route.delayed).
*/

const TZ = "America/El_Salvador";
const TZ_OFFSET = "-06:00";
const WEEK_THRESHOLD = 62; // rangos de más días: las mini series van por semana
const TOP = 5;
const ACTIVE_STATUSES = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito"];

// ---- Días «AAAA-MM-DD» del calendario de la empresa -------------------------------------------
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKeyOf = (date) => DAY_FORMAT.format(date);
const keyToUtc = (key) => new Date(`${key}T00:00:00Z`);
const utcToKey = (date) => date.toISOString().slice(0, 10);
const startInstant = (key) => new Date(`${key}T00:00:00.000${TZ_OFFSET}`);
const endInstant = (key) => new Date(`${key}T23:59:59.999${TZ_OFFSET}`);

function addDays(key, n) {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}
const diffDays = (a, b) => Math.round((keyToUtc(b) - keyToUtc(a)) / 86400000);
const monthStart = (key) => `${key.slice(0, 7)}-01`;
function addMonths(key, n) {
  const d = keyToUtc(monthStart(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return utcToKey(d);
}
const monthEnd = (key) => addDays(addMonths(key, 1), -1);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Rango pedido y período anterior, en días locales. null si los parámetros no son válidos.
function resolvePeriods(fromQuery, toQuery, now = new Date()) {
  const todayKey = dayKeyOf(now);
  if (!fromQuery && !toQuery) {
    const toKey = monthEnd(todayKey);
    return { all: true, todayKey, fromKey: addMonths(todayKey, -11), toKey, previous: null };
  }
  const from = new Date(fromQuery);
  const to = new Date(toQuery);
  if (!fromQuery || !toQuery || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  const fromKey = dayKeyOf(from);
  const toKey = dayKeyOf(to);

  let previous;
  if (fromKey === monthStart(fromKey) && toKey === monthEnd(fromKey)) {
    const prevFrom = addMonths(fromKey, -1);
    const inProgress = fromKey <= todayKey && todayKey < toKey;
    const days = inProgress ? diffDays(fromKey, todayKey) + 1 : diffDays(fromKey, toKey) + 1;
    const prevTo = addDays(prevFrom, days - 1);
    previous = { fromKey: prevFrom, toKey: prevTo < monthEnd(prevFrom) ? prevTo : monthEnd(prevFrom) };
  } else {
    const span = diffDays(fromKey, toKey) + 1;
    const prevTo = addDays(fromKey, -1);
    previous = { fromKey: addDays(prevTo, -(span - 1)), toKey: prevTo };
  }
  return { all: false, todayKey, fromKey, toKey, previous };
}

// Casilleros de las mini series: uno por día, o por semana si el rango es largo. Termina en
// min(fin del rango, hoy) para no arrastrar ceros del futuro.
function makeBuckets(fromKey, toKey, todayKey) {
  const weekly = diffDays(fromKey, toKey) + 1 > WEEK_THRESHOLD;
  const endKey = toKey < todayKey ? toKey : todayKey;
  const span = endKey < fromKey ? 0 : diffDays(fromKey, endKey) + 1;
  const length = weekly ? Math.ceil(span / 7) : span;
  const indexOf = (day) => {
    if (day < fromKey || day > endKey) return -1;
    const offset = diffDays(fromKey, day);
    return weekly ? Math.floor(offset / 7) : offset;
  };
  return { weekly, length, indexOf };
}

const zeros = (n) => Array.from({ length: n }, () => 0);

// Top N + «Otros»: `merge` junta las filas que quedan fuera.
function topWithRest(rows, merge, restLabel) {
  if (rows.length <= TOP) return rows;
  return [...rows.slice(0, TOP), merge(rows.slice(TOP), restLabel)];
}

dashboardController.getSummary = async (req, res) => {
  try {
    const now = new Date();
    const periods = resolvePeriods(req.query.from, req.query.to, now);
    if (!periods) return res.status(400).json({ message: "El rango de fechas no es válido" });
    const { all, todayKey, fromKey, toKey, previous } = periods;
    const fromI = startInstant(fromKey);
    const toI = endInstant(toKey);

    // Meses del gráfico: 12 meses calendario que terminan en el mes de `to`.
    const lastMonthKey = monthStart(toKey);
    const monthKeys = Array.from({ length: 12 }, (_, i) => addMonths(lastMonthKey, i - 11).slice(0, 7));
    const windowFrom = [previous?.fromKey, fromKey, `${monthKeys[0]}-01`].filter(Boolean).sort()[0];
    const windowTo = monthEnd(toKey);

    const dayExpr = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: field } });
    const lo = (key) => startInstant(addDays(key, -2));
    const hi = (key) => endInstant(addDays(key, 2));

    const [txRows, batchRows, salesLines, activeRows, deliveredOrders, categories] = await Promise.all([
      // Ingresos y gastos completados por día, tipo, venta y categoría (agrupados en la base).
      Transaction.aggregate([
        { $match: { status: "Completado", date: { $gte: lo(windowFrom), $lte: hi(windowTo) } } },
        {
          $addFields: {
            sale: {
              $or: [
                { $eq: [{ $type: "$relatedOrder" }, "objectId"] },
                { $and: [{ $eq: [{ $type: "$orderNumber" }, "string"] }, { $ne: ["$orderNumber", ""] }] },
              ],
            },
          },
        },
        { $addFields: { day: { $cond: ["$sale", { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: TZ } }, dayExpr("$date")] } } },
        { $match: { day: { $gte: windowFrom, $lte: windowTo } } },
        { $group: { _id: { day: "$day", type: "$type", sale: "$sale", category: "$category" }, amount: { $sum: "$amount" } } },
      ]),
      // Producción por día (fecha efectiva del lote: startDate o, si no hay, createdAt).
      ProductionBatch.aggregate([
        { $match: { $or: [{ startDate: { $gte: lo(fromKey), $lte: hi(toKey) } }, { createdAt: { $gte: lo(fromKey), $lte: hi(toKey) } }] } },
        {
          $addFields: {
            day: {
              $cond: [{ $eq: [{ $type: "$startDate" }, "date"] }, dayExpr("$startDate"), { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } }],
            },
          },
        },
        { $match: { day: { $gte: fromKey, $lte: toKey } } },
        { $group: { _id: "$day", produced: { $sum: "$producedQuantity" }, target: { $sum: "$targetQuantity" } } },
        { $sort: { _id: 1 } },
      ]),
      // Ventas por producto: líneas de los pedidos creados en el rango.
      Order.aggregate([
        { $match: { createdAt: { $gte: fromI, $lte: toI } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", amount: { $sum: "$items.subtotal" }, orders: { $addToSet: "$_id" } } },
        { $sort: { amount: -1 } },
      ]),
      // Pedidos activos ahora mismo, sin importar el rango.
      Order.aggregate([{ $match: { status: { $in: ACTIVE_STATUSES } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      // Entregados en el rango (delivery.deliveredAt; sin él, el último «Entregado» del historial).
      Order.find({
        status: "Entregado",
        $or: [
          { "delivery.deliveredAt": { $gte: fromI, $lte: toI } },
          { "delivery.deliveredAt": { $exists: false }, statusHistory: { $elemMatch: { status: "Entregado", at: { $gte: fromI, $lte: toI } } } },
        ],
      })
        .select("createdAt delivery.deliveredAt delivery.dispatchStatus delivery.route statusHistory")
        .lean(),
      ExpenseCategory.find().select("name icon color").lean(),
    ]);

    // ---- Transacciones -> KPIs, series, meses y categorías --------------------------------
    const buckets = makeBuckets(fromKey, toKey, todayKey);
    const sparks = { sales: zeros(buckets.length), net: zeros(buckets.length), units: zeros(buckets.length), onTime: [] };
    const totals = { income: 0, sales: 0, expense: 0 };
    const prevTotals = { income: 0, sales: 0, expense: 0 };
    const months = new Map(monthKeys.map((m) => [m, { month: m, income: 0, expense: 0 }]));
    const byCategory = new Map();
    const inside = (day, a, b) => day >= a && day <= b;

    for (const row of txRows) {
      const { day, type, sale, category } = row._id;
      const amount = row.amount;
      const month = months.get(day.slice(0, 7));
      if (month) month[type === "Ingreso" ? "income" : "expense"] += amount;

      if (inside(day, fromKey, toKey)) {
        const index = buckets.indexOf(day);
        if (type === "Ingreso") {
          totals.income += amount;
          if (sale) totals.sales += amount;
          if (index >= 0) {
            sparks.net[index] += amount;
            if (sale) sparks.sales[index] += amount;
          }
        } else {
          totals.expense += amount;
          if (index >= 0) sparks.net[index] -= amount;
          const name = category || "Sin categoría";
          byCategory.set(name, (byCategory.get(name) || 0) + amount);
        }
      }
      if (previous && inside(day, previous.fromKey, previous.toKey)) {
        if (type === "Ingreso") {
          prevTotals.income += amount;
          if (sale) prevTotals.sales += amount;
        } else {
          prevTotals.expense += amount;
        }
      }
    }

    // ---- Producción ------------------------------------------------------------------------
    let unitsProduced = 0;
    let unitsTarget = 0;
    for (const row of batchRows) {
      unitsProduced += row.produced;
      unitsTarget += row.target;
      const index = buckets.indexOf(row._id);
      if (index >= 0) sparks.units[index] += row.produced;
    }

    // ---- Entregas --------------------------------------------------------------------------
    const routeIds = [...new Set(deliveredOrders.map((o) => o.delivery?.route).filter(Boolean).map(String))];
    const routes = routeIds.length ? await Route.find({ _id: { $in: routeIds } }).select("delayed").lean() : [];
    const delayedRoutes = new Set(routes.filter((r) => r.delayed).map((r) => String(r._id)));

    const deliveredCount = zeros(buckets.length);
    const onTimeCount = zeros(buckets.length);
    let delivered = 0;
    let deliveredOnTime = 0;
    let daysTotal = 0;
    for (const order of deliveredOrders) {
      const lastDelivered = [...(order.statusHistory || [])].reverse().find((h) => h.status === "Entregado");
      const at = order.delivery?.deliveredAt || lastDelivered?.at;
      if (!at) continue;
      const onTime = order.delivery?.dispatchStatus !== "Demorado" && !delayedRoutes.has(String(order.delivery?.route));
      delivered += 1;
      if (onTime) deliveredOnTime += 1;
      daysTotal += Math.max(0, (new Date(at) - new Date(order.createdAt)) / 86400000);
      const index = buckets.indexOf(dayKeyOf(new Date(at)));
      if (index >= 0) {
        deliveredCount[index] += 1;
        if (onTime) onTimeCount[index] += 1;
      }
    }
    // % de entregas a tiempo por casillero; null si ese día/semana no hubo entregas.
    sparks.onTime = deliveredCount.map((n, i) => (n ? Math.round((onTimeCount[i] / n) * 100) : null));

    // ---- Ventas por producto: top 5 + «Otros» --------------------------------------------------
    const productRows = salesLines.map((r) => ({ product: r._id || "Sin producto", amount: round2(r.amount), orderIds: r.orders.map(String) }));
    const salesByProduct = topWithRest(
      productRows,
      (rest, label) => ({
        product: label,
        amount: round2(rest.reduce((s, r) => s + r.amount, 0)),
        orderIds: [...new Set(rest.flatMap((r) => r.orderIds))],
      }),
      "Otros",
    ).map(({ product, amount, orderIds }) => ({ product, amount, orders: orderIds.length }));

    // ---- Gastos por categoría: top 5 + «Otras» ---------------------------------------------------
    const style = new Map(categories.map((c) => [c.name, c]));
    const expenseRows = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount: round2(amount), icon: style.get(category)?.icon || "tag", color: style.get(category)?.color || "gray" }));
    const expensesByCategory = topWithRest(
      expenseRows,
      (rest, label) => ({ category: label, amount: round2(rest.reduce((s, r) => s + r.amount, 0)), icon: "tag", color: "gray" }),
      "Otras",
    );

    // ---- Respuesta -------------------------------------------------------------------------------
    const net = totals.income - totals.expense;
    const activeCount = new Map(activeRows.map((r) => [r._id, r.count]));

    res.json({
      range: {
        from: fromI.toISOString(),
        to: toI.toISOString(),
        previousFrom: previous ? startInstant(previous.fromKey).toISOString() : null,
        previousTo: previous ? endInstant(previous.toKey).toISOString() : null,
        all,
        granularity: buckets.weekly ? "week" : "day",
      },
      kpis: {
        sales: round2(totals.sales),
        salesPrevious: previous ? round2(prevTotals.sales) : null,
        net: round2(net),
        netPrevious: previous ? round2(prevTotals.income - prevTotals.expense) : null,
        margin: totals.income > 0 ? net / totals.income : null,
        unitsProduced,
        unitsTarget,
        delivered,
        deliveredOnTime,
        avgDeliveryDays: delivered ? Math.round((daysTotal / delivered) * 10) / 10 : 0,
      },
      sparks: {
        sales: sparks.sales.map(round2),
        net: sparks.net.map(round2),
        units: sparks.units,
        onTime: sparks.onTime,
      },
      monthly: monthKeys.map((m) => {
        const row = months.get(m);
        return { month: m, income: round2(row.income), expense: round2(row.expense), partial: monthEnd(`${m}-01`) >= todayKey };
      }),
      salesByProduct,
      salesOrders: new Set(productRows.flatMap((r) => r.orderIds)).size,
      dailyProduction: batchRows.map((r) => ({ date: r._id, produced: r.produced, target: r.target })),
      activeOrders: ACTIVE_STATUSES.map((status) => ({ status, count: activeCount.get(status) || 0 })),
      expensesByCategory,
    });
  } catch (error) {
    console.log("error" + error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default dashboardController;
