const ordersController = {};

import orderModel from "../models/Order.js";
import productModel from "../models/Product.js";
import customerModel from "../models/Customer.js";
import customerOrderModel from "../models/CustomerOrder.js";
import paymentTransactionModel from "../models/PaymentTransaction.js";
import wompiClient from "../utils/wompiClient.js";

// Genera el siguiente N° de pedido correlativo del año (ORD-2026-0001, ORD-2026-0002, ...).
// Mismo esquema que private/backend/src/controller/ordersController.js: ambos
// backends escriben a la misma colección "orders", así que un pedido hecho
// aquí (tienda pública) y uno creado a mano en el panel privado se numeran
// igual, en la misma secuencia.
async function generateOrderNumber() {
  const prefix = `ORD-${new Date().getFullYear()}-`;
  const last = await orderModel
    .findOne({ orderNumber: { $regex: `^${prefix}` } })
    .sort({ orderNumber: -1 });

  const lastNumber = last ? parseInt(last.orderNumber.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

// Arma la lista de items del pedido recalculando precios SIEMPRE desde la
// base de datos (nunca se confía en el precio/total que manda el navegador).
async function buildOrderItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw { status: 400, message: "El carrito está vacío." };
  }

  const items = [];

  for (const raw of rawItems) {
    const product = await productModel.findOne({ _id: raw.productId, active: true });

    if (!product) {
      throw { status: 404, message: `Producto no encontrado: ${raw.productId}` };
    }

    const quantity = Number(raw.quantity) || 0;
    if (quantity < (product.minOrderQuantity || 1)) {
      throw {
        status: 400,
        message: `"${product.name}" requiere un pedido mínimo de ${product.minOrderQuantity} unidades.`,
      };
    }

    if (raw.color && product.colors.length && !product.colors.includes(raw.color)) {
      throw { status: 400, message: `Color inválido para "${product.name}".` };
    }

    // La tabla de Pedidos en admin (private/frontend) muestra este campo como
    // "Producto", pero como el nombre ahora se escribe libre en Catálogo (ver
    // ProductFormModal.jsx) no sirve como etiqueta uniforme para admin — se
    // usa la categoría del catálogo ("Pelotas"/"Pajillas") en su lugar.
    const productLabel = raw.size ? `${product.category} (${raw.size})` : product.category;
    const unitPrice = product.price;
    const subtotal = Number((unitPrice * quantity).toFixed(2));

    items.push({
      product: productLabel,
      color: raw.color || undefined,
      quantity,
      unitPrice,
      subtotal,
    });
  }

  return items;
}

function resolveAddress(customer, body) {
  if (body.address && typeof body.address === "string") {
    return body.address;
  }
  if (body.addressId) {
    const found = customer.addresses.id(body.addressId);
    if (found) return found.address;
  }
  const defaultAddress = customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
  return defaultAddress?.address;
}

// POST /api/orders/checkout  (requiere sesión de cliente)
// Cobra la tarjeta con Wompi (tokenización directa) y SOLO si la aprueba crea
// el pedido — así nunca queda un pedido "sin pagar" dando vueltas: si Wompi
// rechaza, no se guarda nada y el cliente reintenta desde el mismo checkout
// con otra tarjeta (su carrito sigue intacto en el navegador).
ordersController.checkout = async (req, res) => {
  try {
    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const items = await buildOrderItems(req.body.items);
    const total = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

    const address = resolveAddress(customer, req.body);
    if (!address) {
      return res.status(400).json({ message: "Agrega una dirección de envío antes de pagar." });
    }

    const card = req.body.card || {};
    if (!card.number || !card.cvv || !card.month || !card.year) {
      return res.status(400).json({ message: "Completa los datos de la tarjeta." });
    }

    const customerFullName = `${customer.name} ${customer.lastName || ""}`.trim();

    // 1) Tokenizar: cambia el número real por un token de un solo uso. La
    // tarjeta completa nunca se guarda ni se vuelve a usar después de esto.
    const tokenizada = await wompiClient.tokenizeCard({
      numeroTarjeta: String(card.number).replace(/\s/g, ""),
      cvv: card.cvv,
      mesVencimiento: card.month,
      anioVencimiento: card.year,
      nombreTarjetaHabiente: card.holderName || customerFullName,
    });
    const cardLast4 = tokenizada.tarjetaEnmascarada?.trim().slice(-4);

    // 2) Cobrar el token. La respuesta de Wompi (no lo que diga el navegador)
    // es la única fuente de verdad sobre si el pago se aprobó.
    const cobro = await wompiClient.chargeTokenizedCard({
      tokenTarjeta: tokenizada.token,
      monto: total,
      nombreCliente: customerFullName,
      emailCliente: customer.email,
    });

    if (!cobro.esAprobada) {
      return res.status(402).json({
        message: cobro.mensaje || "La tarjeta fue rechazada. Intenta con otra.",
      });
    }

    // 3) Pago aprobado: ahora sí se crea el pedido, ya marcado como pagado.
    const orderNumber = await generateOrderNumber();

    const order = new orderModel({
      orderNumber,
      customer: {
        name: customerFullName,
        email: customer.email,
        phone: req.body.phone || customer.phone,
        address,
      },
      items,
      total,
      source: "ecommerce",
      notes: req.body.notes,
      status: "Procesando",
      paymentStatus: "Pagado",
    });
    await order.save();

    await customerOrderModel.create({ customer: customer._id, order: order._id });

    await paymentTransactionModel.create({
      order: order._id,
      idTransaccion: cobro.idTransaccion,
      monto: total,
      esAprobada: true,
      formaPago: cobro.formaPago,
      codigoAutorizacion: cobro.codigoAutorizacion,
      mensaje: cobro.mensaje,
      cardLast4,
      status: "aprobado",
    });

    res.status(201).json({ order });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// GET /api/orders/mine  (requiere sesión de cliente)
ordersController.getMyOrders = async (req, res) => {
  try {
    const links = await customerOrderModel
      .find({ customer: req.customer.id })
      .populate("order")
      .sort({ createdAt: -1 });

    const orders = links.filter((l) => l.order).map((l) => l.order);
    res.json(orders);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// GET /api/orders/:id  (requiere sesión de cliente, solo el dueño)
ordersController.getMyOrder = async (req, res) => {
  try {
    const link = await customerOrderModel.findOne({
      customer: req.customer.id,
      order: req.params.id,
    });
    if (!link) {
      return res.status(404).json({ message: "Pedido no encontrado." });
    }

    const order = await orderModel.findById(req.params.id);
    const payments = await paymentTransactionModel
      .find({ order: req.params.id })
      .sort({ createdAt: -1 });

    res.json({ order, payments });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default ordersController;
