import { formatNumber, formatClock, formatShortDate, formatRelativeDay } from "./format";
import { isBelowMinimum } from "./stockLevel";
import { dispatchInfo, isOrderDelivered } from "./logistics";
import { productLabel } from "./batchFlow";

// Alertas del Dashboard, portadas de
// Web/private/frontend/src/lib/dashboardAlerts.js, con las mismas reglas que
// las pantallas a las que llevan:
//   - Lote Detenido                                  → Fabricación
//   - Producto terminado bajo mínimo                 → Inventario
//   - Pedido incompleto en una ruta que todavía no
//     sale (Pendiente/Recolectando)                  → Logística
// Cada alerta: { key, kind, tone, title, detail, screen }. `kind` elige el
// ícono en DashboardScreen; `screen` es la ruta del drawer.
const OPEN_ROUTE = ["Pendiente", "Recolectando"];

// «desde las 11:40» si fue hoy; si no, «desde el 12 sep».
function since(value) {
  if (!value) return "";
  return formatRelativeDay(value) === "hoy" ? ` desde las ${formatClock(value)}` : ` desde el ${formatShortDate(value)}`;
}

function stoppedAlerts(batches) {
  return batches
    .filter((b) => b.status === "Detenido")
    .map((b) => ({
      key: `lote-${b._id}`,
      kind: "stopped",
      tone: "rose",
      title: b.productionLine
        ? `${b.productionLine} detenida${since(b.stoppedAt)}`
        : `Lote ${b.batchNumber} detenido${since(b.stoppedAt)}`,
      detail: [b.batchNumber, productLabel(b), b.stopReason].filter(Boolean).join(" · "),
      screen: "Fabricacion",
    }));
}

// La unidad por defecto de un artículo es «unidad»: en plural si no es 1.
const unitLabel = (unit, n) => (unit === "unidad" && Number(n) !== 1 ? "unidades" : unit || "");

function lowStockAlerts(inventory) {
  return inventory
    .filter((i) => !i.batchNumber && i.category === "Producto Terminado" && isBelowMinimum(i))
    .map((i) => ({
      key: `stock-${i._id}`,
      kind: "lowStock",
      tone: "rose",
      title: `${[i.name, i.color].filter(Boolean).join(" ")} bajo mínimo`,
      detail: [`${formatNumber(i.stock)} ${unitLabel(i.unit, i.stock)}`.trim(), i.location].filter(Boolean).join(" · "),
      screen: "Inventario",
    }));
}

function incompleteAlerts(orders) {
  return orders
    .filter((o) => {
      const route = o.delivery?.route;
      return (
        route &&
        typeof route === "object" &&
        OPEN_ROUTE.includes(route.status) &&
        !isOrderDelivered(o) &&
        !dispatchInfo(o).ready
      );
    })
    .map((o) => {
      const info = dispatchInfo(o);
      const route = o.delivery.route;
      return {
        key: `pedido-${o._id}`,
        kind: "incomplete",
        tone: "amber",
        title: `${o.orderNumber} incompleto en Ruta ${route.number ?? "—"}`,
        detail: [`faltan ${info.missing} de ${info.total}`, info.detail].filter(Boolean).join(" · "),
        screen: "Logistica",
      };
    });
}

export function dashboardAlerts({ batches = [], inventory = [], orders = [] }) {
  return [...stoppedAlerts(batches), ...lowStockAlerts(inventory), ...incompleteAlerts(orders)];
}
