const ordersController = {};

import orderModel from "../models/Order.js";
import transactionModel from "../models/Transaction.js";
import { generateReference } from "./transactionsController.js";
import { setOrderStatus, computeOrderStatus } from "../lib/orderStatus.js";
import { HttpError, sendError, withTransaction, returnStock } from "../lib/stock.js";
import {
  packedLocations,
  hasStockTaken,
  hasCommitment,
  takenQty,
  resetLine,
  releaseLine,
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
const ROUTE_FIELDS = "number zone status date";

// Un pedido en una ruta conserva su delivery (motorista, vehículo y ruta los
// maneja la ruta; ver lib/routes.js), aunque su status cambie a mano.
const keepsDelivery = (order, status) => status === "En Tránsito" || status === "Entregado" || Boolean(order.delivery?.route);

// Genera el siguiente N° de pedido correlativo del año (ORD-2026-0001, ORD-2026-0002, ...)
async function generateOrderNumber() {
  const prefix = `ORD-${new Date().getFullYear()}-`;
  const last = await orderModel
    .findOne({ orderNumber: { $regex: `^${prefix}` } })
    .sort({ orderNumber: -1 });

  const lastNumber = last ? parseInt(last.orderNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

// El motorista ya pasó por todas las paradas de recolección que este pedido
// requiere (o no requiere ninguna). Se le pasa `delivery` aparte del `order`
// porque a veces se evalúa contra el delivery ya guardado en DB y a veces
// contra uno recién armado en memoria (ver assignDelivery/confirmPickup).
function isFullyCollected(order, delivery) {
  const required = packedLocations(order);
  if (required.includes("Almacén") && !delivery?.pickupWarehouseAt) return false;
  if (required.includes("Fabricación") && !delivery?.pickupFactoryAt) return false;
  return true;
}

// Crea la transacción de Finanzas que corresponde a un pedido que acaba de
// cambiar de paymentStatus (Pagado -> Ingreso "Ventas"; Reembolsado -> Gasto
// "Ventas"), para no capturarla a mano en Finanzas cada vez. Resguardo
// anti-duplicado por relatedOrder + category + type: así un mismo pedido
// puede generar como máximo una transacción de cada tipo (una vez pagado, y
// aparte una vez reembolsado si llega a pasar), pero nunca dos iguales aunque
// el pedido se vuelva a guardar sin que el pago realmente cambie de nuevo.
async function createOrderPaymentTransaction(order, type, concept) {
  const alreadyExists = await transactionModel.findOne({
    relatedOrder: order._id,
    category: "Ventas",
    type,
  });
  if (alreadyExists) return;

  const reference = await generateReference();
  await transactionModel.create({
    reference,
    concept,
    type,
    category: "Ventas",
    amount: order.total,
    status: "Completado",
    relatedOrder: order._id,
  });
}

// Carga un pedido y una de sus líneas dentro de una transacción, aplica
// `fn` sobre la línea, recalcula el status y guarda. Todo o nada: si `fn`
// lanza (estado inválido, stock insuficiente, lote ya en proceso), no se
// aplica ningún movimiento de stock ni de lotes.
function lineAction(fn, okMessage) {
  return async (req, res) => {
    try {
      await withTransaction(async (session) => {
        const order = await orderModel.findById(req.params.id).session(session);
        if (!order) throw new HttpError(404, "Pedido no encontrado");
        const index = Number(req.params.index);
        const item = Number.isInteger(index) ? order.items[index] : undefined;
        if (!item) throw new HttpError(404, "Producto del pedido no encontrado");

        await fn({ order, item, index, body: req.body || {}, session });

        order.markModified("items");
        setOrderStatus(order, computeOrderStatus(order));
        await order.save({ session });
      });
      res.json({ message: okMessage });
    } catch (error) {
      sendError(res, error);
    }
  };
}

// SELECT - todos los pedidos
ordersController.getOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find()
      .populate("delivery.driver", "name lastName phone")
      .populate("items.manufacturingBatch", BATCH_FIELDS)
      .populate("delivery.route", ROUTE_FIELDS)
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    sendError(res, error);
  }
};

// SELECT - un pedido por id
ordersController.getOrder = async (req, res) => {
  try {
    const order = await orderModel
      .findById(req.params.id)
      .populate("delivery.driver", "name lastName phone")
      .populate("items.manufacturingBatch", BATCH_FIELDS)
      .populate("delivery.route", ROUTE_FIELDS);
    res.json(order);
  } catch (error) {
    sendError(res, error);
  }
};

// INSERT
ordersController.insertOrder = async (req, res) => {
  try {
    const { customer, items, total, status, paymentStatus, notes } = req.body;

    const orderNumber = await generateOrderNumber();

    // El pedido pasa solo a Inventario al crearse (sentToInventoryAt) y su
    // status inicial queda como primer registro de statusHistory.
    const createdAt = new Date();
    const newOrder = new orderModel({
      orderNumber,
      customer,
      items: (items || []).map(({ sourceIndex: _sourceIndex, ...item }) => item),
      total,
      paymentStatus,
      notes,
      sentToInventoryAt: createdAt,
    });
    setOrderStatus(newOrder, status || "Pendiente", createdAt);

    await newOrder.save();

    res.json({ message: "Order saved", orderNumber, _id: newOrder._id });
  } catch (error) {
    sendError(res, error);
  }
};

// Al editar las líneas de un pedido, libera lo que tenían comprometido las
// líneas que se quitan o cambian (producto, color o cantidad): devuelve el
// stock tomado a su bodega y borra el lote si sigue Programado. Si alguna ya
// está empacada (o su lote ya empezó), rechaza todo el guardado.
//
// Para saber qué línea nueva corresponde a cuál vieja, el panel manda
// `sourceIndex` en cada línea que venía del pedido original. Si no llega en
// ninguna (ej. Movil, que reenvía las mismas líneas al cambiar el pago), se
// emparejan por posición.
async function reconcileEditedItems(existing, newItems, session) {
  const oldItems = existing.items || [];
  const hasSource = newItems.some((n) => n.sourceIndex != null);

  for (let i = 0; i < oldItems.length; i += 1) {
    const old = oldItems[i];
    if (!hasCommitment(old)) continue;

    const newIdx = hasSource ? newItems.findIndex((n) => n.sourceIndex === i) : i < newItems.length ? i : -1;
    const next = newIdx >= 0 ? newItems[newIdx] : null;
    const changed =
      !next ||
      Number(next.quantity) !== old.quantity ||
      next.product !== old.product ||
      (next.color || "") !== (old.color || "");
    if (!changed) continue;

    await releaseLine(old, session);
    if (next) resetLine(next);
  }

  return newItems.map(({ sourceIndex: _sourceIndex, ...item }) => item);
}

// ACTUALIZAR (datos generales del pedido)
ordersController.updateOrder = async (req, res) => {
  try {
    const { customer, items, total, status, paymentStatus, notes } = req.body;

    const result = await withTransaction(async (session) => {
      const existing = await orderModel.findById(req.params.id).session(session);
      if (!existing) throw new HttpError(404, "Pedido no encontrado");
      const previousPaymentStatus = existing.paymentStatus;

      const nextItems = Array.isArray(items) ? await reconcileEditedItems(existing, items, session) : undefined;

      // Solo se pisan los campos que llegan en el body (igual que el $set
      // anterior, que ignoraba los undefined).
      const fields = { customer, items: nextItems, total, paymentStatus, notes };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) existing.set(key, value);
      }
      setOrderStatus(existing, status);

      // Misma regla que updateStatus: si el pedido se edita hacia un estado fuera del
      // despacho activo ("En Tránsito" / "Entregado"), se limpia la asignación de logística
      // previa para que no reaparezca un motorista viejo si vuelve a "En Tránsito".
      // Un pedido que está en una ruta la conserva.
      if (!keepsDelivery(existing, status)) {
        existing.delivery = undefined;
      }

      await existing.save({ session });
      return { existing, previousPaymentStatus };
    });

    const { existing, previousPaymentStatus } = result;

    // Si paymentStatus acaba de cambiar a "Pagado"/"Reembolsado" (y antes no lo
    // era), genera la transacción de Finanzas correspondiente automáticamente.
    // Se compara contra el paymentStatus de antes de este guardado para que
    // solo dispare en la transición real, no en cada guardado posterior.
    if (paymentStatus && paymentStatus !== previousPaymentStatus) {
      const orderTotal = total ?? existing.total;
      if (paymentStatus === "Pagado") {
        await createOrderPaymentTransaction(
          { _id: existing._id, total: orderTotal },
          "Ingreso",
          `Venta pedido ${existing.orderNumber}`,
        );
      } else if (paymentStatus === "Reembolsado") {
        await createOrderPaymentTransaction(
          { _id: existing._id, total: orderTotal },
          "Gasto",
          `Reembolso pedido ${existing.orderNumber}`,
        );
      }
    }

    res.json({ message: "Order updated" });
  } catch (error) {
    sendError(res, error);
  }
};

