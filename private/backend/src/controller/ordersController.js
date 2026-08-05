const ordersController = {};

import orderModel from "../models/Order.js";

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

  await orderModel.findByIdAndUpdate(req.params.id, update, { new: true });

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

  await orderModel.findByIdAndUpdate(req.params.id, update, { new: true });

  res.json({ message: "Order status updated" });
};

// ASIGNAR logística (motorista / vehículo) al pedido
ordersController.assignDelivery = async (req, res) => {
  const { driver, vehicle, dispatchStatus, address } = req.body;

  await orderModel.findByIdAndUpdate(
    req.params.id,
    {
      status: "En Tránsito",
      delivery: { driver, vehicle, dispatchStatus, address },
    },
    { new: true },
  );

  res.json({ message: "Delivery assigned" });
};

//Eliminar
ordersController.deleteOrder = async (req, res) => {
  await orderModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Order deleted" });
};

export default ordersController;
