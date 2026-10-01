// Verificación del arreglo del checkout de la tienda (public/backend) contra
// un MongoDB EN MEMORIA. Nunca se conecta a la base real: no lee DB_URI ni
// crea pedidos de prueba en ella.
//   node scripts/verify-checkout-fix.js   (desde Web/private/backend)
//
// Recorre el flujo real, igual que en producción, sobre la misma base:
//   1) Checkout de la tienda (public/backend ordersController.checkout), con
//      el cobro de Wompi simulado (aprobado).
//   2) Se comprueba que la línea del pedido guarda el nombre de Inventario
//      («Pajilla») y que se creó el Ingreso «Ventas» con el monto del pedido
//      (y que registrarlo otra vez no lo duplica).
//   3) El panel verifica la línea (private/backend verifyOrderItem) y la
//      existencia de Pajilla Azul baja exactamente en la cantidad comprada.
//   4) Contraste: una línea guardada como antes («Pajillas») no encuentra
//      existencia (409), que era el bug.
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const PRIVATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.resolve(PRIVATE_DIR, "../../public/backend");
const imp = (dir, p) => import(pathToFileURL(path.join(dir, p)).href).then((m) => m.default);

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
const uri = replSet.getUri();
// Por si algún módulo de la tienda leyera DB_URI al cargarse: apunta a la
// base en memoria (dotenv no sobrescribe variables ya definidas).
process.env.DB_URI = uri;