// ACTUALIZAR solo el estado (avanzar en el ciclo del pedido)
ordersController.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await orderModel.findById(req.params.id);
    if (!order) throw new HttpError(404, "Pedido no encontrado");

    setOrderStatus(order, status);
    // Si el pedido sale del flujo de despacho activo (deja de estar "En Tránsito" o "Entregado"),
    // se limpia la asignación de logística previa: motorista, vehículo, etc. Así, si más adelante
    // vuelve a "En Tránsito", aparece sin asignar en vez de arrastrar al motorista anterior.
    if (!keepsDelivery(order, status)) {
      order.delivery = undefined;
    }

    await order.save();

    res.json({ message: "Order status updated" });
  } catch (error) {
    sendError(res, error);
  }
};

// ASIGNAR logística (motorista / vehículo) al pedido, o editar una entrega ya
// asignada (mismo endpoint: Logística usa este PATCH tanto para "Asignar"
// como para "Editar entrega"). El pedido pasa a "En Tránsito" solo cuando ya
// no le falta ninguna parada de recolección (o nunca la tuvo) — mientras el
// motorista todavía tenga que pasar por Almacén y/o Fabricación, el pedido
// se queda en su status de "para despacho" (Empacado/Procesando/etc.) y
// Logística lo sigue mostrando en esa pestaña, no en "En Tránsito". Salvo
// que el estado de despacho elegido ya sea "Entregado", en cuyo caso el
// pedido mismo pasa a "Entregado": así Logística libera al motorista (ver
// busyDriverMap en Logistica.jsx, que excluye pedidos con status
// "Entregado") en cuanto se marca la entrega como completada, en vez de
// dejarlo "ocupado" para siempre en un pedido ya cerrado.
ordersController.assignDelivery = async (req, res) => {
  try {
    const { driver, vehicle, dispatchStatus, address } = req.body;

    const order = await orderModel.findById(req.params.id);
    if (!order) throw new HttpError(404, "Pedido no encontrado");

    // Se copian pickupWarehouseAt/pickupFactoryAt del delivery existente en
    // vez de reemplazar todo el subdocumento: reemplazarlo (como antes)
    // borraba las recolecciones ya confirmadas por confirmPickup, así que
    // guardar la entrega (aunque fuera solo para cambiar vehículo o estado de
    // despacho) las deshacía silenciosamente.
    const delivery = {
      driver,
      vehicle,
      dispatchStatus,
      address,
      pickupWarehouseAt: order.delivery?.pickupWarehouseAt,
      pickupFactoryAt: order.delivery?.pickupFactoryAt,
      // Se conserva la ruta de Logística si la tiene (este endpoint no la maneja).
      route: order.delivery?.route,
    };

    let status;
    if (dispatchStatus === "Entregado") {
      status = "Entregado";
    } else if (packedLocations(order).length === 0 || isFullyCollected(order, order.delivery)) {
      status = "En Tránsito";
    } else {
      status = computeOrderStatus(order);
    }

    order.delivery = delivery;
    setOrderStatus(order, status);
    order.markModified("delivery");
    await order.save();

    res.json({ message: "Delivery assigned" });
  } catch (error) {
    sendError(res, error);
  }
};

