const ordersController = {};

import orderModel from "../models/Order.js";
import inventoryModel from "../models/InventoryItem.js";
import batchModel from "../models/ProductionBatch.js";
import transactionModel from "../models/Transaction.js";
import { generateBatchNumber } from "./productionBatchesController.js";
import { generateReference } from "./transactionsController.js";

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

// Calcula order.status (uno de los valores del enum de Order.js) a partir del
// estado real de todas las líneas del pedido, en vez de que cada acción de
// Inventario/Fabricación lo fije a mano mirando solo la línea que acaba de
// tocar. Prioridad:
//   1. Si ya hay motorista asignado, el ciclo de despacho activo lo maneja
//      assignDelivery/updateStatus aparte: no se toca.
//   2. Todas las líneas empacadas -> "Empacado".
//   3. Alguna línea enviada a fabricación y ninguna empacada -> "En Fabricación".
//   4. Alguna línea con avance (verified o packed) -> "Procesando".
//   5. Si ninguna línea tiene avance -> "Pendiente".
function computeOrderStatus(order) {
  if (order.delivery?.driver) return order.status;

  const items = order.items || [];
  if (items.length > 0 && items.every((i) => i.packed)) return "Empacado";
  if (items.some((i) => i.sentToManufacturing) && !items.some((i) => i.packed)) return "En Fabricación";
  if (items.some((i) => i.verified || i.packed)) return "Procesando";
  return "Pendiente";
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

// SELECT - todos los pedidos
ordersController.getOrders = async (req, res) => {
  const orders = await orderModel
    .find()
    .populate("delivery.driver", "name lastName phone")
    .populate("items.manufacturingBatch", "batchNumber status")
    .sort({ createdAt: -1 });
  res.json(orders);
};

// SELECT - un pedido por id
ordersController.getOrder = async (req, res) => {
  const order = await orderModel
    .findById(req.params.id)
    .populate("delivery.driver", "name lastName phone")
    .populate("items.manufacturingBatch", "batchNumber status");
  res.json(order);
};

// INSERT
ordersController.insertOrder = async (req, res) => {
  const { customer, items, total, status, paymentStatus, notes } = req.body;

  const orderNumber = await generateOrderNumber();

  const newOrder = new orderModel({
    orderNumber,
    customer,
    items,
    total,
    status,
    paymentStatus,
    notes,
  });

  await newOrder.save();

  res.json({ message: "Order saved", orderNumber });
};

// ACTUALIZAR (datos generales del pedido)
ordersController.updateOrder = async (req, res) => {
  const { customer, items, total, status, paymentStatus, notes } = req.body;

  const existing = await orderModel.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Order not found" });
  }

  // Misma regla que updateStatus: si el pedido se edita hacia un estado fuera del
  // despacho activo ("En Tránsito" / "Entregado"), se limpia la asignación de logística
  // previa para que no reaparezca un motorista viejo si vuelve a "En Tránsito".
  const update = { $set: { customer, items, total, status, paymentStatus, notes } };
  if (status !== "En Tránsito" && status !== "Entregado") {
    update.$unset = { delivery: "" };
  }

  await orderModel.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });

  // Si paymentStatus acaba de cambiar a "Pagado"/"Reembolsado" (y antes no lo
  // era), genera la transacción de Finanzas correspondiente automáticamente.
  // Se compara contra existing.paymentStatus (el valor antes de este guardado)
  // para que solo dispare en la transición real, no en cada guardado posterior.
  if (paymentStatus && paymentStatus !== existing.paymentStatus) {
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
};

// ACTUALIZAR solo el estado (avanzar en el ciclo del pedido)
ordersController.updateStatus = async (req, res) => {
  const { status } = req.body;

  // Si el pedido sale del flujo de despacho activo (deja de estar "En Tránsito" o "Entregado"),
  // se limpia la asignación de logística previa: motorista, vehículo, etc. Así, si más adelante
  // vuelve a "En Tránsito", aparece sin asignar en vez de arrastrar al motorista anterior.
  const update = { $set: { status } };
  if (status !== "En Tránsito" && status !== "Entregado") {
    update.$unset = { delivery: "" };
  }

  await orderModel.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });

  res.json({ message: "Order status updated" });
};

// ASIGNAR logística (motorista / vehículo) al pedido, o editar una entrega ya
// asignada (mismo endpoint: Logística usa este PATCH tanto para "Asignar"
// como para "Editar entrega"). El pedido pasa a "En Tránsito" salvo que el
// estado de despacho elegido ya sea "Entregado", en cuyo caso el pedido
// mismo pasa a "Entregado": así Logística libera al motorista (ver
// busyDriverMap en Logistica.jsx, que excluye pedidos con status
// "Entregado") en cuanto se marca la entrega como completada, en vez de
// dejarlo "ocupado" para siempre en un pedido ya cerrado.
ordersController.assignDelivery = async (req, res) => {
  const { driver, vehicle, dispatchStatus, address } = req.body;

  await orderModel.findByIdAndUpdate(
    req.params.id,
    {
      status: dispatchStatus === "Entregado" ? "Entregado" : "En Tránsito",
      delivery: { driver, vehicle, dispatchStatus, address },
    },
    { returnDocument: "after" },
  );

  res.json({ message: "Delivery assigned" });
};

