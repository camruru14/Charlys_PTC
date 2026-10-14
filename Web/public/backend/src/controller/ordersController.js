const ordersController = {};

import mongoose from "mongoose";
import orderModel from "../models/Order.js";
import productModel from "../models/Product.js";
import customerModel from "../models/Customer.js";
import customerOrderModel from "../models/CustomerOrder.js";
import paymentTransactionModel from "../models/PaymentTransaction.js";
import wompiClient from "../utils/wompiClient.js";
import { generateReference, recordSaleTransaction } from "../utils/salesTransaction.js";
import { recordStoreOrderActivity } from "../utils/activity.js";
import { nextCode } from "../utils/counters.js";
import { ValidationError, optionalText } from "../utils/validation.js";

// Cantidad máxima por línea (la tienda aplica el mismo tope en src/lib/quantity.js).
const MAX_QUANTITY = 9_999_999;
const MAX_LINES = 50;
const MAX_NOTES = 500;
const MAX_PHONE = 30;
const MAX_ADDRESS = 250;
const MAX_HOLDER = 80;

// Error del checkout con status HTTP y un mensaje legible para el cliente. `body`
// suma campos a la respuesta (p. ej. los precios nuevos en un 409).
function fail(status, message, body) {
  return Object.assign(new Error(message), { status, expose: true, body });
}

// Siguiente N° de pedido correlativo del año (ORD-2026-0001, ORD-2026-0002, ...):
// contador atómico (utils/counters.js), así dos compras a la vez nunca reciben el
// mismo número y pasar de 9999 no rompe el orden. Los pedidos solo se crean aquí
// (el panel privado no crea ni edita pedidos).
const generateOrderNumber = () => nextCode("ORD", orderModel, "orderNumber");

// Arma la lista de items del pedido recalculando precios SIEMPRE desde la
// base de datos (nunca se confía en el precio/total que manda el navegador).
// Valida todo lo que el cliente eligió (producto, cantidad, color, tamaño): esta función
// corre ANTES de cobrar y ningún fallo puede quedar para después.
// Devuelve { items, prices }: prices son los precios vigentes de cada producto del carrito.
async function buildOrderItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw fail(400, "El carrito está vacío.");
  }
  if (rawItems.length > MAX_LINES) {
    throw fail(400, `El carrito no puede tener más de ${MAX_LINES} líneas.`);
  }

  const items = [];
  const prices = new Map();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object" || typeof raw.productId !== "string" || !mongoose.isValidObjectId(raw.productId)) {
      throw fail(400, "Hay un producto inválido en tu carrito.");
    }
    const product = await productModel.findOne({ _id: raw.productId, active: true });

    if (!product) {
      throw fail(404, "Uno de los productos de tu carrito ya no está disponible. Revisa tu carrito.");
    }

    // Sin validación de stock a propósito: los productos se fabrican bajo pedido.
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw fail(400, `"${product.name}" requiere una cantidad entera de máximo ${MAX_QUANTITY.toLocaleString("en-US")} unidades.`);
    }
    if (quantity < (product.minOrderQuantity || 1)) {
      throw fail(400, `"${product.name}" requiere un pedido mínimo de ${product.minOrderQuantity} unidades.`);
    }

    // Si el producto tiene colores, hay que elegir uno de ellos; si no, no hay color.
    let color;
    if (product.colors?.length) {
      if (typeof raw.color !== "string" || !product.colors.includes(raw.color)) {
        throw fail(400, `Elige un color válido para "${product.name}".`);
      }
      color = raw.color;
    }

    // Igual con los tamaños (el tamaño se guarda aparte, en `size`).
    let size;
    if (product.sizes?.length) {
      if (typeof raw.size !== "string" || !product.sizes.includes(raw.size)) {
        throw fail(400, `Elige un tamaño válido para "${product.name}".`);
      }
      size = raw.size;
    }

    // La línea guarda como "producto" el NOMBRE EXACTO del producto del catálogo (el
    // que se administra en Catálogo del panel, único en todo el sistema), sin el
    // tamaño: es el nombre que usa todo el panel (Pedidos, Fabricación, Logística),
    // con el que Inventario busca el producto terminado al verificar el pedido
    // (name + color, private/backend/src/lib/stock.js) y con el que el Catálogo
    // sabe si el producto tiene pedidos. El tamaño va aparte, en `size`.
    const unitPrice = product.price;
    const subtotal = Number((unitPrice * quantity).toFixed(2));

    items.push({
      product: product.name,
      color,
      size,
      quantity,
      unitPrice,
      subtotal,
    });
    prices.set(String(product._id), product.price);
  }

  return { items, prices: [...prices].map(([id, price]) => ({ id, price })) };
}