// Eliminar: antes de borrar, libera lo que cada línea tenía comprometido,
// en la misma transacción: devuelve el stock tomado de bodega (verificada o
// la parte fromStockQty de una línea dividida) y borra los lotes que siguen
// Programados. Si alguna línea ya está empacada o su lote ya empezó
// (En Proceso, Completado…), rechaza y no se mueve nada. Borrar un pedido
// que no existe responde 200 (idempotente, igual que antes).
ordersController.deleteOrder = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const order = await orderModel.findById(req.params.id).session(session);
      if (!order) return;
      for (const item of order.items) {
        if (hasCommitment(item)) await releaseLine(item, session, "delete");
      }
      await orderModel.deleteOne({ _id: order._id }, { session });
    });
    res.json({ message: "Order deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

// Reenvía el aviso a Inventario: pone sentToInventoryAt solo si falta
// (idempotente; todo pedido ya lo recibe al crearse). No reserva ni
// descuenta stock y no se dispara automáticamente desde ningún otro punto.
ordersController.requestInventory = async (req, res) => {
  try {
    await orderModel.updateOne(
      { _id: req.params.id, sentToInventoryAt: { $exists: false } },
      { $set: { sentToInventoryAt: new Date() } },
    );
    res.json({ message: "Inventory requested" });
  } catch (error) {
    sendError(res, error);
  }
};

// Quita un pedido de Inventario (lo usa Movil): borra todo su rastro de
// verificación. Por cada producto con stock tomado, le devuelve esa cantidad
// a la bodega donde se había restado, y desmarca verificado/empacado/enviado
// a fabricación. Como sentToInventoryAt se borra, el pedido sale de la lista
// de Inventario de Movil hasta que se reenvíe con PATCH request-inventory.
ordersController.cancelInventoryRequest = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const order = await orderModel.findById(req.params.id).session(session);
      if (!order) throw new HttpError(404, "Pedido no encontrado");

      for (const item of order.items) {
        if (hasStockTaken(item)) {
          await returnStock(
            { product: item.product, color: item.color, warehouse: item.verifiedWarehouse, quantity: takenQty(item) },
            session,
          );
        }
        // Los lotes ya creados no se borran: se conservan en Fabricación, solo
        // se desvinculan de la línea (mismo criterio de antes).
        resetLine(item);
      }

      order.markModified("items");
      order.sentToInventoryAt = undefined;
      if (order.status === "Empacado" || order.status === "En Fabricación" || order.status === "Procesando") {
        setOrderStatus(order, "Pendiente");
      }
      await order.save({ session });
    });

    res.json({ message: "Inventory request cancelled" });
  } catch (error) {
    sendError(res, error);
  }
};

