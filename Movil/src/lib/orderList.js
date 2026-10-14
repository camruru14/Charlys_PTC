import { formatClock, formatShortDate, formatWhen } from "./format";
import { lastStatusAt } from "./inventoryOrders";
import { sinceText } from "./batchFlow";
import { routeLabel } from "./logistics";

// Pedidos (vista general de la tienda) agrupados por estado, como
// Web/private/frontend/src/lib/orderList.js. `status` es el estado del pedido
// (dominio «pedido»); `sort`: «created» = el más antiguo en llegar primero
// (createdAt), «asc»/«desc» = por la fecha del último cambio de estado.
// `ranged`: solo «Entregado» se filtra por el rango de fechas (por la fecha
// de entrega); los pedidos no entregados se ven siempre. `key` identifica el
// estado elegido.
export const PEDIDO_GROUPS = [
  { key: "pendiente", status: "Pendiente", label: "Pendientes", note: "aún no pasan a Inventario", sort: "created" },
  { key: "procesando", status: "Procesando", label: "Procesando", note: "Inventario los está preparando", sort: "created" },
  { key: "fabricacion", status: "En Fabricación", label: "En fabricación", note: "esperan lotes de Fabricación", sort: "created" },
  { key: "empacado", status: "Empacado", label: "Empacados", note: "esperan salir a ruta", sort: "asc" },
  { key: "transito", status: "En Tránsito", label: "En tránsito", note: "en camino al cliente", sort: "asc" },
  { key: "entregado", status: "Entregado", label: "Entregados", note: "más recientes primero", sort: "desc", ranged: true },
];

const ms = (value) => {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

// Fecha de entrega: el último registro «Entregado» del historial o, sin él, el
// último cambio de estado.
export function deliveredAt(order) {
  const history = order.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) if (history[i].status === "Entregado") return history[i].at;
  return lastStatusAt(order);
}

// Fecha del último cambio de estado que ordena y anota cada grupo.
const statusTime = (order) => (order.status === "Entregado" ? deliveredAt(order) : lastStatusAt(order));

// N° de pedido, cliente o correo.
export function matchesOrderSearch(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${order.orderNumber || ""} ${order.customer?.name || ""} ${order.customer?.email || ""}`.toLowerCase().includes(q);
}

// ¿El pedido se ve con el rango de fechas? Solo «Entregado» se filtra.
export function inOrderRange(order, group, range) {
  if (!group.ranged || !range?.from || !range?.to) return true;
  const at = ms(statusTime(order));
  return !at || (at >= range.from.getTime() && at <= range.to.getTime());
}

// Pedidos por grupo, en el orden de PEDIDO_GROUPS y con el orden de cada uno.
// Devuelve [{ ...grupo, items }], incluidos los vacíos.
export function groupOrders(orders, range) {
  const byStatus = new Map(PEDIDO_GROUPS.map((g) => [g.status, []]));
  for (const o of orders) byStatus.get(o.status)?.push(o);
  return PEDIDO_GROUPS.map((group) => {
    const key = group.sort === "created" ? (o) => ms(o.createdAt) : (o) => ms(statusTime(o));
    const items = byStatus.get(group.status).filter((o) => inOrderRange(o, group, range));
    items.sort((a, b) => (group.sort === "desc" ? key(b) - key(a) : key(a) - key(b)));
    return { ...group, items };
  });
}

// Nota de tiempo de la tarjeta de un pedido: { text, tone, bold } (tone:
// «amber» o null = gris).
//   Pendiente, Procesando y En Fabricación: «llegó hace 3 h», «llegó ayer 11:40»
//   (ámbar y negrita pasadas 24 h en Pendiente, pasados 2 días en los otros dos)
//   · Empacado: «empacado hoy 09:30» · En Tránsito: «salió 08:05 · R-2026-0048»
//   · Entregado: «entregado 11 oct».
export function orderTimeNote(order, now = new Date()) {
  const { status } = order;
  if (status === "Pendiente" || status === "Procesando" || status === "En Fabricación") {
    const text = sinceText(order.createdAt, now);
    if (!text) return null;
    const late = status === "Pendiente" ? now - new Date(order.createdAt) > 86400000 : formatWhen(order.createdAt, now).days > 2;
    return { text: `llegó ${text}`, tone: late ? "amber" : null, bold: late };
  }
  if (status === "Empacado") {
    const when = formatWhen(lastStatusAt(order), now);
    return when ? { text: `empacado ${when.text}`, tone: null, bold: false } : null;
  }
  if (status === "En Tránsito") {
    const at = lastStatusAt(order);
    const when = formatWhen(at, now);
    if (!when) return null;
    const route = order.delivery?.route;
    const code = route?.code || route?.number != null ? routeLabel(route) : null;
    const time = when.days === 0 ? formatClock(at) : when.text;
    return { text: `salió ${time}${code ? ` · ${code}` : ""}`, tone: null, bold: false };
  }
  if (status === "Entregado") {
    const at = deliveredAt(order);
    return at ? { text: `entregado ${formatShortDate(at)}`, tone: null, bold: false } : null;
  }
  return null;
}