// Cada backend tiene su propia instancia de mongoose (son paquetes aparte);
// ambas se conectan a la MISMA base en memoria, como en producción.
const publicMongoose = createRequire(path.join(PUBLIC_DIR, "package.json"))("mongoose");
let failed = false;
try {
  await mongoose.connect(uri, { dbName: "charly_verify_checkout" });
  await publicMongoose.connect(uri, { dbName: "charly_verify_checkout" });

  // Backend privado (panel).
  const Order = await imp(PRIVATE_DIR, "src/models/Order.js");
  const Inventory = await imp(PRIVATE_DIR, "src/models/InventoryItem.js");
  const Transaction = await imp(PRIVATE_DIR, "src/models/Transaction.js");
  const panelOrders = await imp(PRIVATE_DIR, "src/controller/ordersController.js");
  // Backend público (tienda).
  const Product = await imp(PUBLIC_DIR, "src/models/Product.js");
  const Customer = await imp(PUBLIC_DIR, "src/models/Customer.js");
  const PaymentTransaction = await imp(PUBLIC_DIR, "src/models/PaymentTransaction.js");
  const wompiClient = await imp(PUBLIC_DIR, "src/utils/wompiClient.js");
  const storeOrders = await imp(PUBLIC_DIR, "src/controller/ordersController.js");
  const { recordSaleTransaction } = await import(pathToFileURL(path.join(PUBLIC_DIR, "src/utils/salesTransaction.js")).href);
  for (const m of [Order, Inventory, Transaction]) await m.createCollection();

  // Cobro de Wompi simulado: nunca se llama al servicio real.
  wompiClient.tokenizeCard = async () => ({ token: "tok_prueba", tarjetaEnmascarada: "4573 **** **** 0693" });
  wompiClient.chargeTokenizedCard = async ({ monto }) => ({
    esAprobada: true,
    idTransaccion: "00000000-0000-4000-8000-000000000001",
    codigoAutorizacion: "00000000-0000-4000-8000-000000000002",
    mensaje: `Cobro simulado de ${monto}`,
  });

  async function call(handler, req, expected) {
    let status = 200;
    let payload;
    const res = {
      status(s) {
        status = s;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };
    await handler({ params: {}, body: {}, query: {}, ...req }, res);
    assert.equal(status, expected, `respuesta ${status}: ${JSON.stringify(payload?.message ?? payload)}`);
    return payload;
  }
  const check = (label, fn) => {
    fn();
    console.log(`✔ ${label}`);
  };

  // Datos de ejemplo.
  const product = await Product.create({ name: "Pajillas", slug: "pajillas", category: "Pajillas", price: 0.15, colors: ["Azul", "Rojo"], minOrderQuantity: 100 });
  const customer = await Customer.create({
    name: "Cliente",
    lastName: "de Prueba",
    email: "cliente.prueba@example.com",
    password: "x",
    phone: "70000000",
    addresses: [{ address: "Col. Escalón, San Salvador", isDefault: true }],
  });
  await Inventory.create({ name: "Pajilla", color: "Azul", category: "Producto Terminado", unit: "unidad", stock: 5000, minStock: 1000, location: "Bodega A-1" });

  // 1) Checkout real de la tienda: 300 pajillas azules a $0.15 = $45.00.
  const { order } = await call(
    storeOrders.checkout,
    {
      customer: { id: String(customer._id) },
      body: { items: [{ productId: String(product._id), quantity: 300, color: "Azul" }], card: { number: "4573000000000693", cvv: "123", month: "12", year: "2030" } },
    },
    201,
  );
  console.log(`Checkout: ${order.orderNumber} · ${order.status} · ${order.paymentStatus} · total $${order.total}`);

  // 2) Pedido y Finanzas.
  const saved = await Order.findById(order._id);
  check(`la línea guarda el nombre de Inventario: product = «${saved.items[0].product}»`, () => assert.equal(saved.items[0].product, "Pajilla"));
  const payments = await PaymentTransaction.countDocuments({ order: order._id, status: "aprobado" });
  check("se guardó el pago de Wompi (PaymentTransaction aprobado)", () => assert.equal(payments, 1));
  const sales = await Transaction.find({ relatedOrder: order._id });
  check(
    `se creó 1 Ingreso «Ventas» visible en Finanzas: ${sales[0]?.reference} · ${sales[0]?.concept} · $${sales[0]?.amount} · ${sales[0]?.status}`,
    () => {
      assert.equal(sales.length, 1);
      assert.equal(sales[0].type, "Ingreso");
      assert.equal(sales[0].category, "Ventas");
      assert.equal(sales[0].amount, 45);
      assert.equal(sales[0].amount, saved.total);
      assert.equal(sales[0].status, "Completado");
      assert.equal(sales[0].concept, `Venta pedido ${order.orderNumber}`);
    },
  );
  await recordSaleTransaction(saved);
  const again = await Transaction.countDocuments({ relatedOrder: order._id });
  check(`idempotente: registrarla otra vez no la duplica (${again} transacción)`, () => assert.equal(again, 1));

  // 3) El panel verifica la línea desde Bodega A-1: descuenta 300.
  await call(panelOrders.verifyOrderItem, { params: { id: String(order._id), index: "0" }, body: { warehouse: "Bodega A-1" } }, 200);
  const stock = (await Inventory.findOne({ name: "Pajilla", color: "Azul" })).stock;
  check(`Inventario: Pajilla Azul pasó de 5,000 a ${stock.toLocaleString("en-US")} (−300)`, () => assert.equal(stock, 4700));

  // 4) Contraste con el comportamiento anterior: «Pajillas» no encuentra existencia.
  const legacy = await Order.create({
    orderNumber: "ORD-LEGACY-0001",
    customer: { name: "Cliente de Prueba" },
    items: [{ product: "Pajillas", color: "Azul", quantity: 100, unitPrice: 0.15, subtotal: 15 }],
    total: 15,
    status: "Procesando",
    paymentStatus: "Pagado",
  });
  const legacyRes = await call(panelOrders.verifyOrderItem, { params: { id: String(legacy._id), index: "0" }, body: { warehouse: "Bodega A-1" } }, 409);
  check(`antes del arreglo («Pajillas») el panel respondía 409: «${legacyRes.message}»`, () => assert.match(legacyRes.message, /No hay existencia suficiente de Pajillas/));

  console.log("\nVerificación completa: todo en una base en memoria; no se tocó la base real.");
} catch (error) {
  failed = true;
  console.error(`\n✖ ${error.message}`);
} finally {
  await mongoose.disconnect().catch(() => {});
  await publicMongoose.disconnect().catch(() => {});
  await replSet.stop().catch(() => {});
  process.exitCode = failed ? 1 : 0;
}
