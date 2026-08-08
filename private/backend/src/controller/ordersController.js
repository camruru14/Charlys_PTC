const ordersController = {};

import orderModel from "../models/Order.js";
import inventoryModel from "../models/InventoryItem.js";

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

// SELECT - todos los pedidos
ordersController.getOrders = async (req, res) => {
  const orders = await orderModel
    .find()
    .populate("delivery.driver", "name lastName phone")
    .sort({ createdAt: -1 });
  res.json(orders);
};

// SELECT - un pedido por id
ordersController.getOrder = async (req, res) => {
  const order = await orderModel
    .findById(req.params.id)
    .populate("delivery.driver", "name lastName phone")
    .populate("batch", "batchNumber status");
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
  const { customer, items, total, status, paymentStatus, batch, notes } =
    req.body;

  // Misma regla que updateStatus: si el pedido se edita hacia un estado fuera del
  // despacho activo ("En Tránsito" / "Entregado"), se limpia la asignación de logística
  // previa para que no reaparezca un motorista viejo si vuelve a "En Tránsito".
  const update = { $set: { customer, items, total, status, paymentStatus, batch, notes } };
  if (status !== "En Tránsito" && status !== "Entregado") {
    update.$unset = { delivery: "" };
  }

  await orderModel.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });

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

// ASIGNAR logística (motorista / vehículo) al pedido. El pedido pasa a "En
// Tránsito" como siempre (todavía no ha llegado al cliente); Inventario >
// Pedidos es el único lugar que muestra "Entregado" para esto, con otro
// significado ("entregado al repartidor"), a partir de que haya motorista
// asignado — ver el cálculo de status en Inventario.jsx.
ordersController.assignDelivery = async (req, res) => {
  const { driver, vehicle, dispatchStatus, address } = req.body;

  await orderModel.findByIdAndUpdate(
    req.params.id,
    {
      status: "En Tránsito",
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
    if (!item.verified) continue;

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

  order.markModified("items");
  order.inventoryRequestedAt = undefined;
  // Si "Empacar" lo había puesto en Empacado, se revierte junto con el resto
  // del rastro (ya no queda nada verificado ni empacado).
  if (order.status === "Empacado") {
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
  order.markModified("items");
  order.status = "Empacado";
  // Mismo criterio que updateStatus: "Empacado" no es despacho activo, se
  // limpia una asignación de logística vieja si la hubiera.
  order.delivery = undefined;
  await order.save();

  res.json({ message: "Order item packed" });
};

export default ordersController;
