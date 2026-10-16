const ordersController = {};

import orderModel from "../models/Order.js";
import transactionModel from "../models/Transaction.js";
import routeModel from "../models/Route.js";
import customerOrderModel from "../models/CustomerOrder.js";
import { setOrderStatus, computeOrderStatus } from "../lib/orderStatus.js";
import { HttpError, sendError, withTransaction } from "../lib/stock.js";
import { recordFor, resolveActivity } from "../lib/activity.js";
import { assertId } from "../lib/ids.js";
import { ACTIVITY_KEYS } from "../lib/activityKeys.js";
import {
  verifyLine,
  unverifyLine,
  packLine,
  unpackLine,
  sendLineToManufacturing,
  cancelLineManufacturing,
  splitLine,
  unsplitLine,
  packManufacturedLine,
  unpackManufacturedLine,
} from "../lib/orderLines.js";

// Campos del lote que se incluyen al poblar items.manufacturingBatch (la
// flecha desplegable de Inventario > Pedidos muestra meta y producido).
const BATCH_FIELDS = "batchNumber status targetQuantity producedQuantity";
// Campos de la ruta de Logística al poblar delivery.route («Zona · Ruta N»).
const ROUTE_FIELDS = "code number zone status date";

// Carga un pedido y una de sus líneas dentro de una transacción, aplica
// `fn` sobre la línea, recalcula el status y guarda. Todo o nada: si `fn`
// lanza (estado inválido, stock insuficiente, lote ya en proceso), no se
// aplica ningún movimiento de stock ni de lotes.
// `track({ order, item, statusBefore })` (opcional) devuelve { keys, action } con las
// pestañas que ven la novedad (burbujas, lib/activity.js), o null si no hay. Por
// defecto el registro es el pedido; puede traer entityType/entityId (p. ej. el
// lote) y devolver una lista de novedades. Una entrada `{ resolve: [claves] }` quita
// esas claves de las novedades del pedido (ya no se ve ahí: resolveActivity). Se
// registra cuando la transacción ya se confirmó.
function lineAction(fn, okMessage, track) {
  return async (req, res) => {
    try {
      let saved;
      await withTransaction(async (session) => {
        const order = await orderModel.findById(req.params.id).session(session);
        if (!order) throw new HttpError(404, "Pedido no encontrado");
        const index = Number(req.params.index);
        const item = Number.isInteger(index) ? order.items[index] : undefined;
        if (!item) throw new HttpError(404, "Producto del pedido no encontrado");

        const statusBefore = order.status;
        await fn({ order, item, index, body: req.body || {}, session });

        order.markModified("items");
        setOrderStatus(order, computeOrderStatus(order));
        await order.save({ session });
        saved = { order, item, statusBefore };
      });
      const activity = track?.(saved);
      for (const entry of [activity].flat().filter(Boolean)) {
        if (entry.resolve) await resolveActivity({ keys: entry.resolve, entityId: saved.order._id });
        else await recordFor(req, { entityType: "order", entityId: saved.order._id, ...entry });
      }
      // `order`: el pedido actualizado (poblado como en GET /orders).
      res.json({ message: okMessage, order: await populateOrder(orderModel.findById(req.params.id)) });
    } catch (error) {
      sendError(res, error);
    }
  };
}

// Tras deshacer un envío a fabricación: ¿le queda alguna línea en fabricación al pedido?
const noManufacturingLeft = ({ order }) =>
  (order.items || []).some((i) => i.sentToManufacturing)
    ? { keys: ["fabricacion.pedidos"], action: "manufacturing-cancelled" }
    : { resolve: ["fabricacion.pedidos"] };

// El pedido acaba de quedar Empacado completo: Logística ya puede despacharlo.
const packedComplete = ({ order, statusBefore }) =>
  order.status === "Empacado" && statusBefore !== "Empacado" ? { keys: ["logistica.despacho", "pedidos"], action: "packed" } : null;

// Pedido con las mismas referencias pobladas que GET /orders, para que el
// panel pueda reemplazarlo en su lista sin volver a pedirla completa.
const populateOrder = (query) =>
  query
    .populate("delivery.driver", "name lastName phone photo")
    .populate("items.manufacturingBatch", BATCH_FIELDS)
    .populate("delivery.route", ROUTE_FIELDS);

// SELECT - todos los pedidos
ordersController.getOrders = async (req, res) => {
  try {
    const orders = await populateOrder(orderModel.find()).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    sendError(res, error);
  }
};

