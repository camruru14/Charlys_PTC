import { fmtNumber, fmtTime, fmtDate, fmtRelativeDay } from "./format";
import { isBelowMinimum } from "./stockLevel";
import { dispatchInfo, isOrderDelivered } from "./logistics";
import { productLabel } from "./batchFlow";

/*
  Alertas del Dashboard, con las mismas reglas que las pantallas a las que
  enlazan (así lo que se ve al entrar coincide con la alerta):
    - Lote Detenido                       → /fabricacion?id=<lote>
    - Producto terminado bajo mínimo      → /inventario?tab=terminado&bajoMinimo=1
    - Pedido incompleto en una ruta que
      todavía no sale (Pendiente/Recolectando) → /logistica?tab=despacho&ruta=<ruta>
  Cada alerta: { key, tone, title, detail, to }.
*/

const OPEN_ROUTE = ["Pendiente", "Recolectando"];

// «desde las 11:40» si fue hoy; si no, «desde el 12 sep».
function since(value) {
  if (!value) return "";
  return fmtRelativeDay(value) === "hoy" ? ` desde las ${fmtTime(value)}` : ` desde el ${fmtDate(value)}`;
}

function stoppedAlerts(batches) {
  return batches
    .filter((b) => b.status === "Detenido")
    .map((b) => ({
      key: `lote-${b._id}`,
      tone: "rose",
      title: b.productionLine
        ? `${b.productionLine} detenida${since(b.stoppedAt)}`
        : `Lote ${b.batchNumber} detenido${since(b.stoppedAt)}`,
      detail: [b.batchNumber, productLabel(b), b.stopReason].filter(Boolean).join(" · "),
      to: `/fabricacion?id=${b._id}`,
    }));
}

function lowStockAlerts(inventory) {
  return inventory
    .filter((i) => !i.batchNumber && i.category === "Producto Terminado" && isBelowMinimum(i))
    .map((i) => ({
      key: `stock-${i._id}`,
      tone: "rose",
      title: `${[i.name, i.color].filter(Boolean).join(" ")} bajo mínimo`,
      detail: [`${fmtNumber(i.stock)} ${i.unit || ""}`.trim(), i.location].filter(Boolean).join(" · "),
      to: "/inventario?tab=terminado&bajoMinimo=1",
    }));
}

function incompleteAlerts(orders) {
  return orders
    .filter((o) => {
      const route = o.delivery?.route;
      return route && typeof route === "object" && OPEN_ROUTE.includes(route.status) && !isOrderDelivered(o) && !dispatchInfo(o).ready;
    })
    .map((o) => {
      const info = dispatchInfo(o);
      const route = o.delivery.route;
      return {
        key: `pedido-${o._id}`,
        tone: "amber",
        title: `${o.orderNumber} incompleto en Ruta ${route.number ?? "—"}`,
        detail: [`faltan ${info.missing} de ${info.total}`, info.detail].filter(Boolean).join(" · "),
        to: `/logistica?tab=despacho&ruta=${route._id}`,
      };
    });
}

export function dashboardAlerts({ batches = [], inventory = [], orders = [] }) {
  return [...stoppedAlerts(batches), ...lowStockAlerts(inventory), ...incompleteAlerts(orders)];
}