// Dirección de envío: la del formulario o, si no viene, la de la cuenta.
function resolveAddress(customer, body) {
  const typed = optionalText(body.address, MAX_ADDRESS, "La dirección");
  if (typed) return typed;
  if (body.addressId && typeof body.addressId === "string") {
    const found = customer.addresses.id(body.addressId);
    if (found) return found.address;
  }
  const defaultAddress = customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
  return defaultAddress?.address;
}

// Datos de la tarjeta: se normalizan y validan antes de tokenizar. Wompi tiene la última palabra
// sobre si la tarjeta existe; esto solo evita mandarle basura.
function readCard(rawCard, fullName) {
  const card = rawCard && typeof rawCard === "object" ? rawCard : {};
  const asText = (v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
  const number = asText(card.number).replace(/[\s-]/g, "");
  const cvv = asText(card.cvv);
  const month = asText(card.month);
  let year = asText(card.year);
  if (!number || !cvv || !month || !year) throw fail(400, "Completa los datos de la tarjeta.");
  if (!/^\d{12,19}$/.test(number)) throw fail(400, "El número de la tarjeta no es válido.");
  if (!/^\d{3,4}$/.test(cvv)) throw fail(400, "El código de seguridad (CVV) no es válido.");
  if (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12) throw fail(400, "El mes de vencimiento no es válido.");
  if (/^\d{2}$/.test(year)) year = `20${year}`;
  if (!/^\d{4}$/.test(year)) throw fail(400, "El año de vencimiento no es válido.");
  const holderName = optionalText(card.holderName, MAX_HOLDER, "El nombre del titular") || fullName;
  return { number, cvv, month, year, holderName };
}

// Guarda para conciliar a mano un cobro APROBADO cuyo pedido no se pudo registrar
// (fuera de la transacción que falló). No se reembolsa solo.
async function recordForReconciliation({ cobro, cardLast4, customer, total, payload, saveError }) {
  const data = {
    needsReconciliation: true,
    status: "pendiente_conciliacion",
    customer: customer._id,
    idTransaccion: cobro.idTransaccion,
    monto: total,
    esAprobada: true,
    formaPago: cobro.formaPago,
    codigoAutorizacion: cobro.codigoAutorizacion,
    mensaje: cobro.mensaje,
    cardLast4,
    payload,
    failureReason: String(saveError?.message || saveError).slice(0, 500),
  };
  try {
    await paymentTransactionModel.create(data);
  } catch (error) {
    // Último recurso: que al menos el log tenga todo para conciliar a mano.
    console.error(`NO SE PUDO GUARDAR EL REGISTRO DE CONCILIACIÓN (${error}). Datos: ${JSON.stringify(data)}`);
  }
}

// Cobro CUYO RESULTADO SE DESCONOCE (Wompi no respondió a tiempo o falló con un 5xx al cobrar): la
// tarjeta pudo cobrarse. Se deja para conciliar a mano contra Wompi (con el número de pedido que ya
// se reservó) y no se reembolsa solo; el cliente NO debe intentarlo de nuevo.
async function recordUnconfirmedCharge(reserved, error) {
  const data = {
    needsReconciliation: true,
    status: "pendiente_conciliacion",
    customer: reserved.customer._id,
    monto: reserved.total,
    esAprobada: false,
    mensaje: "Cobro sin confirmar: Wompi no respondió o falló al cobrar",
    cardLast4: reserved.cardLast4,
    payload: {
      orderNumber: reserved.orderNumber,
      items: reserved.items,
      total: reserved.total,
      address: reserved.address,
      phone: reserved.phone,
      notes: reserved.notes,
      customerEmail: reserved.customer.email,
    },
    failureReason: String(error?.message || error).slice(0, 500),
  };
  try {
    await paymentTransactionModel.create(data);
  } catch (saveError) {
    // Último recurso: que al menos el log tenga todo para conciliar a mano.
    console.error(`NO SE PUDO GUARDAR EL REGISTRO DE COBRO SIN CONFIRMAR (${saveError}). Datos: ${JSON.stringify(data)}`);
  }
}

// POST /api/orders/checkout  (requiere sesión de cliente)
// Orden del flujo (nada puede fallar por validación después de cobrar):
//   1) validar y normalizar TODO lo que manda el navegador;
//   2) comparar el total con el que vio el cliente (409 si los precios cambiaron);
//   3) reservar el número de pedido (contador atómico);
//   4) cobrar la tarjeta con Wompi (tokenización directa);
//   5) guardar pedido, vínculo con el cliente, pago y venta en UNA transacción de MongoDB;
//   6) si ese guardado falla con el cobro ya aprobado, dejar el pago para conciliar
//      y avisar al cliente con la referencia de Wompi (no se reembolsa solo).
// Solo existe un pedido si Wompi aprobó el cobro; si rechaza, no se guarda nada y el
// cliente reintenta desde el mismo checkout con otra tarjeta (su carrito sigue intacto).
ordersController.checkout = async (req, res) => {
  // Lo que ya se reservó/validó antes de cobrar: si el cobro queda sin confirmar, el catch lo necesita.
  let reserved = null;
  try {
    const body = req.body ?? {};

    // ---- 1) Validar todo antes de cobrar
    const customer = await customerModel.findById(req.customer.id);
    if (!customer || !customer.isActive) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const { items, prices } = await buildOrderItems(body.items);
    const total = Number(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));

    const address = resolveAddress(customer, body);
    if (!address) {
      return res.status(400).json({ message: "Agrega una dirección de envío antes de pagar." });
    }
    const phone = optionalText(body.phone, MAX_PHONE, "El teléfono") || optionalText(customer.phone, MAX_PHONE, "El teléfono");
    const notes = optionalText(body.notes, MAX_NOTES, "Las notas");

    const customerFullName = `${customer.name} ${customer.lastName || ""}`.trim();
    const card = readCard(body.card, customerFullName);

    // ---- 2) El total que vio el cliente tiene que ser el que se va a cobrar
    const expectedTotal = Number(body.expectedTotal);
    if (body.expectedTotal === undefined || body.expectedTotal === null || !Number.isFinite(expectedTotal)) {
      throw fail(400, "No pudimos confirmar el total de tu pedido. Actualiza la página e intenta de nuevo.");
    }
    if (Math.abs(expectedTotal - total) > 0.005) {
      throw fail(409, "Algunos precios cambiaron. Revisa tu carrito.", { products: prices });
    }

    // El pedido tal como se guardará: se valida contra el esquema ANTES de cobrar.
    const buildOrder = (orderNumber, at) => ({
      orderNumber,
      customer: { name: customerFullName, email: customer.email, phone, address },
      items,
      total,
      source: "ecommerce",
      notes,
      status: "Procesando",
      // El pedido pasa solo a Inventario al crearse: sentToInventoryAt y el
      // primer registro de statusHistory llevan la misma fecha de creación
      // (ver private/backend/src/lib/orderStatus.js para el resto del ciclo).
      statusHistory: [{ status: "Procesando", at }],
      sentToInventoryAt: at,
    });
    await new orderModel(buildOrder("ORD-VALIDACION", new Date())).validate();

    // ---- 3) Reservar el número de pedido
    const orderNumber = await generateOrderNumber();
    reserved = { orderNumber, customer, total, items, address, phone, notes };

    // ---- 4) Cobrar. La tarjeta completa nunca se guarda ni se vuelve a usar.
    const tokenizada = await wompiClient.tokenizeCard({
      numeroTarjeta: card.number,
      cvv: card.cvv,
      mesVencimiento: card.month,
      anioVencimiento: card.year,
      nombreTarjetaHabiente: card.holderName,
    });
    const cardLast4 = tokenizada.tarjetaEnmascarada?.trim().slice(-4);
    reserved.cardLast4 = cardLast4;

    // La respuesta de Wompi (no lo que diga el navegador) es la única fuente de
    // verdad sobre si el pago se aprobó.
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

    // ---- 5) Cobro aprobado: guardar todo junto. Todo pedido de la tienda está
    // pagado (solo existe si Wompi aprobó el cobro), por eso Order no guarda un
    // estado de pago.
    let order;
    let sale;
    try {
      const approvedAt = new Date();
      const saleReference = await generateReference();
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Los documentos se crean de nuevo en cada intento: withTransaction puede reintentar.
          [order] = await orderModel.create([buildOrder(orderNumber, approvedAt)], { session });
          await customerOrderModel.create([{ customer: customer._id, order: order._id }], { session });
          await paymentTransactionModel.create(
            [
              {
                order: order._id,
                idTransaccion: cobro.idTransaccion,
                monto: total,
                esAprobada: true,
                formaPago: cobro.formaPago,
                codigoAutorizacion: cobro.codigoAutorizacion,
                mensaje: cobro.mensaje,
                cardLast4,
                status: "aprobado",
              },
            ],
            { session },
          );
          // La venta a Finanzas (Ingreso "Ventas").
          sale = await recordSaleTransaction(order, { session, reference: saleReference });
        });
      } finally {
        await session.endSession();
      }
    } catch (saveError) {
      // ---- 6) El cliente pagó y no hay pedido: se deja todo para conciliar.
      const reference = cobro.idTransaccion || orderNumber;
      console.error(
        `COBRO APROBADO SIN PEDIDO: Wompi ${reference} por $${total} (${customer.email}, ${orderNumber}). No se pudo guardar: ${saveError}`,
      );
      await recordForReconciliation({
        cobro,
        cardLast4,
        customer,
        total,
        saveError,
        payload: { orderNumber, items, total, address, phone, notes, customerEmail: customer.email },
      });
      return res.status(500).json({
        message: `Tu pago se recibió pero no pudimos registrar el pedido. Contáctanos con la referencia ${reference}.`,
      });
    }

    // Las novedades para el panel: el pedido (Pedidos e Inventario > Pedidos) y su
    // venta (Finanzas), ya con todo confirmado. Si fallan solo quedan en el log.
    await recordStoreOrderActivity(order, sale);

    res.status(201).json({ order });
  } catch (error) {
    // El cobro pudo haberse hecho aunque no lo sepamos: se guarda para conciliar y se le dice al cliente
    // que NO reintente (un segundo intento podría cobrarle dos veces).
    if (error?.unconfirmed && reserved) {
      await recordUnconfirmedCharge(reserved, error);
      console.error(`COBRO SIN CONFIRMAR: ${reserved.orderNumber} por $${reserved.total} (${reserved.customer.email}): ${error.message}`);
      return res.status(502).json({
        message: `No pudimos confirmar tu pago. No intentes de nuevo: revisaremos tu cobro con la referencia ${reserved.orderNumber} y te contactaremos.`,
        unconfirmed: true,
        reference: reserved.orderNumber,
      });
    }
    if (error?.status) {
      return res.status(error.status).json({ message: error.message, ...(error.body || {}) });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Pedido que ve el cliente: el pedido vivo o, si el panel lo eliminó (los
// entregados se eliminan para que no se acumulen), el resumen que se guardó en
// su CustomerOrder. Misma forma en ambos casos; sin enlace roto ni error.
function visibleOrder(link, live) {
  if (live) return live.toObject();
  if (link.snapshot) return { ...link.snapshot, _id: link.order };
  return null;
}

// GET /api/orders/mine  (requiere sesión de cliente)
ordersController.getMyOrders = async (req, res) => {
  try {
    const links = await customerOrderModel.find({ customer: req.customer.id }).sort({ createdAt: -1 }).lean();
    const live = await orderModel.find({ _id: { $in: links.map((l) => l.order) } });
    const liveById = new Map(live.map((o) => [String(o._id), o]));
    const orders = links.map((l) => visibleOrder(l, liveById.get(String(l.order)))).filter(Boolean);

    // Método de pago: vive en PaymentTransaction (no en Order). Una sola
    // consulta para todos los pedidos; si hubiera varias por pedido gana la
    // aprobada más reciente. Un pedido sin transacción queda con payment: null.
    const transactions = await paymentTransactionModel
      .find({ order: { $in: orders.map((o) => o._id) }, status: "aprobado" })
      .sort({ createdAt: -1 })
      .select("order provider formaPago cardLast4")
      .lean();
    const paymentByOrder = new Map();
    for (const t of transactions) {
      const key = String(t.order);
      if (!paymentByOrder.has(key)) {
        paymentByOrder.set(key, { provider: t.provider, formaPago: t.formaPago, cardLast4: t.cardLast4 || null });
      }
    }

    res.json(orders.map((o) => ({ ...o, payment: paymentByOrder.get(String(o._id)) || null })));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// GET /api/orders/:id  (requiere sesión de cliente, solo el dueño)
ordersController.getMyOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Pedido no encontrado." });
    }
    const link = await customerOrderModel.findOne({
      customer: req.customer.id,
      order: req.params.id,
    });
    if (!link) {
      return res.status(404).json({ message: "Pedido no encontrado." });
    }

    const order = visibleOrder(link.toObject(), await orderModel.findById(req.params.id));
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