//Eliminar
ordersController.deleteOrder = async (req, res) => {
  await orderModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Order deleted" });
};

// Solicitar a Inventario los productos de este pedido (botón "Solicitar" en
// Pedidos): solo marca la fecha de solicitud, así aparece en Inventario >
// Pedidos. No reserva ni descuenta stock.
ordersController.requestInventory = async (req, res) => {
  await orderModel.findByIdAndUpdate(req.params.id, { inventoryRequestedAt: new Date() });
  res.json({ message: "Inventory requested" });
};

// Quita un pedido de Inventario > Pedidos (botón "Eliminar" ahí): borra todo
// su rastro en Inventario, no solo la fecha de solicitud. Por cada producto
// ya verificado, le devuelve la cantidad al stock de la bodega donde se
// había restado (recreando el artículo si ya se había agotado y borrado), y
// desmarca verified/packed de todos los productos. Así, si el pedido se
// vuelve a solicitar más adelante, aparece limpio ("Sin Verificar") en vez
// de arrastrar un estado viejo, y el stock no se descuenta dos veces.
ordersController.cancelInventoryRequest = async (req, res) => {
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  for (const item of order.items) {
    if (item.verified) {
      const stockItem = await inventoryModel.findOne({
        category: "Producto Terminado",
        name: item.product,
        color: item.color || { $in: [null, ""] },
        location: item.verifiedWarehouse,
        batchNumber: { $exists: false },
      });

      if (stockItem) {
        stockItem.stock = (stockItem.stock || 0) + item.quantity;
        await stockItem.save();
      } else if (item.verifiedWarehouse) {
        // El artículo se había agotado y borrado (ver verifyOrderItem): se
        // recrea con la cantidad que se le había restado a este pedido.
        await inventoryModel.create({
          name: item.product,
          category: "Producto Terminado",
          color: item.color,
          stock: item.quantity,
          location: item.verifiedWarehouse,
        });
      }

      item.verified = false;
      item.verifiedWarehouse = undefined;
      item.verifiedAt = undefined;
      item.packed = false;
      item.packedAt = undefined;
    }

    // Si se había enviado a fabricación por falta de stock, también se
    // desmarca: la línea deja de aparecer en Fabricación > Pedidos.
    item.sentToManufacturing = false;
    item.sentToManufacturingAt = undefined;
  }

  order.markModified("items");
  order.inventoryRequestedAt = undefined;
  // Si "Empacar" o "Enviar a fabricación" habían avanzado el estado, se
  // revierte junto con el resto del rastro (ya no queda nada verificado,
  // empacado ni enviado a fabricación).
  if (order.status === "Empacado" || order.status === "En Fabricación") {
    order.status = "Pendiente";
  }

  await order.save();

  res.json({ message: "Inventory request cancelled" });
};

// Verifica un producto del pedido (modal "Verificar producto en inventario"
// en Inventario > Pedidos): resta la cantidad pedida del stock del producto
// terminado elegido (mismo artículo + color, en la bodega elegida) y marca
// esa línea como verificada.
ordersController.verifyOrderItem = async (req, res) => {
  const { warehouse } = req.body;
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }
  if (!warehouse) {
    return res.status(400).json({ message: "Selecciona una bodega" });
  }

  // Igual que sendToWarehouse: solo cuenta como stock real de almacén el
  // artículo sin batchNumber. El de Lotes Reportados (con batchNumber) no
  // debe tocarse aquí, aunque tenga el mismo artículo/color/bodega.
  const stockItem = await inventoryModel.findOne({
    category: "Producto Terminado",
    name: item.product,
    color: item.color || { $in: [null, ""] },
    location: warehouse,
    batchNumber: { $exists: false },
  });

  if (!stockItem) {
    return res.status(404).json({ message: "No hay stock de ese producto en esa bodega" });
  }
  if ((stockItem.stock || 0) < item.quantity) {
    return res.status(400).json({ message: "Stock insuficiente en esa bodega" });
  }

  // Si al restar la cantidad pedida el producto queda en 0, el registro se
  // elimina de "Producto Terminado" en vez de dejarlo en 0 (misma idea que
  // el resto de Inventario: un artículo agotado no se deja como fila vacía).
  const remaining = (stockItem.stock || 0) - item.quantity;
  if (remaining <= 0) {
    await inventoryModel.deleteOne({ _id: stockItem._id });
  } else {
    stockItem.stock = remaining;
    await stockItem.save();
  }

  item.verified = true;
  item.verifiedWarehouse = warehouse;
  item.verifiedAt = new Date();
  order.markModified("items");
  order.status = computeOrderStatus(order);
  await order.save();

  res.json({ message: "Order item verified" });
};

