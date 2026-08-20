const dashboardController = {};

import Order from "../models/Order.js";
import ProductionBatch from "../models/ProductionBatch.js";
import InventoryItem from "../models/InventoryItem.js";
import Transaction from "../models/Transaction.js";

function dateMatch(field, from, to) {
  if (!from && !to) return {};
  const cond = {};
  if (from) cond.$gte = new Date(from);
  if (to) cond.$lte = new Date(to);
  return { [field]: cond };
}

dashboardController.getSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;

    // Fecha efectiva del lote: fecha de producción (startDate) o, si no hay, createdAt
    const inRange = (date) => {
      if (!fromD && !toD) return true;
      const d = new Date(date);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
      return true;
    };

    const [orders, allBatches, inventory, transactions] = await Promise.all([
      Order.find(dateMatch("createdAt", from, to)),
      ProductionBatch.find(),
      InventoryItem.find(), // el inventario es estado actual, no depende del rango
      Transaction.find(dateMatch("date", from, to)),
    ]);

    // Lotes dentro del rango, ordenados por fecha efectiva (más reciente primero)
    const batches = allBatches
      .filter((b) => inRange(b.startDate || b.createdAt))
      .sort(
        (a, b) =>
          new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt),
      );

    // --- Producción ---
    const producedTotal = batches.reduce((s, b) => s + (b.producedQuantity || 0), 0);

    // --- Pedidos ---
    const ordersInProgress = orders.filter(
      (o) => !["Entregado"].includes(o.status),
    ).length;
    const ordersReadyToShip = orders.filter((o) => o.status === "Empacado").length;

    // --- Finanzas ---
    const income = transactions
      .filter((t) => t.type === "Ingreso")
      .reduce((s, t) => s + t.amount, 0);

    // --- Mezcla de producción por producto (para la dona) ---
    const mix = {};
    for (const b of batches) {
      mix[b.product] = (mix[b.product] || 0) + (b.producedQuantity || 0);
    }
    const productionMix = Object.entries(mix).map(([label, value]) => ({ label, value }));

    // --- Alertas (stock bajo + lotes detenidos) ---
    const alerts = [];
    for (const item of inventory) {
      if (item.minStock > 0 && item.stock <= item.minStock) {
        alerts.push({
          tone: "yellow",
          text: `Stock bajo de ${item.name} (${item.stock} ${item.unit})`,
          meta: "Almacén",
        });
      }
    }
    for (const b of batches.filter((x) => x.status === "Detenido")) {
      alerts.push({
        tone: "red",
        text: `Lote ${b.batchNumber} detenido por control de calidad`,
        meta: b.productionLine || "Fabricación",
      });
    }

    res.json({
      kpis: {
        producedTotal,
        income,
        ordersInProgress,
        ordersReadyToShip,
      },
      recentBatches: batches.slice(0, 5),
      productionMix,
      alerts: alerts.slice(0, 5),
      counts: {
        orders: orders.length,
        batches: batches.length,
        inventory: inventory.length,
      },
    });
  } catch (error) {
    console.log("error" + error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default dashboardController;
