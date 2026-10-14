import * as T from "./time.js";
import * as D from "./data.js";

/*
  Compras de la tienda («intenciones»): cuándo compra quién y qué. Todavía no es el pedido: la
  simulación (sim.js) lo convierte en pedido, venta, fabricación y entrega. Esto solo depende de la
  semilla y de la fecha de hoy, no del estado del inventario.
*/

const DOW_FACTOR = { 0: 0.12, 1: 1, 2: 1.05, 3: 1.05, 4: 1, 5: 0.95, 6: 0.55 };
// Hora del día (0–23, El Salvador) en que entran las compras.
const HOUR_WEIGHTS = [0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.8, 1.6, 2.2, 2.4, 2.2, 1.6, 1.6, 2.0, 2.2, 2.0, 1.5, 1.0, 0.8, 0.7, 0.5, 0.3, 0.15];
const COLOR_WEIGHT = { Blanco: 1.3, Rojo: 1.2, Azul: 1.1, Negro: 1.0, Verde: 0.8, Amarillo: 0.8 };
const SCALE_VALUE = { small: 45, medium: 130, large: 360 };

// Factor de estacionalidad: más ventas en Semana Santa y en agosto, y tendencia levemente creciente.
export function seasonFactor(key, index, total) {
  let f = 1;
  if (key >= "2026-03-23" && key < T.HOLY_WEEK_START) f = 1.25;
  else if (key >= T.HOLY_WEEK_START && key <= T.HOLY_WEEK_END) f = 1.45;
  else if (key.startsWith("2026-08")) f = 1.35;
  else if (key.startsWith("2026-01")) f = 0.92;
  const trend = 0.9 + 0.25 * (total > 1 ? index / (total - 1) : 0);
  return f * trend;
}

function roundStep(qty) {
  const step = qty < 500 ? 50 : qty < 3000 ? 100 : qty < 10000 ? 500 : 1000;
  return Math.max(step, Math.round(qty / step) * step);
}

function makeLines(rng, customer, products) {
  const weights = [40, 32, 20, 8];
  const count = rng.weighted([1, 2, 3, 4], weights);
  const popularity = (p) => (/recta/i.test(p.name) ? 1.5 : /flexible/i.test(p.name) ? 1.1 : /ancha|mezclad/i.test(p.name) ? 0.75 : 1);
  const prefs = products.filter((p) => customer._s.prefs.includes(p.name));
  const lines = [];
  const seen = new Set();
  for (let guard = 0; lines.length < count && guard < 20; guard += 1) {
    const pool = prefs.length && rng.chance(0.85) ? prefs : products;
    const product = rng.weighted(pool, popularity);
    const colors = product.colors?.length ? product.colors : [undefined];
    const color = rng.weighted(colors, (c) => COLOR_WEIGHT[c] ?? 1);
    const key = `${product.name}|${color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = SCALE_VALUE[customer._s.scale] * Math.exp(rng.normal(0, 0.55));
    let quantity = roundStep(value / Math.max(product.price, 0.01));
    quantity = Math.min(60000, Math.max(product.minOrderQuantity || 1, quantity));
    lines.push({ product: product.name, color, quantity, unitPrice: product.price });
  }
  return lines;
}

export function makeIntents({ rng, customers, products, startKey, todayKey, now, baseRate = 7.2 }) {
  const days = T.daysBetween(startKey, todayKey);

  // Día de alta de cada cliente: la mayoría ya compraba a inicios de año; el resto se va sumando.
  const byRank = [...customers].sort((a, b) => a._s.rank - b._s.rank);
  byRank.forEach((c, i) => {
    let dayIndex;
    if (i < 12) dayIndex = rng.int(0, 13);
    else if (i < 55) dayIndex = rng.int(0, 21);
    else dayIndex = rng.int(14, Math.max(14, days.length - 1));
    c._s.regDay = days[Math.min(dayIndex, days.length - 1)];
  });
  const regByDay = new Map();
  for (const c of customers) {
    if (!regByDay.has(c._s.regDay)) regByDay.set(c._s.regDay, []);
    regByDay.get(c._s.regDay).push(c);
  }

  const registered = [];
  const intents = [];
  days.forEach((key, index) => {
    const dow = T.dowOf(key);
    let lambda = baseRate * DOW_FACTOR[dow] * seasonFactor(key, index, days.length);
    if (T.isHoliday(key)) lambda *= 0.4;
    const fresh = regByDay.get(key) || [];
    let n = Math.max(rng.poisson(lambda), fresh.length);
    const buyers = [...fresh];
    const pool = registered.slice();
    for (let i = buyers.length; i < n && pool.length; i += 1) buyers.push(rng.weighted(pool, (c) => c._s.weight));
    for (const customer of buyers) {
      const hour = rng.weighted([...HOUR_WEIGHTS.keys()], HOUR_WEIGHTS);
      const t0 = T.svTime(key, hour, rng.int(0, 59), rng.int(0, 59));
      // Las líneas se sortean aunque la compra sea posterior a «ahora»: así lo ya ocurrido sale igual en
      // cualquier corrida del mismo día.
      const lines = makeLines(rng, customer, products);
      if (t0 > now) continue;
      intents.push({ customer, t0, lines, key });
    }
    registered.push(...fresh);
  });
  intents.sort((a, b) => a.t0 - b.t0);

  // Una cuenta nueva existe desde un poco antes de su primera compra.
  const first = new Map();
  for (const it of intents) if (!first.has(it.customer)) first.set(it.customer, it);
  for (const [customer, it] of first) {
    customer.createdAt = new Date(Math.max(T.svTime(startKey, 0).getTime(), it.t0.getTime() - rng.int(2, 14) * 60000));
    customer.updatedAt = customer.createdAt;
  }
  // Los pedidos de un cliente nunca son anteriores a su alta (las compras siguientes salen de días posteriores).
  const kept = customers.filter((c) => first.has(c));
  return { intents, customers: kept };
}

export const NOTES = D.ORDER_NOTES;