// Verificar un producto: toma toda la cantidad de la bodega elegida.
ordersController.verifyOrderItem = lineAction(
  ({ item, body, session }) => verifyLine(item, body.warehouse, session),
  "Order item verified",
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

    const orders = await orderModel
      .find({ _id: { $in: ids } })
      .populate("delivery.driver", "name lastName phone")
      .populate("items.manufacturingBatch", BATCH_FIELDS)
      .populate("delivery.route", ROUTE_FIELDS);
    res.json({ message: "Order items verified", orders });
  } catch (error) {
    sendError(res, error);
  }
};

// Empacar en Almacén (toda la línea verificada o la parte de bodega de una
// línea dividida). Si el pedido no tiene motorista, se limpia cualquier resto
// de una asignación vieja; si ya lo tiene, no se toca (Logística puede
// asignar apenas el primer producto queda empacado).
ordersController.packOrderItem = lineAction(({ order, item }) => {
  packLine(item);
  if (!order.delivery?.driver && !order.delivery?.route) order.delivery = undefined;
}, "Order item packed");

// Deshacer empacar (solo si el motorista no recogió en Almacén).
ordersController.unpackOrderItem = lineAction(({ order, item }) => unpackLine(item, order), "Order item unpacked");

// Enviar a fabricación: crea el lote Programado (meta = cantidad) en el mismo
// clic. /manufacture queda como alias (también cubre líneas enviadas antes
// sin lote).
ordersController.sendItemToManufacturing = lineAction(
  ({ item, session }) => sendLineToManufacturing(item, session),
  "Order item sent to manufacturing",
);
ordersController.manufactureOrderItem = ordersController.sendItemToManufacturing;

// Deshacer enviar a fabricación: si el lote sigue Programado lo elimina y la
// línea vuelve a sin procesar; si ya empezó, rechaza.
ordersController.cancelManufacturingRequest = lineAction(
  ({ item, session }) => cancelLineManufacturing(item, session),
  "Manufacturing request cancelled",
);

// Existencia parcial: toma `quantity` de `warehouse` y manda el resto a
// fabricar. Body: { warehouse, quantity }
ordersController.splitPartialItem = lineAction(
  ({ item, body, session }) => splitLine(item, body.warehouse, body.quantity, session),
  "Order item split",
);

// Deshacer la división: devuelve lo tomado y borra el lote si sigue Programado.
ordersController.unsplitPartialItem = lineAction(
  ({ item, session }) => unsplitLine(item, session),
  "Order item split undone",
);

// Empacar lo fabricado para el pedido (Fabricación de pedidos), una vez el
// lote está "Completado". No toca inventario.
ordersController.packManufacturedItem = lineAction(
  ({ item, session }) => packManufacturedLine(item, session),
  "Order item packed from manufacturing",
);

// Deshacer empacar en Fabricación (solo si el motorista no recogió ahí).
ordersController.unpackManufacturedItem = lineAction(
  ({ order, item, session }) => unpackManufacturedLine(item, order, session),
  "Order item unpacked from manufacturing",
);

// Confirma que el motorista ya recogió lo que le tocaba en una ubicación del
// pedido (Almacén o Fabricación). No es un estado nuevo del pedido: solo
// metadata dentro de delivery.
ordersController.confirmPickup = async (req, res) => {
  try {
    const { location } = req.body;
    if (location !== "Almacén" && location !== "Fabricación") {
      throw new HttpError(400, "Ubicación inválida");
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    if (!order.delivery?.driver) {
      throw new HttpError(400, "El pedido todavía no tiene motorista asignado");
    }

    if (location === "Almacén") {
      order.delivery.pickupWarehouseAt = new Date();
    } else {
      order.delivery.pickupFactoryAt = new Date();
    }

    // Si con esta parada ya quedó todo recogido, el pedido pasa de "para
    // despacho" a "en tránsito" (salvo que ya estuviera "Entregado", que no
    // debería retroceder por confirmar una parada tardía).
    if (isFullyCollected(order, order.delivery) && order.delivery.dispatchStatus !== "Entregado") {
      setOrderStatus(order, "En Tránsito");
    }

    order.markModified("delivery");
    await order.save();

    res.json({ message: "Pickup confirmed" });
  } catch (error) {
    sendError(res, error);
  }
};

export default ordersController;