// Marca un producto del pedido como empacado (botón "Empacar", solo
// disponible una vez verificado): además pone todo el pedido en estado
// "Empacado" para que aparezca listo para despacho en Logística.
ordersController.packOrderItem = async (req, res) => {
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }
  if (!item.verified) {
    return res.status(400).json({ message: "Verifica el producto antes de empacarlo" });
  }

  item.packed = true;
  item.packedAt = new Date();
  item.packedLocation = "Almacén";
  order.markModified("items");
  order.status = computeOrderStatus(order);
  // Mismo criterio que updateStatus: si no hay motorista asignado, se limpia
  // cualquier resto de una asignación de logística vieja. Si ya hay
  // motorista (Logística puede asignar apenas el primer producto quede
  // empacado, ver Logistica.jsx), NO se toca: empacar otra línea del mismo
  // pedido no debe desasignarlo a mitad de la recolección.
  if (!order.delivery?.driver) {
    order.delivery = undefined;
  }
  await order.save();

  res.json({ message: "Order item packed" });
};

// Envía un producto del pedido a Fabricación (botón "Enviar a fabricación"
// en el modal "Verificar producto en inventario", cuando no hay stock
// suficiente para cubrirlo): no descuenta ni reserva stock, solo marca la
// línea como enviada para que aparezca en Fabricación > Pedidos. En
// Inventario > Pedidos esa línea pasa a mostrarse como "Enviado".
ordersController.sendItemToManufacturing = async (req, res) => {
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }

  item.sentToManufacturing = true;
  item.sentToManufacturingAt = new Date();
  order.markModified("items");
  order.status = computeOrderStatus(order);
  await order.save();

  res.json({ message: "Order item sent to manufacturing" });
};

// Quita un producto de Fabricación > Pedidos (botón "Eliminar" ahí): deshace
// el envío a fabricación, así el producto vuelve a aparecer "Sin Verificar"
// en Inventario > Pedidos. Si ya se había fabricado (botón "Fabricar"), el
// lote creado NO se borra: se conserva tal cual en Fabricación de pedidos,
// solo se desvincula de este pedido.
ordersController.cancelManufacturingRequest = async (req, res) => {
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }

  item.sentToManufacturing = false;
  item.sentToManufacturingAt = undefined;
  item.manufacturingBatch = undefined;
  item.manufacturedAt = undefined;
  order.markModified("items");
  order.status = computeOrderStatus(order);

  await order.save();

  res.json({ message: "Manufacturing request cancelled" });
};

// Fabrica un producto enviado a Fabricación (botón "Fabricar" en
// Fabricación > Pedidos): crea un lote en Lotes de fabricación con categoría
// "Pedido" y lo enlaza a esta línea (que pasa a mostrarse como "Fabricado"
// en vez del botón).
ordersController.manufactureOrderItem = async (req, res) => {
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }

  const batchNumber = await generateBatchNumber();
  const newBatch = new batchModel({
    batchNumber,
    product: item.product,
    color: item.color,
    category: "Pedido",
    status: "Programado",
  });
  await newBatch.save();

  item.manufacturingBatch = newBatch._id;
  item.manufacturedAt = new Date();
  order.markModified("items");
  await order.save();

  res.json({ message: "Order item sent to production", batchNumber });
};

// Empaca un producto fabricado exclusivamente para este pedido (botón
// "Empacar" en Fabricación > Fabricación de pedidos, una vez el lote está
// "Completado"): a diferencia de packOrderItem, no exige item.verified (no
// aplica — este stock nunca pasó, ni pasa, por Inventario: es exclusivo de
// esta línea) y no toca InventoryModel para nada.
ordersController.packManufacturedItem = async (req, res) => {
  const index = Number(req.params.index);

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const item = order.items[index];
  if (!item) {
    return res.status(404).json({ message: "Order item not found" });
  }
  if (!item.manufacturingBatch) {
    return res.status(400).json({ message: "Este producto no tiene un lote de fabricación asociado" });
  }

  const batch = await batchModel.findById(item.manufacturingBatch);
  if (!batch || batch.status !== "Completado") {
    return res.status(400).json({ message: "El lote de fabricación todavía no está completado" });
  }

  item.verified = true;
  item.packed = true;
  item.packedAt = new Date();
  item.packedLocation = "Fabricación";
  order.markModified("items");
  order.status = computeOrderStatus(order);
  await order.save();

  res.json({ message: "Order item packed from manufacturing" });
};

// Confirma que el motorista ya recogió lo que le tocaba en una ubicación del
// pedido (Almacén o Fabricación) — checklist de recolección antes de salir
// donde el cliente, ver getRequiredPickups en Logistica.jsx. No es un estado
// nuevo del pedido: solo metadata dentro de delivery.
ordersController.confirmPickup = async (req, res) => {
  const { location } = req.body;
  if (location !== "Almacén" && location !== "Fabricación") {
    return res.status(400).json({ message: "Ubicación inválida" });
  }

  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  if (!order.delivery?.driver) {
    return res.status(400).json({ message: "El pedido todavía no tiene motorista asignado" });
  }

  if (location === "Almacén") {
    order.delivery.pickupWarehouseAt = new Date();
  } else {
    order.delivery.pickupFactoryAt = new Date();
  }
  order.markModified("delivery");
  await order.save();

  res.json({ message: "Pickup confirmed" });
};

export default ordersController;
