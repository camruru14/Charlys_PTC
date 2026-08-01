const ordersController = {};

import orderModel from "../models/Order.js";

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
  const { orderNumber, customer, items, total, status, paymentStatus, notes } =
    req.body;

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

  res.json({ message: "Order saved" });
};

// ACTUALIZAR (datos generales del pedido)
ordersController.updateOrder = async (req, res) => {
  const { customer, items, total, status, paymentStatus, batch, notes } =
    req.body;

  await orderModel.findByIdAndUpdate(
    req.params.id,
    { customer, items, total, status, paymentStatus, batch, notes },
    { new: true },
  );

  res.json({ message: "Order updated" });
};

// ACTUALIZAR solo el estado (avanzar en el ciclo del pedido)
ordersController.updateStatus = async (req, res) => {
  const { status } = req.body;

  await orderModel.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true },
  );

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