// SELECT - un pedido por id
ordersController.getOrder = async (req, res) => {
  try {
    assertId(req.params.id);
    const order = await populateOrder(orderModel.findById(req.params.id));
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    res.json(order);
  } catch (error) {
    sendError(res, error);
  }
};

// ELIMINAR (solo administradores, ver routes/orders.js). Es la única
// modificación que el panel hace sobre un pedido: los pedidos llegan de la
// tienda en línea, y este borrado evita que los ya entregados se acumulen.
// Solo se elimina un pedido «Entregado» que no esté en una ruta activa (su
// ruta está Completada o no tiene ruta). Todo en una transacción:
//  - Rutas: se quita el pedido de `orders` y `deliveries`; la ruta se conserva.
//  - Finanzas: el Ingreso NO se borra (la venta ocurrió): pierde relatedOrder y
//    conserva el N° de pedido en `orderNumber`.
//  - Lotes de fabricación: se conservan (el vínculo vivía en la línea del pedido).
//  - Tienda: el CustomerOrder se conserva con un resumen del pedido, para que el
//    cliente lo siga viendo en «Mis pedidos».
//  - Inventario: no se devuelve existencia (ya se entregó).
ordersController.deleteOrder = async (req, res) => {
  try {
    let deletedId;
    await withTransaction(async (session) => {
      const order = await orderModel.findById(req.params.id).session(session);
      if (!order) throw new HttpError(404, "Pedido no encontrado");
      if (order.status !== "Entregado") throw new HttpError(409, "Solo se pueden eliminar pedidos entregados");

      // Rutas donde aparece (como parada o como entrega, incluidas las parciales).
      const routes = await routeModel
        .find({ $or: [{ orders: order._id }, { "deliveries.order": order._id }] })
        .session(session);
      if (routes.some((r) => r.status !== "Completada")) throw new HttpError(409, "El pedido está en una ruta activa");

      const at = new Date();
      for (const route of routes) {
        route.orders = route.orders.filter((id) => String(id) !== String(order._id));
        route.deliveries = route.deliveries.filter((d) => String(d.order) !== String(order._id));
        await route.save({ session });
      }

      await transactionModel.updateMany(
        { relatedOrder: order._id },
        { $unset: { relatedOrder: 1 }, $set: { orderNumber: order.orderNumber } },
        { session },
      );

      await customerOrderModel.updateMany(
        { order: order._id },
        { $set: { deletedAt: at, snapshot: orderSnapshot(order) } },
        { session },
      );

      await orderModel.deleteOne({ _id: order._id }, { session });
      deletedId = order._id;
    });
    // El pedido ya no existe: ninguna de sus novedades (en cualquier pestaña) tiene nada que abrir.
    await resolveActivity({ keys: ACTIVITY_KEYS, entityId: deletedId });
    res.json({ message: "Order deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

// Resumen del pedido que se le deja a la tienda al eliminarlo (lo que
// «Mis pedidos» y la confirmación muestran): sin datos internos de bodegas,
// lotes ni rutas.
function orderSnapshot(order) {
  return {
    orderNumber: order.orderNumber,
    customer: order.customer?.toObject ? order.customer.toObject() : order.customer,
    items: (order.items || []).map((i) => ({
      product: i.product,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
    total: order.total,
    status: order.status,
    source: order.source,
    notes: order.notes,
    paymentDemo: Boolean(order.paymentDemo),
    statusHistory: (order.statusHistory || []).map((h) => ({ status: h.status, at: h.at })),
    createdAt: order.createdAt,
  };
}

// Verificar un producto: toma toda la cantidad de la bodega elegida.
ordersController.verifyOrderItem = lineAction(
  ({ item, body, session }) => verifyLine(item, body.warehouse, session),
  "Order item verified",
  () => ({ keys: ["pedidos"], action: "verified" }),
);

// Deshacer verificar: devuelve el stock a su bodega (solo si no está empacado).
ordersController.unverifyOrderItem = lineAction(
  ({ item, session }) => unverifyLine(item, session),
  "Order item unverified",
);

// Verificar varias líneas de uno o varios pedidos, todo o nada.
// Body: { orders: [{ id, items: [{ index, warehouse }] }] }
ordersController.verifyBulk = async (req, res) => {
  try {
    const requested = Array.isArray(req.body?.orders) ? req.body.orders : [];
    if (requested.length === 0) throw new HttpError(400, "No hay productos para verificar");

    const ids = await withTransaction(async (session) => {
      const touched = [];
      for (const entry of requested) {
        const order = await orderModel.findById(entry.id).session(session);
        if (!order) throw new HttpError(404, "Pedido no encontrado");
        for (const line of entry.items || []) {
          const index = Number(line.index);
          const item = Number.isInteger(index) ? order.items[index] : undefined;
          if (!item) throw new HttpError(404, `Producto no encontrado en ${order.orderNumber}`);
          await verifyLine(item, line.warehouse, session);
        }
        order.markModified("items");
        setOrderStatus(order, computeOrderStatus(order));
        await order.save({ session });
        touched.push(order._id);
      }
      return touched;
    });
    for (const id of ids) await recordFor(req, { keys: ["pedidos"], entityType: "order", entityId: id, action: "verified-bulk" });

    const orders = await populateOrder(orderModel.find({ _id: { $in: ids } }));
    res.json({ message: "Order items verified", orders });
  } catch (error) {
    sendError(res, error);
  }
};

// Empacar en Almacén (toda la línea verificada o la parte de bodega de una
// línea dividida). Si el pedido no tiene motorista, se limpia cualquier resto
// de una asignación vieja; si ya lo tiene, no se toca (Logística puede
// asignar apenas el primer producto queda empacado).
ordersController.packOrderItem = lineAction(
  ({ order, item }) => {
    packLine(item);
    if (!order.delivery?.driver && !order.delivery?.route) order.delivery = undefined;
  },
  "Order item packed",
  packedComplete,
);

// Deshacer empacar (solo si el motorista no recogió en Almacén).
ordersController.unpackOrderItem = lineAction(({ order, item }) => unpackLine(item, order), "Order item unpacked");

// Enviar a fabricación: crea el lote Programado (meta = cantidad) en el mismo
// clic. /manufacture queda como alias (también cubre líneas enviadas antes
// sin lote).
ordersController.sendItemToManufacturing = lineAction(
  ({ item, session }) => sendLineToManufacturing(item, session),
  "Order item sent to manufacturing",
  () => ({ keys: ["fabricacion.pedidos"], action: "sent-to-manufacturing" }),
);
// Alias que también crea el lote de una línea enviada antes sin lote.
ordersController.manufactureOrderItem = lineAction(
  ({ item, session }) => sendLineToManufacturing(item, session),
  "Order item sent to manufacturing",
  // El lote que se crea es de un pedido: su novedad se ve en Fabricación > Pedidos, en el pedido.
  () => ({ keys: ["fabricacion.pedidos"], action: "manufacture" }),
);

// Deshacer enviar a fabricación: si el lote sigue Programado lo elimina y la
// línea vuelve a sin procesar; si ya empezó, rechaza.
ordersController.cancelManufacturingRequest = lineAction(
  ({ item, session }) => cancelLineManufacturing(item, session),
  "Manufacturing request cancelled",
  // Si al pedido ya no le queda ninguna línea en fabricación, deja de verse en Fabricación > Pedidos:
  // su novedad de ahí se quita (y no se registra otra). Si aún le quedan, es un cambio más.
  noManufacturingLeft,
);

// Existencia parcial: toma `quantity` de `warehouse` y manda el resto a
// fabricar. Body: { warehouse, quantity }
ordersController.splitPartialItem = lineAction(
  ({ item, body, session }) => splitLine(item, body.warehouse, body.quantity, session),
  "Order item split",
  () => ({ keys: ["pedidos"], action: "split-partial" }),
);

// Deshacer la división: devuelve lo tomado y borra el lote si sigue Programado.
ordersController.unsplitPartialItem = lineAction(
  ({ item, session }) => unsplitLine(item, session),
  "Order item split undone",
  // La parte a fabricar desaparece: igual que al cancelar, si no queda ninguna línea en fabricación
  // la novedad de Fabricación > Pedidos se quita.
  ({ order }) => ((order.items || []).some((i) => i.sentToManufacturing) ? null : { resolve: ["fabricacion.pedidos"] }),
);

// Empacar lo fabricado para el pedido (Fabricación de pedidos), una vez el
// lote está "Completado". No toca inventario.
ordersController.packManufacturedItem = lineAction(
  ({ item, session }) => packManufacturedLine(item, session),
  "Order item packed from manufacturing",
  packedComplete,
);

// Deshacer empacar en Fabricación (solo si el motorista no recogió ahí).
ordersController.unpackManufacturedItem = lineAction(
  ({ order, item, session }) => unpackManufacturedLine(item, order, session),
  "Order item unpacked from manufacturing",
);

export default ordersController;
