// Reinicio de la base con datos de demostración.
//
// ⚠ ESTE SCRIPT NO ES PARA CORRERSE RUTINARIAMENTE. Cada corrida con --run
//   BORRA todos los documentos de negocio (menos el administrador) y los
//   vuelve a generar desde cero. Nunca toca la estructura: no suelta ni
//   recrea colecciones, índices ni validadores; solo usa deleteMany() e
//   insertMany() sobre documentos, y antes de borrar respalda la base
//   completa en backups/pre-reset-AAAA-MM-DD-HHmm/ (si el respaldo falla,
//   no borra nada).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   node scripts/reset-and-seed.js              (= --dry-run, modo seguro)
//   node scripts/reset-and-seed.js --dry-run    (no escribe nada en la base)
//   node scripts/reset-and-seed.js --run        (respalda, borra y repuebla)
// Opciones para colecciones que no son del panel (ver COLLECTIONS):
//   --regenerar-productos   borra y recrea el catálogo de la tienda (sin imágenes)
//   --incluir-tienda        reemplaza cuentas, compras y pagos de la tienda en línea
//
// Subcategorías: el «producto» de todo el sistema es el nombre de una
// subcategoría (Configuración > Subcategorías, ver SUBCATEGORIES): se guarda
// como texto en orders.items.product, productionbatches.product,
// dailybatches.product e inventoryitems.name (Producto Terminado). Cada corrida
// reinicia la colección `subcategories` con las 7 iniciales (4 de Pajillas y 3
// de Pelotas) y genera pedidos, lotes, producción diaria, inventario, rutas y
// finanzas usando solo esos nombres. El catálogo (`products`) se CONSERVA con
// sus imágenes: cada producto se empareja con su subcategoría por nombre
// (ignorando mayúsculas, tildes y espacios extra; la categoría debe coincidir)
// y con --run solo se le asigna el campo `subcategory` (un updateOne por _id,
// nada más del producto cambia). Si un producto no empareja, o dos emparejan
// con la misma subcategoría, o una subcategoría queda sin producto, el script
// se detiene sin hacer nada. Los precios, mínimos de pedido y colores salen de
// ese producto; los parámetros de fabricación (costo, stock mínimo, tamaño de
// lote, unidades por día, líneas y bodega) son por CATEGORÍA (CATEGORY_INFO) y
// sus cantidades se reparten entre las subcategorías de la categoría.
//
// Pedidos: todos son compras de la tienda en línea, como las deja el checkout de
// public/backend (cliente con correo de su cuenta, «Procesando» desde el
// inicio, ya pagados y con su Ingreso en Finanzas). No hay estado de pago, ni
// pedidos pendientes de cobro, ni reembolsos. Sin --incluir-tienda los pedidos
// quedan con el correo de cuentas que no se crean: úsalo siempre en una corrida real.
//
// Cómo se generan los datos: en vez de armar documentos a mano, el script
// ejecuta la lógica real del sistema (los mismos controladores que usa el
// panel: inventario, lotes, rutas y finanzas; los pedidos se arman como los
// arma el checkout de la tienda, que el panel ya no tiene) sobre una base
// MongoDB EN MEMORIA, con un reloj simulado que avanza desde hace ~15
// semanas hasta hoy. Así el stock, el statusHistory, los lotes y las rutas
// quedan exactamente como si el sistema se hubiera usado de verdad. Después
// se copian esos documentos a la base real (solo con --run). Con la misma
// semilla, el dry-run y la corrida real generan los mismos datos (salvo lo
// que depende de la hora en que se corra).
//
// Rutas: cada una lleva su código R-AAAA-NNNN (el que asigna createRoute del
// backend, con el consecutivo del año) y se generan a lo largo de ~15 semanas:
// completadas de semanas anteriores (despacho automático martes y viernes), las
// de esta semana, y activas creadas un día antes (una En tránsito y una
// Pendiente), para probar el rango de fechas de Logística. Un motorista o una
// placa nunca están en dos rutas activas a la vez (disponibilidad sin fecha).
//
// Moneda: dólares (USD). La tienda, el panel ($) y el catálogo ya trabajan
// en USD; los montos siguen los precios reales del catálogo.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import bcryptjs from "bcryptjs";
import { backupCollections } from "./lib/backup.js";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED = 20260926;

/* -------------------------------------------------------------------------- */
/* Colecciones                                                                 */
/* -------------------------------------------------------------------------- */

// Colecciones del panel que se reinician (todas con deleteMany + insertMany).
const PANEL = [
  "employees", // se conserva el administrador (role: "admin")
  "warehouses",
  "vehicles",
  "workschedules",
  "subcategories", // las 7 iniciales (ver SUBCATEGORIES)
  "inventoryitems",
  "orders",
  "productionbatches",
  "dailybatches",
  "routes",
  "transactions",
];
// Catálogo de la tienda: lo usa el panel (Catálogo), pero sus imágenes viven
// en Cloudinary. Por defecto se conserva (solo se le asigna `subcategory` a
// cada producto); con --regenerar-productos se recrea sin imágenes, con un
// producto por subcategoría.
const PRODUCTS = "products";
// Tienda en línea (public/backend): no son módulos del panel. Por defecto no
// se tocan; con --incluir-tienda se vacían y se repueblan con cuentas y
// compras enlazadas a pedidos nuevos de `orders` (ver STORE_ACCOUNTS).
const STORE = ["customers", "customerorders", "paymenttransactions"];
// Restos de una versión anterior: ningún código del proyecto las usa.
// Nunca se tocan.
const LEGACY = ["inventorymovements", "stockmovements"];

/* -------------------------------------------------------------------------- */
/* Azar reproducible y reloj simulado                                          */
/* -------------------------------------------------------------------------- */

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const qstep = (a, b, s) => int(Math.ceil(a / s), Math.floor(b / s)) * s;
// Azar aparte para los detalles de la tienda (notas, horas de alta, ms entre
// documentos), así no mueve la secuencia de los datos del panel.
const storeRand = mulberry32(SEED + 1);
const storeInt = (a, b) => a + Math.floor(storeRand() * (b - a + 1));

const RealDate = Date;
let fakeNow = null;
// La clase debe llamarse «Date»: Mongoose reconoce las fechas por el nombre
// del constructor al clonarlas (con otro nombre las guardaría como número).
const SimDate = class Date extends RealDate {
  constructor(...args) {
    if (args.length === 0 && fakeNow != null) super(fakeNow);
    else super(...args);
  }
  static now() {
    return fakeNow ?? RealDate.now();
  }
  static [Symbol.hasInstance](value) {
    return value instanceof RealDate;
  }
};

/* -------------------------------------------------------------------------- */
/* Tiempo en El Salvador (UTC-6, sin horario de verano)                        */
/* -------------------------------------------------------------------------- */

const NOW = RealDate.now();
const NOW_LIMIT = NOW - 3 * 60 * 1000; // lo de «hoy» nunca queda en el futuro
const svParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit" })
  .format(NOW)
  .split("-")
  .map(Number);
const [TY, TM, TD] = svParts;

// Instante a las hh:mm (hora de El Salvador) del día `offset` respecto de hoy.
function sv(offset, hh, mm = 0) {
  return Math.min(RealDate.UTC(TY, TM - 1, TD + offset, hh + 6, mm), NOW_LIMIT);
}
const dayKey = (offset) => new RealDate(RealDate.UTC(TY, TM - 1, TD + offset)).toISOString().slice(0, 10);
const weekday = (offset) => new RealDate(RealDate.UTC(TY, TM - 1, TD + offset)).getUTCDay(); // 0 domingo
// Semana laboral de lunes a sábado (sábado medio día, 07:00–11:00).
const isWorkday = (offset) => weekday(offset) >= 1 && weekday(offset) <= 6;
const isSaleDay = (offset) => weekday(offset) !== 0;
function nextWorkday(offset) {
  let o = offset + 1;
  while (!isWorkday(o)) o += 1;
  return o;
}
const SIM_START = -108; // ~15 semanas atrás
// Offset del n-ésimo día hábil antes de hoy (0 = hoy si es hábil).
function back(n) {
  let o = 0;
  while (!isWorkday(o)) o -= 1;
  for (let k = 0; k < n; k += 1) {
    o -= 1;
    while (!isWorkday(o)) o -= 1;
  }
  return o;
}

/* -------------------------------------------------------------------------- */
/* Datos base (patrones reales de la base: productos, colores, bodegas…)       */
/* -------------------------------------------------------------------------- */

const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

// Subcategorías iniciales (Configuración > Subcategorías): nombre EXACTO,
// categoría y activa. `price` y `min` solo se usan para recrear el catálogo con
// --regenerar-productos (con el catálogo real, precio, mínimo y colores salen
// del producto emparejado).
const SUBCATEGORIES = [
  { name: "Pelotas de Celuloide", category: "Pelotas", price: 0.05, min: 400 },
  { name: "Pelotas Inflables", category: "Pelotas", price: 0.15, min: 1 },
  { name: "Pelotas LDPE", category: "Pelotas", price: 0.25, min: 50 },
  { name: "Pajillas Mezcladoras", category: "Pajillas", price: 0.08, min: 300 },
  { name: "Pajillas Rectas", category: "Pajillas", price: 0.15, min: 100 },
  { name: "Pajillas Flexibles", category: "Pajillas", price: 0.1, min: 100 },
  { name: "Pajillas Anchas", category: "Pajillas", price: 0.2, min: 100 },
];
const SUB_NAMES = SUBCATEGORIES.map((s) => s.name);
const subsOf = (category) => SUBCATEGORIES.filter((s) => s.category === category).map((s) => s.name);
const categoryOf = (name) => SUBCATEGORIES.find((s) => s.name === name).category;

// Parámetros de fabricación por CATEGORÍA (los de antes, cuando «Pajilla» y
// «Pelota» eran los dos productos). Las cantidades (stock mínimo, tamaño de
// lote y existencia inicial) se reparten entre las subcategorías de la
// categoría, así el total por categoría queda parecido al de antes.
const CATEGORY_INFO = {
  Pajillas: { unitCost: 0.06, minStock: 15000, batch: 40000, perDay: 25000, lines: ["Línea 1", "Línea 2"], warehouse: "Bodega A-1", stockStep: 1000 },
  Pelotas: { unitCost: 0.11, minStock: 2000, batch: 6000, perDay: 4000, lines: ["Línea 3", "Línea 4"], warehouse: "Bodega A-2", stockStep: 100 },
};
const infoOf = (sub) => CATEGORY_INFO[categoryOf(sub)];
const share = (sub, total, step) => Math.max(step, Math.round(total / subsOf(categoryOf(sub)).length / step) * step);
const minStockOf = (sub) => share(sub, infoOf(sub).minStock, 50);
const batchOf = (sub) => share(sub, infoOf(sub).batch, 500);

// Combinaciones reservadas para que al final haya existencia parcial y
// productos agotados (no entran en pedidos al azar ni se reponen). Antes:
// Pelota Amarillo (agotada), Pajilla Negro (2 500) y Pelota Negro (600).
const RESERVED = {
  "Pelotas de Celuloide|Amarillo": 0,
  "Pelotas Inflables|Amarillo": 0,
  "Pelotas LDPE|Amarillo": 0,
  "Pajillas Flexibles|Negro": 2500,
  "Pelotas LDPE|Negro": 600,
};
const isReserved = (sub, color) => `${sub}|${color}` in RESERVED;

const WAREHOUSES = ["Bodega A-1", "Bodega A-2", "Bodega B-1"];
const VEHICLES = ["P-512-KLM", "C-208-RTS", "P-731-BNX", "C-119-HDP"];
const STOP_REASONS = [
  "Falta de resina PP en tolva",
  "Falla en el cabezal de la extrusora",
  "Cambio de molde",
  "Mantenimiento preventivo de la línea",
  "Corte de energía en la planta",
];

const EMPLOYEES = [
  { name: "Ricardo", lastName: "Portillo", department: "Fabricación", position: "Jefe de producción", hourlyRate: 4.5, hire: "2022-03-14" },
  { name: "Karla", lastName: "Rivas", department: "Fabricación", position: "Operaria", hourlyRate: 2.35, hire: "2023-06-05" },
  { name: "José", lastName: "Alfaro", department: "Fabricación", position: "Operario", hourlyRate: 2.35, hire: "2024-01-15" },
  { name: "Miguel", lastName: "Hernández", department: "Fabricación", position: "Operario", hourlyRate: 2.2, hire: "2025-02-03" },
  { name: "Andrea", lastName: "Flores", department: "Fabricación", position: "Operaria", hourlyRate: 2.2, hire: "2024-08-19", isActive: false },
  { name: "Óscar", lastName: "Menjívar", department: "Almacén", position: "Encargado de bodega", hourlyRate: 3.1, hire: "2022-09-01" },
  { name: "Diana", lastName: "Castillo", department: "Almacén", position: "Auxiliar de bodega", hourlyRate: 2.3, hire: "2025-04-21" },
  { name: "Julio", lastName: "Cañas", department: "Logística", position: "Motorista", hourlyRate: 2.6, hire: "2023-01-09" },
  { name: "Marvin", lastName: "Orellana", department: "Logística", position: "Motorista", hourlyRate: 2.6, hire: "2023-11-13" },
  { name: "Ernesto", lastName: "Guardado", department: "Logística", position: "Motorista", hourlyRate: 2.5, hire: "2025-06-02" },
  { name: "Sofía", lastName: "Aguilar", department: "Finanzas", position: "Contadora", hourlyRate: 4.2, hire: "2022-05-16" },
  { name: "Gabriela", lastName: "Mejía", department: "Administración", position: "Ejecutiva de ventas", hourlyRate: 3.4, hire: "2024-03-04" },
];

// Clientes (ficticios) con la zona de reparto según su ciudad.
const ZONES = {
  SS: "San Salvador",
  ST: "Santa Tecla – La Libertad",
  SO: "Soyapango – Ilopango",
  AM: "Apopa – Mejicanos",
  OR: "San Miguel – Oriente",
  OC: "Santa Ana – Occidente",
};
const CUSTOMERS = [
  { name: "Cafetería Los Almendros", address: "Calle La Mascota #214, Col. Maquilishuat, San Salvador", zone: "SS", buys: "Pajillas", big: true },
  { name: "Licuados y Batidos Tropicana", address: "Blvd. Constitución #88, San Salvador", zone: "SS", buys: "Pajillas", big: true },
  { name: "Sorbetería Los Pinos", address: "79 Av. Norte #305, Col. Escalón, San Salvador", zone: "SS", buys: "Pajillas", big: true },
  { name: "Cafetín Universitario La Esquina", address: "Autopista Norte, frente a Ciudad Universitaria, San Salvador", zone: "SS", buys: "Pajillas", big: false },
  { name: "Heladería Nevada Tropical", address: "Paseo El Carmen #7, Santa Tecla", zone: "ST", buys: "Pajillas", big: true },
  { name: "Colegio San Andrés", address: "Col. Jardines de la Sabana, Calle Circunvalación #40, Santa Tecla", zone: "ST", buys: "Pelotas", big: true },
  { name: "Parque Acuático Las Palmeras", address: "Carretera al Puerto de La Libertad Km 28, La Libertad", zone: "ST", buys: "both", big: true },
  { name: "Pupusería y Comedor Doña Mari", address: "3a Calle Poniente, Barrio El Centro, Soyapango", zone: "SO", buys: "Pajillas", big: false },
  { name: "Distribuidora El Rosario", address: "Km 12 Carretera de Oro, Ilopango", zone: "SO", buys: "both", big: true },
  { name: "Centro Escolar Católico Santa Rosa", address: "Col. Las Margaritas, Pje. 3, Soyapango", zone: "SO", buys: "Pelotas", big: true },
  { name: "Minisúper El Buen Precio", address: "Res. Miralvalle, Pje. 4 #12, Mejicanos", zone: "AM", buys: "both", big: false },
  { name: "Comercial Hermanos Villalta", address: "Col. San José, Calle Principal #56, Apopa", zone: "AM", buys: "both", big: true },
  { name: "Juguetería Arcoíris", address: "Av. Roosevelt Sur #1520, San Miguel", zone: "OR", buys: "Pelotas", big: true },
  { name: "Piñatería y Fiestas Carolina", address: "2a Av. Norte #510, Barrio San Felipe, San Miguel", zone: "OR", buys: "Pelotas", big: false },
  { name: "Distribuidora de Desechables Oriente", address: "Carretera Panamericana Km 138, San Miguel", zone: "OR", buys: "Pajillas", big: true },
  { name: "Refresquería La Ceiba", address: "Av. Independencia Sur #18, Santa Ana", zone: "OC", buys: "Pajillas", big: false },
  { name: "Restaurante Brisas del Lago", address: "Carretera al Lago de Coatepeque, El Congo, Santa Ana", zone: "OC", buys: "Pajillas", big: true },
  { name: "Deportes La Cancha", address: "Calle Libertad Oriente #22, Santa Ana", zone: "OC", buys: "Pelotas", big: false },
  { name: "María José Hernández", address: "Urb. La Coruña, Senda 3 #20, Soyapango", zone: "SO", buys: "Pelotas", big: false },
  { name: "Carlos Alberto Meléndez", address: "Col. Ciudad Pacífica, Pje. 7 #14, San Miguel", zone: "OR", buys: "Pelotas", big: false },
  { name: "Ana Beatriz Rivas", address: "Res. Altamira, Calle 2 #45, Santa Ana", zone: "OC", buys: "Pajillas", big: false },
  { name: "Luis Fernando Chávez", address: "Col. Médica, Av. Dr. Emilio Álvarez #612, San Salvador", zone: "SS", buys: "Pelotas", big: false },
  { name: "Daniela Alejandra Quintanilla", address: "Res. Villas de San Antonio, Pol. C #9, Santa Tecla", zone: "ST", buys: "Pajillas", big: false },
  { name: "Jorge Ernesto Alvarado", address: "Col. Zacamil, Edificio 23, Apto. 4, Mejicanos", zone: "AM", buys: "both", big: false },
];

// Cuentas de la tienda en línea (public/backend). Los pedidos se crean como los
// crea el checkout: con el correo de la cuenta, ya pagados con Wompi y en
// «Procesando». Los correos usan el dominio reservado example.com
// para que la recuperación de contraseña nunca le escriba a alguien real.
// `orders: false`: cuenta registrada que todavía no ha comprado.
const STORE_ACCOUNTS = [
  { full: "María José Hernández", name: "María José", lastName: "Hernández", email: "mariajose.hernandez@example.com", phone: "76412083", city: "Soyapango", card: "4417" },
  { full: "Carlos Alberto Meléndez", name: "Carlos Alberto", lastName: "Meléndez", email: "carlos.melendez87@example.com", phone: "71938452", city: "San Miguel", card: "0935" },
  {
    full: "Ana Beatriz Rivas", name: "Ana Beatriz", lastName: "Rivas", email: "anabeatriz.rivas@example.com", phone: "60827719", city: "Santa Ana", card: "2268",
    extra: { label: "Oficina", address: "Centro Comercial Metrocentro Santa Ana, local 12, Santa Ana", city: "Santa Ana" },
  },
  { full: "Luis Fernando Chávez", name: "Luis Fernando", lastName: "Chávez", email: "lfchavez@example.com", phone: "78805134", city: "San Salvador", card: "7702" },
  { full: "Daniela Alejandra Quintanilla", name: "Daniela Alejandra", lastName: "Quintanilla", email: "dani.quintanilla@example.com", phone: "70315562", city: "Santa Tecla", card: "5184" },
  { full: "Jorge Ernesto Alvarado", name: "Jorge Ernesto", lastName: "Alvarado", email: "jorge.alvarado.sv@example.com", phone: "61247790", city: "Mejicanos", card: "3351" },
  {
    full: "Karen Lissette Campos", name: "Karen Lissette", lastName: "Campos", email: "karen.campos@example.com", phone: "75093318", city: "San Salvador", card: null,
    address: "Col. Flor Blanca, 45 Av. Sur #1215, San Salvador", orders: false,
  },
];
// Todos los pedidos llegan de la tienda: los clientes que no tienen una cuenta
// propia arriba (los negocios) compran con una cuenta a nombre del negocio.
// Datos deterministas a partir del nombre (no gastan números aleatorios).
{
  const slugOf = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  const hashOf = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  for (const c of CUSTOMERS) {
    if (STORE_ACCOUNTS.some((a) => a.full === c.name)) continue;
    const h = hashOf(c.name);
    STORE_ACCOUNTS.push({
      full: c.name,
      name: c.name,
      lastName: "",
      email: `${slugOf(c.name)}@example.com`,
      phone: `2${String(1000000 + (h % 9000000))}`,
      city: c.address.split(",").pop().trim(),
      card: String(1000 + (h % 9000)),
    });
  }
}
const storeAccount = (name) => STORE_ACCOUNTS.find((a) => a.full === name && a.orders !== false);
const STORE_NOTES = [
  "Casa de portón negro, frente a la tienda de la esquina",
  "Llamar antes de llegar, por favor",
  "Dejar con el vigilante de la residencial",
  "Entregar en horario de oficina",
];
// Mensaje que devuelve Wompi en modo de prueba (igual al de los registros existentes).
const WOMPI_TEST_MESSAGE = "Esta no es una transacción real, ya que el aplicativo está en modo de prueba.";

/* -------------------------------------------------------------------------- */
/* Simulación sobre una base en memoria                                        */
/* -------------------------------------------------------------------------- */

// `catalog`: un elemento por subcategoría con el producto del catálogo que le
// corresponde: { sub, price, min, colors } (ver pairProducts / catalogDocs).
async function simulate(catalog) {
  const byName = new Map(catalog.map((c) => [c.sub, c]));
  const priceOf = (sub) => byName.get(sub).price;
  const minOf = (sub) => byName.get(sub).min;
  // Colores del producto, en el orden canónico de COLORS.
  const colorsOf = (sub) => COLORS.filter((c) => byName.get(sub).colors.includes(c));
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const log = { warnings: [] };
  try {
    await mongoose.connect(replSet.getUri(), { dbName: "charly_seed" });
    const imp = (p) => import(pathToFileURL(path.join(BACKEND_DIR, p)).href).then((m) => m.default);
    const [Employee, Warehouse, Vehicle, WorkSchedule, Inventory, Order, Batch, DailyBatch, Route, Transaction, Subcategory] = await Promise.all(
      ["Employee", "Warehouse", "Vehicle", "WorkSchedule", "InventoryItem", "Order", "ProductionBatch", "DailyBatch", "Route", "Transaction", "Subcategory"].map((m) =>
        imp(`src/models/${m}.js`),
      ),
    );
    const ordersCtl = await imp("src/controller/ordersController.js");
    const batchCtl = await imp("src/controller/productionBatchesController.js");
    const dailyCtl = await imp("src/controller/dailyBatchesController.js");
    const routesCtl = await imp("src/controller/routesController.js");
    const txCtl = await imp("src/controller/transactionsController.js");
    const { generateReference } = await import(pathToFileURL(path.join(BACKEND_DIR, "src/controller/transactionsController.js")).href);
    for (const m of [Employee, Warehouse, Vehicle, WorkSchedule, Inventory, Order, Batch, DailyBatch, Route, Transaction, Subcategory]) await m.createCollection();
    await Route.syncIndexes();
    // Los controladores validan que el producto sea una subcategoría activa:
    // en la base en memoria existen desde el principio (antes del reloj simulado).
    await Subcategory.create(SUBCATEGORIES.map(({ name, category }) => ({ name, category, active: true })));

    // Reloj simulado: se activa después de cargar los modelos (Mongoose
    // resuelve el tipo Date al definir los esquemas).
    globalThis.Date = SimDate;
    fakeNow = RealDate.UTC(TY, TM - 1, TD + SIM_START, 12);

    // Llama un controlador con req/res mínimos; un error de negocio corta la simulación.
    async function call(handler, { params = {}, body = {}, query = {} } = {}, label = "") {
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
        cookie() {
          return this;
        },
      };
      await handler({ params, body, query }, res);
      if (status >= 400) throw new Error(`${label || "acción"} (${new RealDate(fakeNow).toISOString()} · ${JSON.stringify(params)}): ${status} ${payload?.message ?? ""}`);
      return payload;
    }

    // --- Cola de eventos en orden cronológico ------------------------------
    const queue = [];
    let seq = 0;
    const at = (t, fn) => queue.push({ t: Math.min(t, NOW_LIMIT), seq: seq++, fn });
    // Ejecuta, en orden, los eventos con hora <= limit (los eventos pueden
    // agendar otros). El guion de los últimos días avanza con esto, así sus
    // pasos quedan intercalados con los eventos automáticos.
    async function runUntil(limit) {
      for (;;) {
        let i = -1;
        for (let j = 0; j < queue.length; j += 1) {
          if (queue[j].t > limit) continue;
          if (i < 0 || queue[j].t < queue[i].t || (queue[j].t === queue[i].t && queue[j].seq < queue[i].seq)) i = j;
        }
        if (i < 0) return;
        const [ev] = queue.splice(i, 1);
        fakeNow = Math.max(fakeNow, ev.t);
        await ev.fn();
      }
    }

    // --- Empleados, bodegas, vehículos, horario ----------------------------
    fakeNow = RealDate.UTC(TY, TM - 1, TD + SIM_START, 13);
    const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const schedule = { startTime: "07:00", workdayHours: 8 };
    const employees = [];
    for (const e of EMPLOYEES) {
      const attendance = [];
      if (e.isActive !== false) {
        for (let o = -28; o <= -1; o += 1) {
          const saturday = weekday(o) === 6;
          const operative = ["Fabricación", "Almacén", "Logística"].includes(e.department);
          if (!isWorkday(o) || (saturday && !operative) || chance(0.05)) continue; // ~5 % de ausencias
          const late = chance(0.1);
          const inMin = late ? int(8, 40) : -int(0, 18);
          const extra = saturday ? 0 : e.department === "Fabricación" || e.department === "Logística" ? (chance(0.3) ? int(30, 150) : 0) : chance(0.1) ? int(20, 60) : 0;
          const checkIn = new RealDate(sv(o, 7, 0) + inMin * 60000);
          const checkOut = new RealDate(sv(o, saturday ? 11 : 15, 0) + (extra + int(0, 10)) * 60000);
          const worked = Number(((checkOut - checkIn) / 3600000).toFixed(2));
          attendance.push({
            date: new RealDate(`${dayKey(o)}T00:00:00.000Z`),
            checkIn,
            checkOut,
            workedHours: worked,
            overtimeHours: Number(Math.max(0, worked - schedule.workdayHours).toFixed(2)),
          });
        }
      }
      employees.push(
        await Employee.create({
          name: e.name,
          lastName: e.lastName,
          dui: String(int(10000000, 69999999)) + String(int(0, 9)),
          phone: `7${int(100, 999)}-${int(1000, 9999)}`,
          email: `${slug(e.name)}.${slug(e.lastName)}@industriascharly.com`,
          // Contraseña aleatoria que nadie conoce: solo el administrador inicia sesión.
          password: await bcryptjs.hash(crypto.randomBytes(24).toString("hex"), 10),
          position: e.position,
          department: e.department,
          hourlyRate: e.hourlyRate,
          isActive: e.isActive !== false,
          hireDate: new RealDate(`${e.hire}T14:00:00.000Z`),
          attendance,
        }),
      );
    }
    const operators = employees.filter((e) => e.department === "Fabricación" && e.isActive && e.position !== "Jefe de producción");
    const drivers = employees.filter((e) => e.department === "Logística" && e.isActive);
    await Warehouse.create(WAREHOUSES.map((name) => ({ name })));
    await Vehicle.create(VEHICLES.map((plate) => ({ plate })));
    await WorkSchedule.create(schedule);

    // --- Inventario inicial ------------------------------------------------
    // Producto Terminado: una fila por subcategoría + color (los colores del
    // producto del catálogo) en la bodega de su categoría.
    const finished = [];
    for (const sub of SUB_NAMES) {
      const info = infoOf(sub);
      const n = subsOf(categoryOf(sub)).length;
      for (const color of colorsOf(sub)) {
        const reserved = RESERVED[`${sub}|${color}`];
        finished.push({
          name: sub,
          category: "Producto Terminado",
          color,
          unit: "unidad",
          stock: reserved ?? qstep((info.minStock * 2.5) / n, (info.minStock * 4.5) / n, info.stockStep),
          minStock: reserved != null ? share(sub, categoryOf(sub) === "Pajillas" ? 5000 : 1000, 50) : minStockOf(sub),
          unitCost: info.unitCost,
          location: info.warehouse,
        });
      }
    }
    await Inventory.create(finished);
    const RAW = [
      ["Polipropileno homopolímero (PP)", "Polimero", "kg", 2400, 1500, 1.35],
      ["Polietileno de alta densidad (HDPE)", "Polimero", "kg", 950, 1200, 1.28],
      ["Masterbatch rojo", "Aditivo", "kg", 85, 40, 4.9],
      ["Masterbatch azul", "Aditivo", "kg", 62, 40, 4.9],
      ["Masterbatch verde", "Aditivo", "kg", 28, 40, 4.9],
      ["Masterbatch amarillo", "Aditivo", "kg", 47, 40, 4.9],
      ["Masterbatch negro", "Aditivo", "kg", 55, 30, 4.6],
      ["Dióxido de titanio (blanco)", "Aditivo", "kg", 110, 50, 3.8],
      ["Tinta roja", "Tinta", "litro", 18, 10, 12.5],
      ["Tinta azul", "Tinta", "litro", 6, 10, 12.5],
      ["Caja de empaque", "Insumo", "unidad", 1850, 800, 0.42],
      ["Bolsa plástica de empaque", "Insumo", "unidad", 5200, 3000, 0.03],
      ["Etiqueta adhesiva de lote", "Insumo", "unidad", 900, 1500, 0.02],
    ];
    await Inventory.create(
      RAW.map(([name, materialType, unit, stock, minStock, unitCost]) => ({
        name,
        category: "Materia Prima",
        materialType,
        unit,
        stock,
        minStock,
        unitCost,
        location: "Bodega B-1",
      })),
    );

    // --- Utilidades de negocio --------------------------------------------
    const stockRows = (product, color) => Inventory.find({ name: product, color, category: "Producto Terminado", batchNumber: { $exists: false } });
    async function bestStock(product, color) {
      const rows = await stockRows(product, color);
      rows.sort((a, b) => b.stock - a.stock);
      return rows[0] ? { warehouse: rows[0].location, stock: rows[0].stock } : { warehouse: infoOf(product).warehouse, stock: 0 };
    }
    const idOf = (d) => String(d._id);
    const loadOrder = (id) => Order.findById(id);
    const opFor = () => idOf(pick(operators));
    const lineFor = (product) => pick(infoOf(product).lines);
    const manual = new Set(); // pedidos con guion propio (no los toca el despacho automático)
    const storeOrders = []; // compras de la tienda: { id, account }

    // Siguiente N° de pedido del año (ORD-2026-0001…): igual que el checkout.
    async function nextOrderNumber() {
      const prefix = `ORD-${new Date().getFullYear()}-`;
      const last = await Order.findOne({ orderNumber: { $regex: `^${prefix}` } }).sort({ orderNumber: -1 });
      const lastNumber = last ? parseInt(last.orderNumber.slice(prefix.length), 10) : 0;
      return `${prefix}${String((Number.isNaN(lastNumber) ? 0 : lastNumber) + 1).padStart(4, "0")}`;
    }

    // Una compra de la tienda, como la deja el checkout de public/backend
    // (controller/ordersController.js): pedido «Procesando» con el correo de la
    // cuenta, que pasa solo a Inventario, y su Ingreso «Ventas» en Finanzas al
    // crearse. Los pedidos ya no se crean desde el panel.
    async function newOrder(customer, items) {
      const lines = items.map(({ product, color, quantity }) => ({
        product,
        color,
        quantity,
        unitPrice: priceOf(product),
        subtotal: Number((quantity * priceOf(product)).toFixed(2)),
      }));
      const total = Number(lines.reduce((s, l) => s + l.subtotal, 0).toFixed(2));
      const account = storeAccount(customer.name);
      if (!account) throw new Error(`«${customer.name}» no tiene cuenta de tienda: todos los pedidos deben salir de la tienda`);
      const createdAt = new Date();
      const order = new Order({
        orderNumber: await nextOrderNumber(),
        customer: { name: customer.name, email: account.email, phone: account.phone, address: customer.address },
        items: lines,
        total,
        source: "ecommerce",
        notes: storeRand() < 0.35 ? STORE_NOTES[storeInt(0, STORE_NOTES.length - 1)] : undefined,
        status: "Procesando",
        statusHistory: [{ status: "Procesando", at: createdAt }],
        sentToInventoryAt: createdAt,
      });
      await order.save();
      // Transaction.date usa default: Date.now, que Mongoose fijó al cargar el
      // esquema (antes del reloj simulado): se pone la hora de la compra.
      await Transaction.create({
        reference: await generateReference(),
        concept: `Venta pedido ${order.orderNumber}`,
        type: "Ingreso",
        category: "Ventas",
        amount: order.total,
        status: "Completado",
        date: createdAt,
        relatedOrder: order._id,
        orderNumber: order.orderNumber,
      });
      const id = String(order._id);
      storeOrders.push({ id, account });
      return id;
    }
    const line = (id, index) => ({ id, index: String(index) });

    // Lote de un pedido: iniciar, completar y empacar (si `packAt` llega).
    function scheduleOrderLot(orderId, index, { startAt, stop = null, finishAt = null, packAt = null }) {
      at(startAt, async () => {
        const o = await loadOrder(orderId);
        const item = o.items[index];
        const lotId = String(item.manufacturingBatch);
        await call(batchCtl.startBatch, { params: { id: lotId }, body: { productionLine: lineFor(item.product), operator: opFor() } }, "iniciar lote de pedido");
        if (stop) {
          at(stop.at, () => call(batchCtl.stopBatch, { params: { id: lotId }, body: { reason: stop.reason } }, "detener lote"));
          if (stop.resumeAt) at(stop.resumeAt, () => call(batchCtl.resumeBatch, { params: { id: lotId } }, "reanudar lote"));
        }
        if (finishAt) {
          at(finishAt, async () => {
            const batch = await Batch.findById(lotId);
            await call(batchCtl.completeBatch, { params: { id: lotId }, body: { producedQuantity: batch.targetQuantity } }, "completar lote de pedido");
          });
        }
        if (packAt) at(packAt, () => call(ordersCtl.packManufacturedItem, { params: line(orderId, index) }, "empacar lote de pedido"));
      });
    }

    // Procesa en Inventario cada línea según la existencia de ese momento.
    async function processLines(orderId, when, { autoFlow = true } = {}) {
      const o = await loadOrder(orderId);
      for (let index = 0; index < o.items.length; index += 1) {
        const item = o.items[index];
        const best = await bestStock(item.product, item.color);
        if (best.stock >= item.quantity) {
          await call(ordersCtl.verifyOrderItem, { params: line(orderId, index), body: { warehouse: best.warehouse } }, "verificar");
          if (autoFlow) at(when + int(40, 150) * 60000, () => call(ordersCtl.packOrderItem, { params: line(orderId, index) }, "empacar"));
        } else {
          if (best.stock >= Math.max(1, item.quantity * 0.25)) {
            await call(ordersCtl.splitPartialItem, { params: line(orderId, index), body: { warehouse: best.warehouse, quantity: best.stock } }, "dividir");
            if (autoFlow) at(when + int(40, 150) * 60000, () => call(ordersCtl.packOrderItem, { params: line(orderId, index) }, "empacar parte de bodega"));
          } else {
            await call(ordersCtl.sendItemToManufacturing, { params: line(orderId, index) }, "enviar a fabricación");
          }
          if (autoFlow) {
            const lot = await Batch.findById((await loadOrder(orderId)).items[index].manufacturingBatch);
            const startDay = nextWorkday(dayOffsetOf(when));
            const days = Math.max(1, Math.ceil(lot.targetQuantity / infoOf(item.product).perDay));
            let endDay = startDay;
            for (let k = 1; k < days; k += 1) endDay = nextWorkday(endDay);
            scheduleOrderLot(orderId, index, {
              startAt: sv(startDay, 7, int(5, 30)),
              finishAt: sv(endDay, int(13, 15), int(0, 59)),
              packAt: sv(endDay, 16, int(0, 40)),
            });
          }
        }
      }
    }
    const dayOffsetOf = (t) => Math.round((RealDate.UTC(...new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit" }).format(t).split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) - RealDate.UTC(TY, TM - 1, TD)) / 86400000);

    // --- Pedidos históricos (hasta hace 4 días) ----------------------------
    // Colores que se compran al azar de una subcategoría: sin los reservados,
    // salvo Amarillo en Pelotas (agotado a propósito: esos pedidos van a fabricación).
    const buyable = (sub) => colorsOf(sub).filter((c) => !isReserved(sub, c) || (categoryOf(sub) === "Pelotas" && c === "Amarillo"));
    function randomItems(customer) {
      const categories = customer.buys === "both" ? (chance(0.5) ? ["Pajillas", "Pelotas"] : [pick(["Pajillas", "Pelotas"])]) : [customer.buys];
      const items = [];
      for (const category of categories) {
        // Cada cliente compra una de las subcategorías de la categoría.
        const product = pick(subsOf(category));
        const colors = [...buyable(product)].sort(() => rand() - 0.5).slice(0, customer.big && chance(0.35) ? 2 : 1);
        for (const color of colors) {
          // Compras de la tienda: cantidades de menudeo.
          const store = storeAccount(customer.name);
          const quantity =
            category === "Pajillas"
              ? customer.big
                ? qstep(8000, 25000, 1000)
                : store
                  ? qstep(300, 1500, 100)
                  : qstep(1000, 3000, 500)
              : customer.big
                ? qstep(1000, 4000, 100)
                : store
                  ? qstep(50, 300, 50)
                  : qstep(100, 400, 50);
          // Nunca por debajo del mínimo de pedido del producto.
          items.push({ product, color, quantity: Math.max(quantity, minOf(product)) });
        }
      }
      return items;
    }
    for (let o = SIM_START + 2; o <= -4; o += 1) {
      if (!isSaleDay(o)) continue;
      const count = weekday(o) === 6 ? (chance(0.3) ? 1 : 0) : chance(0.45) ? 1 : chance(0.12) ? 2 : 0;
      for (let k = 0; k < count; k += 1) {
        const createdAt = sv(o, int(8, 16), int(0, 59));
        const customer = { ...pick(chance(0.75) ? CUSTOMERS.filter((c) => c.big) : CUSTOMERS.filter((c) => !c.big)) };
        at(createdAt, async () => {
          const id = await newOrder(customer, randomItems(customer));
          const processAt = createdAt + int(90, 360) * 60000;
          at(processAt, () => processLines(id, processAt));
        });
      }
    }

    // Compras en la tienda de noche (las procesa Inventario el siguiente día
    // hábil y salen en el despacho automático), para cuentas que no salieron
    // al azar entre los pedidos históricos.
    for (const [name, o, items] of [
      ["Daniela Alejandra Quintanilla", back(20), [{ product: "Pajillas Rectas", color: "Azul", quantity: 800 }]],
      ["Jorge Ernesto Alvarado", back(13), [{ product: "Pajillas Flexibles", color: "Rojo", quantity: 500 }, { product: "Pelotas LDPE", color: "Verde", quantity: 100 }]],
      ["Daniela Alejandra Quintanilla", back(8), [{ product: "Pajillas Anchas", color: "Verde", quantity: 1200 }]],
    ]) {
      const createdAt = sv(o, storeInt(19, 21), storeInt(0, 59));
      at(createdAt, async () => {
        const id = await newOrder({ ...CUSTOMERS.find((c) => c.name === name) }, items);
        const processAt = sv(nextWorkday(o), 8, storeInt(10, 50));
        at(processAt, () => processLines(id, processAt));
      });
    }

    // --- Lotes de stock: planificación de cada lunes -----------------------
    const plannedStock = new Set();
    for (let o = SIM_START + 3; o <= -3; o += 1) {
      if (weekday(o) !== 1) continue;
      at(sv(o, 6, 45), async () => {
        for (const product of SUB_NAMES) {
          const info = infoOf(product);
          for (const color of colorsOf(product)) {
            if (isReserved(product, color)) continue;
            const total = (await stockRows(product, color)).reduce((s, r) => s + r.stock, 0);
            if (total >= minStockOf(product) * 2.2 || plannedStock.has(`${product}|${color}|${o}`)) continue;
            plannedStock.add(`${product}|${color}|${o}`);
            let startDay = nextWorkday(o);
            if (chance(0.5)) startDay = nextWorkday(startDay);
            const created = await call(dailyCtl.insertBatch, { body: { date: dayKey(startDay), product, color } }, "producción diaria");
            const daily = await DailyBatch.findOne({ dailyBatchNumber: created.dailyBatchNumber });
            const { batchNumber } = await call(dailyCtl.scheduleBatch, { params: { id: idOf(daily) } }, "programar");
            const lot = await Batch.findOne({ batchNumber });
            lot.targetQuantity = batchOf(product);
            await lot.save();
            const lotId = idOf(lot);
            at(sv(startDay, 7, int(5, 25)), () =>
              call(batchCtl.startBatch, { params: { id: lotId }, body: { productionLine: pick(info.lines), operator: opFor() } }, "iniciar lote de stock"),
            );
            if (chance(0.2)) {
              at(sv(startDay, int(9, 11), int(0, 59)), () =>
                call(batchCtl.stopBatch, { params: { id: lotId }, body: { reason: pick(STOP_REASONS) } }, "detener lote de stock"),
              );
              at(sv(startDay, 12, int(10, 50)), () => call(batchCtl.resumeBatch, { params: { id: lotId } }, "reanudar lote de stock"));
            }
            const endDay = nextWorkday(startDay);
            at(sv(endDay, 14, int(0, 50)), () =>
              call(batchCtl.completeBatch, { params: { id: lotId }, body: { producedQuantity: Math.round(batchOf(product) * (0.96 + rand() * 0.07)) } }, "completar lote de stock"),
            );
            at(sv(endDay, 16, int(0, 45)), () => call(batchCtl.sendToWarehouse, { params: { id: lotId }, body: { warehouse: info.warehouse } }, "enviar a bodega"));
          }
        }
      });
    }

    // --- Despacho automático (días hábiles hasta ayer) ---------------------
    const plates = [...VEHICLES];
    function dispatchDay(o) {
      at(sv(o, 6, 50), async () => {
        const ready = (await Order.find({ status: "Empacado", "delivery.route": { $exists: false } }).sort({ createdAt: 1 })).filter((x) => !manual.has(idOf(x)));
        if (!ready.length) return;
        const byZone = new Map();
        for (const ord of ready) {
          const c = CUSTOMERS.find((cc) => cc.name === ord.customer.name);
          const zone = ZONES[c?.zone || "SS"];
          if (!byZone.has(zone)) byZone.set(zone, []);
          byZone.get(zone).push(ord);
        }
        // Hasta 3 rutas (3 motoristas); las zonas cercanas se juntan.
        const groups = [...byZone.entries()].sort((a, b) => b[1].length - a[1].length);
        while (groups.length > (ready.length >= 8 ? 3 : 2)) {
          const [zone, ords] = groups.pop();
          groups[groups.length - 1][1].push(...ords);
          groups[groups.length - 1][0] += ` y ${zone.split(" – ")[0]}`;
        }
        groups.forEach(([zone, ords], r) => {
          const driver = drivers[r % drivers.length];
          const plate = plates[(((r + o) % plates.length) + plates.length) % plates.length];
          at(sv(o, 7, 0 + r), async () => {
            const route = await call(routesCtl.createRoute, { body: { zone } }, "crear ruta");
            const rid = idOf(route);
            for (const ord of ords.slice(0, 5)) await call(routesCtl.addOrder, { params: { id: rid }, body: { orderId: idOf(ord) } }, "agregar a ruta");
            await call(routesCtl.updateRoute, { params: { id: rid }, body: { driver: idOf(driver), vehicle: plate } }, "asignar ruta");
            const current = await Route.findById(rid).populate("orders");
            const needs = new Set();
            for (const ord of current.orders) for (const it of ord.items) if (it.packed) (it.fromStockQty != null ? ["Almacén", "Fabricación"] : [it.packedLocation]).forEach((l) => l && needs.add(l));
            let t = sv(o, 7, 40 + r * 5);
            for (const location of ["Almacén", "Fabricación"].filter((l) => needs.has(l))) {
              at(t, () => call(routesCtl.confirmPickup, { params: { id: rid }, body: { location } }, "recoger"));
              t += 30 * 60000;
            }
            at(sv(o, 8, 50 + r * 4), () => call(routesCtl.depart, { params: { id: rid } }, "salir"));
            current.orders.forEach((ord, i) => {
              const when = sv(o, 10 + i, int(0, 50));
              at(when, () => call(routesCtl.deliverOrder, { params: { id: rid, orderId: idOf(ord) } }, "entregar"));
            });
          });
        });
      });
    }
    for (let o = SIM_START + 3; o <= back(2); o += 1) if ([2, 5].includes(weekday(o))) dispatchDay(o);

    // --- Finanzas: gastos del período --------------------------------------
    const expense = (t, concept, category, amount, status = "Completado") =>
      at(t, () =>
        call(txCtl.insertTransaction, { body: { concept, type: "Gasto", category, amount: Number(amount.toFixed(2)), status, date: new RealDate(t) } }, "gasto"),
      );
    for (let o = SIM_START; o <= 0; o += 1) {
      const d = new RealDate(RealDate.UTC(TY, TM - 1, TD + o));
      const dom = d.getUTCDate();
      const last = new RealDate(RealDate.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      if (dom === 15 || dom === last) {
        const prod = EMPLOYEES.filter((e) => e.isActive !== false && (e.department === "Fabricación" || e.department === "Almacén"));
        const rest = EMPLOYEES.filter((e) => e.isActive !== false && !prod.includes(e));
        const q = (list) => list.reduce((s, e) => s + e.hourlyRate * 8 * 11, 0) * (1.05 + rand() * 0.06);
        expense(sv(o, 16, 30), "Pago de planilla quincenal - operarios de producción y bodega", "Planilla", q(prod));
        expense(sv(o, 16, 40), "Pago de planilla quincenal - personal administrativo y logística", "Planilla", q(rest));
      }
      if (dom === 5) expense(sv(o, 10, 15), "Pago de energía eléctrica - planta", "Servicios", 1000 + rand() * 400);
      if (dom === 8) expense(sv(o, 10, 30), "Pago de agua potable - planta", "Servicios", 95 + rand() * 40);
      if (dom === 10) expense(sv(o, 11, 0), "Servicio de internet y telefonía", "Servicios", 89.9);
      if (dom === 12) expense(sv(o, 9, 20), "Compra de masterbatch de colores - Colorantes de Centroamérica", "Materia Prima", 600 + rand() * 350);
      if (dom === 20) expense(sv(o, 9, 40), "Compra de cajas y bolsas de empaque - Cartonera Salvadoreña", "Materia Prima", 420 + rand() * 230);
      if (dom === 2 || dom === 17) expense(sv(o, 9, 0), "Compra de resina PP y HDPE - Petroquímica CA", "Materia Prima", 2200 + rand() * 1000);
      if (weekday(o) === 1) expense(sv(o, 8, 10), "Combustible flota de reparto", "Logística", 190 + rand() * 140);
      if (dom === 25) expense(sv(o, 11, 30), "Pago de cuota mensual - Cámara de Comercio", "Otros", 45);
    }
    [
      [-96, "Mantenimiento preventivo camión P-512-KLM", "Mantenimiento", 385],
      [-71, "Reparación de extrusora - Línea 2", "Mantenimiento", 1240],
      [-52, "Cambio de llantas camión C-208-RTS", "Logística", 640],
      [-33, "Mantenimiento de moldes de inyección - Línea 3", "Mantenimiento", 860],
      [-18, "Reparación de montacargas de bodega", "Mantenimiento", 470],
      [-9, "Calibración de básculas de bodega", "Otros", 150],
    ].forEach(([o, concept, category, amount]) => expense(sv(o, int(9, 15), int(0, 59)), concept, category, amount));
    // Cuentas por pagar pendientes de este mes.
    expense(sv(-1, 15, 10), "Compra de resina PP - Petroquímica CA (factura a 30 días)", "Materia Prima", 5280.4, "Pendiente");
    expense(sv(0, 9, 5), "Servicio de fumigación de bodegas", "Servicios", 210, "Pendiente");


    // --- Guion de los últimos días: cubre todos los estados ----------------
    const C = (name) => ({ ...CUSTOMERS.find((c) => c.name === name) });
    // "TOP": en una línea con categoría ("Pajillas"/"Pelotas") y color "TOP" se
    // elige la subcategoría + color con más existencia en este momento (entre
    // las no reservadas y cuyo mínimo de pedido cabe en la cantidad).
    const topPick = async (category, quantity) => {
      let best = null;
      for (const sub of subsOf(category)) {
        if (minOf(sub) > quantity) continue;
        for (const color of colorsOf(sub).filter((c) => !isReserved(sub, c))) {
          const stock = (await stockRows(sub, color)).reduce((acc, r) => acc + r.stock, 0);
          if (!best || stock > best.stock) best = { product: sub, color, stock };
        }
      }
      return best;
    };
    const created = {};
    // Cada paso del guion es un evento de la cola: se ejecuta en su hora,
    // intercalado con los eventos automáticos, sin importar el orden del código.
    const scripted = (key, when, customer, items) => at(when, () => createScripted(key, customer, items));
    async function createScripted(key, customer, items) {
      for (const it of items) {
        if (it.color !== "TOP") continue;
        const top = await topPick(it.product, it.quantity);
        if (!top) throw new Error(`Sin existencia de ${it.product} para el pedido «${key}»`);
        it.product = top.product;
        it.color = top.color;
        // Si ninguna combinación tiene tanta existencia, el pedido se ajusta a
        // lo disponible (así sigue siendo un pedido que se puede verificar).
        if (it.quantity > top.stock) {
          const fitted = Math.max(minOf(top.product), Math.floor((top.stock * 0.9) / 100) * 100);
          log.warnings.push(`Pedido «${key}»: ${it.quantity} de ${top.product} ${top.color} excede la existencia (${top.stock}); se ajustó a ${fitted}`);
          it.quantity = fitted;
        }
      }
      const id = await newOrder(customer, items);
      manual.add(id);
      created[key] = id;
      return id;
    }
    const verify = async (id, index) => {
      const o = await loadOrder(id);
      const best = await bestStock(o.items[index].product, o.items[index].color);
      await call(ordersCtl.verifyOrderItem, { params: line(id, index), body: { warehouse: best.warehouse } }, "verificar");
    };
    const packLine = (id, index) => call(ordersCtl.packOrderItem, { params: line(id, index) }, "empacar");
    const sendLot = (id, index) => call(ordersCtl.sendItemToManufacturing, { params: line(id, index) }, "enviar a fabricación");
    const lotOf = async (id, index) => String((await loadOrder(id)).items[index].manufacturingBatch);
    const startLot = async (id, index) => {
      const o = await loadOrder(id);
      await call(batchCtl.startBatch, { params: { id: await lotOf(id, index) }, body: { productionLine: lineFor(o.items[index].product), operator: opFor() } }, "iniciar");
    };
    const completeLot = async (id, index) => {
      const lotId = await lotOf(id, index);
      const b = await Batch.findById(lotId);
      await call(batchCtl.completeBatch, { params: { id: lotId }, body: { producedQuantity: b.targetQuantity } }, "completar");
    };
    const packLot = (id, index) => call(ordersCtl.packManufacturedItem, { params: line(id, index) }, "empacar lote");
    const stepAt = (t, fn) => at(t, fn);

    // Entrega parcial (hace 6 días): una línea iba en ruta y la otra seguía en fabricación.
    await scripted("parcial", sv(back(6), 9, 30), C("Distribuidora El Rosario"), [
      { product: "Pajillas", color: "TOP", quantity: 8000 },
      { product: "Pelotas Inflables", color: "Amarillo", quantity: 1500 },
    ]);
    await stepAt(sv(back(6), 11, 0), async () => {
      await verify(created.parcial, 0);
      await sendLot(created.parcial, 1);
      await packLine(created.parcial, 0);
    });
    await stepAt(sv(back(5), 7, 10), () => startLot(created.parcial, 1));
    let parcialRoute;
    await stepAt(sv(back(5), 7, 20), async () => {
      parcialRoute = idOf(await call(routesCtl.createRoute, { body: { zone: ZONES.SO } }, "ruta parcial"));
      await call(routesCtl.addOrder, { params: { id: parcialRoute }, body: { orderId: created.parcial } }, "agregar");
      // Motorista y vehículo libres ese día (GET /routes/availability).
      const free = await call(routesCtl.getAvailability, { query: {} }, "disponibilidad");
      const driver = free.drivers.find((d) => !d.busy);
      const vehicle = free.vehicles.find((v) => !v.busy);
      await call(routesCtl.updateRoute, { params: { id: parcialRoute }, body: { driver: String(driver._id), vehicle: vehicle.plate } }, "asignar");
    });
    await stepAt(sv(back(5), 8, 0), () => call(routesCtl.confirmPickup, { params: { id: parcialRoute }, body: { location: "Almacén" } }, "recoger"));
    await stepAt(sv(back(5), 8, 40), () => call(routesCtl.depart, { params: { id: parcialRoute } }, "salir"));
    await stepAt(sv(back(5), 10, 20), () => call(routesCtl.deliverOrder, { params: { id: parcialRoute, orderId: created.parcial } }, "entrega parcial"));
    await stepAt(sv(back(2), 14, 30), () => completeLot(created.parcial, 1));
    await stepAt(sv(back(2), 16, 5), () => packLot(created.parcial, 1));


    // Lote de pedido «Por empacar» (completado ayer, sin empacar).
    await scripted("porEmpacar", sv(back(4), 10, 5), C("Juguetería Arcoíris"), [{ product: "Pelotas LDPE", color: "Amarillo", quantity: 2200 }]);
    await stepAt(sv(back(4), 12, 0), () => sendLot(created.porEmpacar, 0));
    await stepAt(sv(back(3), 7, 15), () => startLot(created.porEmpacar, 0));
    await stepAt(sv(back(1), 14, 40), () => completeLot(created.porEmpacar, 0));

    // Lote de pedido en proceso y lote de pedido detenido.
    await scripted("enProceso", sv(back(3), 9, 40), C("Colegio San Andrés"), [{ product: "Pelotas de Celuloide", color: "Amarillo", quantity: 3000 }]);
    await stepAt(sv(back(3), 11, 30), () => sendLot(created.enProceso, 0));
    await stepAt(sv(back(1), 7, 20), () => startLot(created.enProceso, 0));
    await scripted("detenido", sv(back(3), 15, 10), C("Parque Acuático Las Palmeras"), [
      { product: "Pelotas Inflables", color: "Amarillo", quantity: 2500 },
      { product: "Pajillas", color: "TOP", quantity: 12000 },
    ]);
    await stepAt(sv(back(2), 8, 30), async () => {
      await sendLot(created.detenido, 0);
      await verify(created.detenido, 1);
    });
    await stepAt(sv(back(2), 10, 0), () => packLine(created.detenido, 1));
    await stepAt(sv(0, 7, 10), () => startLot(created.detenido, 0));
    await stepAt(sv(0, 9, 35), async () =>
      call(batchCtl.stopBatch, { params: { id: await lotOf(created.detenido, 0) }, body: { reason: "Falla en el cabezal de la extrusora" } }, "detener"),
    );

    // Existencia parcial dividida: parte de bodega empacada, resto en fabricación.
    await scripted("dividido", sv(back(2), 9, 15), C("Distribuidora de Desechables Oriente"), [{ product: "Pajillas Flexibles", color: "Negro", quantity: 6000 }]);
    await stepAt(sv(back(2), 11, 45), () => call(ordersCtl.splitPartialItem, { params: line(created.dividido, 0), body: { warehouse: CATEGORY_INFO.Pajillas.warehouse, quantity: RESERVED["Pajillas Flexibles|Negro"] } }, "dividir"));
    await stepAt(sv(back(2), 13, 0), () => packLine(created.dividido, 0));
    await stepAt(sv(back(1), 7, 30), () => startLot(created.dividido, 0));

    // Esperando lote (programado, sin iniciar).
    await scripted("esperando", sv(back(1), 10, 20), C("Piñatería y Fiestas Carolina"), [{ product: "Pelotas de Celuloide", color: "Amarillo", quantity: 400 }]);
    await stepAt(sv(back(1), 13, 0), () => sendLot(created.esperando, 0));

    // Pedidos empacados listos para despacho (hoy van en rutas o esperan ruta).
    const packedOrders = [
      ["r1a", back(2), "Cafetería Los Almendros", [{ product: "Pajillas", color: "TOP", quantity: 6000 }]],
      ["r1b", back(2), "Luis Fernando Chávez", [{ product: "Pelotas", color: "TOP", quantity: 250 }]],
      ["r2a", back(2), "Heladería Nevada Tropical", [{ product: "Pajillas", color: "TOP", quantity: 9000 }]],
      ["r2b", back(2), "Colegio San Andrés", [{ product: "Pelotas", color: "TOP", quantity: 1200 }]],
      ["r2c", back(1), "Sorbetería Los Pinos", [{ product: "Pajillas", color: "TOP", quantity: 7000 }]],
      ["r3a", back(2), "Juguetería Arcoíris", [{ product: "Pelotas", color: "TOP", quantity: 1800 }]],
      ["r3b", back(1), "Carlos Alberto Meléndez", [{ product: "Pelotas", color: "TOP", quantity: 300 }]],
      ["r4b", back(1), "Minisúper El Buen Precio", [{ product: "Pajillas", color: "TOP", quantity: 2500 }]],
      ["r5a", back(1), "Refresquería La Ceiba", [{ product: "Pajillas", color: "TOP", quantity: 3000 }]],
      ["libre1", back(1), "Restaurante Brisas del Lago", [{ product: "Pajillas", color: "TOP", quantity: 10000 }]],
      ["libre2", 0, "Deportes La Cancha", [{ product: "Pelotas", color: "TOP", quantity: 350 }]],
    ];
    for (const [key, o, name, items] of packedOrders) {
      stepAt(sv(o, o === 0 ? 7 : 9, int(0, 50)), async () => {
        await createScripted(key, C(name), items);
        await verify(created[key], 0);
      });
      await stepAt(sv(o, o === 0 ? 8 : 13, int(0, 50)), () => packLine(created[key], 0));
    }
    // Pedido con línea de Fabricación empacada ayer (Ruta 4 recoge ahí).
    await scripted("r4a", sv(back(3), 8, 20), C("Comercial Hermanos Villalta"), [
      { product: "Pelotas LDPE", color: "Amarillo", quantity: 800 },
      { product: "Pajillas", color: "TOP", quantity: 5000 },
    ]);
    await stepAt(sv(back(3), 10, 0), async () => {
      await sendLot(created.r4a, 0);
      await verify(created.r4a, 1);
      await packLine(created.r4a, 1);
    });
    await stepAt(sv(back(2), 7, 20), () => startLot(created.r4a, 0));
    await stepAt(sv(back(1), 13, 30), () => completeLot(created.r4a, 0));
    await stepAt(sv(back(1), 15, 0), () => packLot(created.r4a, 0));

    // Rutas de hoy en todos sus estados.
    const mkRoute = async (zone, orderKeys, crew) => {
      const rid = idOf(await call(routesCtl.createRoute, { body: { zone } }, "crear ruta"));
      for (const k of orderKeys) await call(routesCtl.addOrder, { params: { id: rid }, body: { orderId: created[k] } }, "agregar");
      if (crew) await call(routesCtl.updateRoute, { params: { id: rid }, body: { driver: idOf(crew[0]), vehicle: crew[1] } }, "asignar");
      return rid;
    };
    let r1, r2, r3, r4;
    await stepAt(sv(0, 6, 40), async () => {
      r1 = await mkRoute(ZONES.SS, ["r1a", "r1b"], [drivers[0], "P-512-KLM"]);
    });
    await stepAt(sv(0, 6, 55), () => call(routesCtl.confirmPickup, { params: { id: r1 }, body: { location: "Almacén" } }, "recoger"));
    await stepAt(sv(0, 7, 10), () => call(routesCtl.depart, { params: { id: r1 } }, "salir"));
    await stepAt(sv(0, 8, 5), () => call(routesCtl.deliverOrder, { params: { id: r1, orderId: created.r1a } }, "entregar"));
    await stepAt(sv(0, 8, 50), () => call(routesCtl.deliverOrder, { params: { id: r1, orderId: created.r1b } }, "entregar"));
    await stepAt(sv(0, 9, 10), async () => {
      r2 = await mkRoute(ZONES.ST, ["r2a", "r2b", "r2c"], [drivers[0], "P-512-KLM"]);
    });
    // La Ruta de Oriente se creó y salió AYER y sigue En tránsito: una ruta
    // activa de un día anterior (debe seguir apareciendo en Logística).
    await stepAt(sv(back(1), 15, 30), async () => {
      r3 = await mkRoute(ZONES.OR, ["r3a", "r3b"], [drivers[1], "C-208-RTS"]);
    });
    await stepAt(sv(back(1), 15, 50), () => call(routesCtl.confirmPickup, { params: { id: r3 }, body: { location: "Almacén" } }, "recoger"));
    await stepAt(sv(back(1), 16, 15), () => call(routesCtl.depart, { params: { id: r3 } }, "salir"));
    await stepAt(sv(0, 9, 35), () => call(routesCtl.confirmPickup, { params: { id: r2 }, body: { location: "Almacén" } }, "recoger"));
    await stepAt(sv(0, 9, 55), () => call(routesCtl.depart, { params: { id: r2 } }, "salir"));
    await stepAt(sv(0, 11, 5), () => call(routesCtl.deliverOrder, { params: { id: r2, orderId: created.r2a } }, "entregar"));
    await stepAt(sv(0, 12, 30), () => call(routesCtl.updateRoute, { params: { id: r3 }, body: { delayed: true } }, "demorada"));
    await stepAt(sv(0, 12, 40), async () => {
      r4 = await mkRoute(ZONES.AM, ["r4a", "r4b"], [drivers[2], "P-731-BNX"]);
      await call(routesCtl.confirmPickup, { params: { id: r4 }, body: { location: "Almacén" } }, "recoger");
    });
    // Ruta Pendiente (sin motorista ni vehículo) creada AYER: otra ruta activa de un día anterior.
    await stepAt(sv(back(1), 16, 20), () => mkRoute(ZONES.OC, ["r5a"], null));

    // Pedidos de hoy en Inventario (sin verificar / verificando / listo para empacar).
    await scripted("pendiente1", sv(0, 8, 15), C("Licuados y Batidos Tropicana"), [
      { product: "Pajillas", color: "TOP", quantity: 8000 },
      { product: "Pelotas LDPE", color: "Negro", quantity: 1500 },
      { product: "Pelotas Inflables", color: "Amarillo", quantity: 600 },
    ]);
    await scripted("pendiente2", sv(0, 10, 40), C("María José Hernández"), [{ product: "Pelotas", color: "TOP", quantity: 150 }]);
    await scripted("pendiente3", sv(0, 11, 55), C("Cafetín Universitario La Esquina"), [{ product: "Pajillas", color: "TOP", quantity: 2000 }]);
    await scripted("verificando", sv(back(1), 14, 10), C("Pupusería y Comedor Doña Mari"), [
      { product: "Pajillas", color: "TOP", quantity: 3000 },
      { product: "Pelotas", color: "TOP", quantity: 200 },
    ]);
    await stepAt(sv(0, 8, 40), () => verify(created.verificando, 0));
    await scripted("listo", sv(back(1), 15, 30), C("Ana Beatriz Rivas"), [{ product: "Pajillas", color: "TOP", quantity: 1500 }]);
    await stepAt(sv(0, 9, 0), () => verify(created.listo, 0));

    // Lotes de stock de esta semana: por enviar, en proceso, detenido y programados.
    const stockLot = async (product, color, startOffset) => {
      const daily = await call(dailyCtl.insertBatch, { body: { date: dayKey(startOffset), product, color } }, "producción diaria");
      const d = await DailyBatch.findOne({ dailyBatchNumber: daily.dailyBatchNumber });
      const { batchNumber } = await call(dailyCtl.scheduleBatch, { params: { id: idOf(d) } }, "programar");
      const lot = await Batch.findOne({ batchNumber });
      lot.targetQuantity = batchOf(product);
      await lot.save();
      return idOf(lot);
    };
    const colorsFor = (sub) => colorsOf(sub).filter((c) => !isReserved(sub, c));
    let lotPorEnviar, lotEnProceso, lotDetenido;
    await stepAt(sv(back(3), 6, 50), async () => {
      lotPorEnviar = await stockLot("Pajillas Rectas", colorsFor("Pajillas Rectas")[1], back(1));
      lotDetenido = await stockLot("Pelotas LDPE", colorsFor("Pelotas LDPE")[2], back(1));
      lotEnProceso = await stockLot("Pajillas Flexibles", colorsFor("Pajillas Flexibles")[3], 0);
    });
    await stepAt(sv(back(1), 7, 5), async () => {
      await call(batchCtl.startBatch, { params: { id: lotPorEnviar }, body: { productionLine: "Línea 1", operator: opFor() } }, "iniciar");
      await call(batchCtl.startBatch, { params: { id: lotDetenido }, body: { productionLine: "Línea 4", operator: opFor() } }, "iniciar");
    });
    await stepAt(sv(0, 7, 0), () => call(batchCtl.startBatch, { params: { id: lotEnProceso }, body: { productionLine: "Línea 2", operator: opFor() } }, "iniciar"));
    await stepAt(sv(0, 8, 45), () => call(batchCtl.stopBatch, { params: { id: lotDetenido }, body: { reason: "Falta de resina PP en tolva" } }, "detener"));
    await stepAt(sv(0, 11, 20), async () => {
      const b = await Batch.findById(lotPorEnviar);
      await call(batchCtl.completeBatch, { params: { id: lotPorEnviar }, body: { producedQuantity: Math.round(b.targetQuantity * 1.02) } }, "completar");
    });
    // Programados para los próximos días y producción diaria sin programar.
    await stepAt(sv(0, 13, 30), async () => {
      await stockLot("Pelotas Inflables", colorsFor("Pelotas Inflables")[0], nextWorkday(0));
      await stockLot("Pajillas Anchas", colorsFor("Pajillas Anchas")[0], nextWorkday(0));
      const d2 = nextWorkday(nextWorkday(0));
      await call(dailyCtl.insertBatch, { body: { date: dayKey(d2), product: "Pelotas de Celuloide", color: colorsFor("Pelotas de Celuloide")[1] } }, "producción diaria");
      await call(dailyCtl.insertBatch, { body: { date: dayKey(d2), product: "Pajillas Mezcladoras", color: colorsFor("Pajillas Mezcladoras")[2] } }, "producción diaria");
      await call(dailyCtl.insertBatch, { body: { date: dayKey(nextWorkday(d2)), product: "Pelotas LDPE", color: "Amarillo" } }, "producción diaria");
    });

    await runUntil(Infinity);

    // --- Exportar documentos ----------------------------------------------
    const db = mongoose.connection.db;
    const docs = {};
    for (const name of [...PANEL]) docs[name] = await db.collection(name).find().toArray();
    Object.assign(docs, await storeDocs(docs.orders, storeOrders));
    return { docs, warnings: log.warnings };
  } finally {
    globalThis.Date = RealDate;
    fakeNow = null;
    await mongoose.disconnect().catch(() => {});
    await replSet.stop().catch(() => {});
  }
}

// Catálogo de la tienda (solo con --regenerar-productos): un producto por
// subcategoría, con su mismo nombre, el precio y mínimo de SUBCATEGORIES, todos
// los colores y sin imágenes.
function catalogDocs() {
  const now = new RealDate(NOW);
  const slugify = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
  return SUBCATEGORIES.map((sc, i) => ({
    name: sc.name,
    slug: slugify(sc.name),
    category: sc.category,
    subcategory: sc.name,
    price: sc.price,
    colors: [...COLORS],
    minOrderQuantity: sc.min,
    stock: batchOf(sc.name),
    images: [],
    active: true,
    featured: i === 0,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  }));
}

// Empareja cada producto del catálogo con una de las SUBCATEGORIES por nombre
// (ignorando mayúsculas, tildes y espacios de más) y con la misma categoría.
// Devuelve { pairs: [{ product, sub }], errors }: un producto sin pareja, dos
// productos con la misma subcategoría o una subcategoría sin producto son
// errores y el script se detiene sin tocar nada.
const normName = (text) => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function pairProducts(products) {
  const pairs = [];
  const errors = [];
  const bySub = new Map();
  for (const product of products) {
    const matches = SUBCATEGORIES.filter((sc) => normName(sc.name) === normName(product.name) && sc.category === product.category);
    if (matches.length !== 1) {
      errors.push(`El producto «${product.name}» (${product.category}, ${product._id ?? "sin _id"}) no empareja con ninguna subcategoría`);
      continue;
    }
    const sub = matches[0].name;
    if (bySub.has(sub)) {
      errors.push(`«${sub}» empareja con más de un producto: «${bySub.get(sub).name}» (${bySub.get(sub)._id}) y «${product.name}» (${product._id})`);
      continue;
    }
    if (!Array.isArray(product.colors) || !product.colors.length) errors.push(`El producto «${product.name}» no tiene colores: no habría inventario que generar`);
    bySub.set(sub, product);
    pairs.push({ product, sub });
  }
  for (const sc of SUBCATEGORIES) if (!bySub.has(sc.name)) errors.push(`La subcategoría «${sc.name}» se queda sin producto`);
  return { pairs, errors };
}

// Tienda en línea (se insertan solo con --incluir-tienda): una cuenta por
// persona de STORE_ACCOUNTS y, por cada compra, su vínculo CustomerOrder y su
// PaymentTransaction aprobado, con los mismos campos y en el mismo orden en
// que los guarda el checkout de public/backend (pedido → vínculo → pago, con
// unos milisegundos de diferencia).
async function storeDocs(orders, storeOrders) {
  const { ObjectId } = mongoose.Types;
  const byId = new Map(orders.map((o) => [String(o._id), o]));
  const at = (t) => new RealDate(t);
  const customers = [];
  const customerorders = [];
  const paymenttransactions = [];
  for (const account of STORE_ACCOUNTS) {
    const mine = storeOrders.filter((s) => s.account === account).map((s) => byId.get(s.id)).sort((a, b) => a.createdAt - b.createdAt);
    const address = account.address ?? CUSTOMERS.find((c) => c.name === account.full).address;
    // Alta de la cuenta: el mismo día de su primera compra o unos días antes
    // (a una hora parecida), nunca antes del inicio del período. Sin compras:
    // se registró en las últimas semanas.
    const created = mine.length
      ? Math.max(+mine[0].createdAt - (storeInt(0, 5) * 24 * 60 + storeInt(20, 150)) * 60000, sv(SIM_START + 1, 9, 0))
      : sv(-storeInt(3, 20), storeInt(9, 20), storeInt(0, 59));
    const customerId = new ObjectId();
    customers.push({
      _id: customerId,
      name: account.name,
      lastName: account.lastName,
      email: account.email,
      // Contraseña aleatoria que nadie conoce (igual que los empleados).
      password: await bcryptjs.hash(crypto.randomBytes(24).toString("hex"), 10),
      phone: account.phone,
      isActive: true,
      addresses: [
        { _id: new ObjectId(), label: "Casa", address, city: account.city, phone: account.phone, isDefault: true },
        ...(account.extra ? [{ _id: new ObjectId(), ...account.extra, phone: account.phone, isDefault: false }] : []),
      ],
      createdAt: at(created),
      updatedAt: at(created + storeInt(2, 9) * 60000), // guardó su dirección al registrarse
      __v: 0,
    });
    for (const order of mine) {
      const t = +order.createdAt;
      const linkAt = at(t + storeInt(50, 90));
      customerorders.push({ _id: new ObjectId(), customer: customerId, order: order._id, createdAt: linkAt, updatedAt: linkAt, __v: 0 });
      const payAt = at(t + storeInt(120, 180));
      paymenttransactions.push({
        _id: new ObjectId(),
        order: order._id,
        provider: "wompi",
        idTransaccion: crypto.randomUUID(),
        monto: order.total,
        esAprobada: true,
        codigoAutorizacion: crypto.randomUUID(),
        mensaje: WOMPI_TEST_MESSAGE,
        cardLast4: account.card,
        status: "aprobado",
        createdAt: payAt,
        updatedAt: payAt,
        __v: 0,
      });
    }
  }
  return { customers, customerorders, paymenttransactions };
}

/* -------------------------------------------------------------------------- */
/* Verificaciones de los datos generados                                       */
/* -------------------------------------------------------------------------- */

async function checkGenerated(docs, adminId) {
  const problems = [];
  const ids = (name) => new Set(docs[name].map((d) => String(d._id)));
  const orders = ids("orders");
  const routes = ids("routes");
  const batches = ids("productionbatches");
  const employees = new Set([...ids("employees"), String(adminId)]);
  const plates = new Set(docs.vehicles.map((v) => v.plate));
  const warehouses = new Set(docs.warehouses.map((w) => w.name));
  const miss = (what, id) => problems.push(`${what} → ${id} no existe`);

  for (const o of docs.orders) {
    if (o.delivery?.route && !routes.has(String(o.delivery.route))) miss(`pedido ${o.orderNumber} delivery.route`, o.delivery.route);
    if (o.delivery?.driver && !employees.has(String(o.delivery.driver))) miss(`pedido ${o.orderNumber} delivery.driver`, o.delivery.driver);
    if (o.delivery?.vehicle && !plates.has(o.delivery.vehicle)) miss(`pedido ${o.orderNumber} delivery.vehicle`, o.delivery.vehicle);
    for (const it of o.items) {
      if (it.manufacturingBatch && !batches.has(String(it.manufacturingBatch))) miss(`pedido ${o.orderNumber} lote`, it.manufacturingBatch);
      if (it.verifiedWarehouse && !warehouses.has(it.verifiedWarehouse)) miss(`pedido ${o.orderNumber} bodega`, it.verifiedWarehouse);
    }
  }
  for (const r of docs.routes) {
    for (const id of r.orders) if (!orders.has(String(id))) miss(`ruta ${r.code} orders`, id);
    for (const d of r.deliveries) if (!orders.has(String(d.order))) miss(`ruta ${r.code} deliveries.order`, d.order);
    if (r.driver && !employees.has(String(r.driver))) miss(`ruta ${r.code} driver`, r.driver);
    if (r.vehicle && !plates.has(r.vehicle)) miss(`ruta ${r.code} vehicle`, r.vehicle);
  }
  for (const b of docs.productionbatches) {
    if (b.operator && !employees.has(String(b.operator))) miss(`lote ${b.batchNumber} operator`, b.operator);
    if (b.destinationWarehouse && !warehouses.has(b.destinationWarehouse)) miss(`lote ${b.batchNumber} bodega`, b.destinationWarehouse);
  }
  for (const t of docs.transactions) if (t.relatedOrder && !orders.has(String(t.relatedOrder))) miss(`transacción ${t.reference}`, t.relatedOrder);
  for (const i of docs.inventoryitems) if (i.location && !warehouses.has(i.location)) miss(`artículo ${i.name}`, i.location);

  // Tienda: vínculo → cuenta y pedido; pago → pedido; y en sentido inverso,
  // cada pedido con correo de una cuenta tiene exactamente un vínculo y un pago.
  const customers = new Map(docs.customers.map((c) => [String(c._id), c]));
  const orderById = new Map(docs.orders.map((o) => [String(o._id), o]));
  const linkByOrder = new Map();
  for (const l of docs.customerorders) {
    const key = String(l.order);
    if (!customers.has(String(l.customer))) miss(`customerorder ${l._id} customer`, l.customer);
    if (!orderById.has(key)) miss(`customerorder ${l._id} order`, l.order);
    if (linkByOrder.has(key)) problems.push(`pedido ${orderById.get(key)?.orderNumber} enlazado dos veces a la tienda`);
    linkByOrder.set(key, l);
    const o = orderById.get(key);
    const c = customers.get(String(l.customer));
    if (o && c && (o.customer.email !== c.email || o.customer.name !== `${c.name} ${c.lastName}`.trim())) problems.push(`pedido ${o.orderNumber}: cliente ≠ cuenta ${c.email}`);
    if (o && o.paymentStatus !== undefined) problems.push(`pedido ${o.orderNumber} trae paymentStatus (ya no existe)`);
  }
  const payByOrder = new Map();
  for (const p of docs.paymenttransactions) {
    const key = String(p.order);
    const o = orderById.get(key);
    if (!o) miss(`paymenttransaction ${p._id} order`, p.order);
    else if (p.monto !== o.total) problems.push(`pago de ${o.orderNumber}: monto ${p.monto} ≠ total ${o.total}`);
    if (!linkByOrder.has(key)) problems.push(`pago ${p._id} sin compra de tienda enlazada`);
    payByOrder.set(key, (payByOrder.get(key) || 0) + 1);
  }
  const emails = new Set(docs.customers.map((c) => c.email));
  for (const o of docs.orders) {
    const key = String(o._id);
    const isStore = o.customer.email && emails.has(o.customer.email);
    if (isStore && !linkByOrder.has(key)) problems.push(`pedido ${o.orderNumber} de una cuenta de tienda sin vínculo`);
    if (linkByOrder.has(key) && payByOrder.get(key) !== 1) problems.push(`pedido de tienda ${o.orderNumber} con ${payByOrder.get(key) || 0} pagos`);
  }
  if (new Set(docs.customers.map((c) => c.email)).size !== docs.customers.length) problems.push("correos de clientes repetidos");

  // Todo pedido sale de la tienda y tiene su Ingreso «Ventas» (uno solo, con el
  // N° de pedido); no hay Gastos por reembolso.
  const salesByOrder = new Map();
  for (const t of docs.transactions) {
    if (t.relatedOrder && t.category === "Ventas") salesByOrder.set(String(t.relatedOrder), [...(salesByOrder.get(String(t.relatedOrder)) || []), t]);
    if (/reembolso/i.test(t.concept)) problems.push(`transacción ${t.reference} es un reembolso (ya no existen)`);
  }
  for (const o of docs.orders) {
    const sales = salesByOrder.get(String(o._id)) || [];
    if (!o.customer.email || !emails.has(o.customer.email)) problems.push(`pedido ${o.orderNumber} no es de una cuenta de la tienda`);
    if (sales.length !== 1 || sales[0].type !== "Ingreso" || sales[0].amount !== o.total || sales[0].orderNumber !== o.orderNumber) {
      problems.push(`pedido ${o.orderNumber}: debe tener exactamente un Ingreso «Ventas» por su total y con su N° de pedido`);
    }
  }

  // El «producto» de todo dato generado es el nombre de una subcategoría.
  const validNames = new Set(SUB_NAMES);
  const notSub = (where, names) => {
    for (const name of new Set(names)) if (!validNames.has(name)) problems.push(`${where}: «${name}» no es una subcategoría`);
  };
  notSub("orders.items.product", docs.orders.flatMap((o) => o.items.map((i) => i.product)));
  notSub("productionbatches.product", docs.productionbatches.map((b) => b.product));
  notSub("dailybatches.product", docs.dailybatches.map((d) => d.product));
  notSub("inventoryitems.name (Producto Terminado)", docs.inventoryitems.filter((i) => i.category === "Producto Terminado").map((i) => i.name));
  if (JSON.stringify(docs.subcategories.map((sc) => sc.name).sort()) !== JSON.stringify([...SUB_NAMES].sort())) problems.push("subcategories no coincide con SUBCATEGORIES");

  // Consistencia con la lógica del sistema.
  const { computeOrderStatus } = await import(pathToFileURL(path.join(BACKEND_DIR, "src/lib/orderStatus.js")).href);
  const { computeRouteStatus } = await import(pathToFileURL(path.join(BACKEND_DIR, "src/lib/routes.js")).href);
  for (const o of docs.orders) {
    // El checkout de la tienda crea el pedido directo en «Procesando».
    const storeFresh = linkByOrder.has(String(o._id)) && o.status === "Procesando" && computeOrderStatus(o) === "Pendiente";
    if (!o.delivery?.driver && !storeFresh && !["En Tránsito", "Entregado"].includes(o.status) && computeOrderStatus(o) !== o.status) {
      problems.push(`pedido ${o.orderNumber}: status ${o.status} ≠ calculado ${computeOrderStatus(o)}`);
    }
    const times = o.statusHistory.map((h) => +new Date(h.at));
    if (times.some((t, i) => i && t < times[i - 1])) problems.push(`pedido ${o.orderNumber}: statusHistory fuera de orden`);
  }
  const byId = new Map(docs.orders.map((o) => [String(o._id), o]));
  for (const r of docs.routes) {
    const rs = computeRouteStatus(r, r.orders.map((id) => byId.get(String(id))).filter(Boolean));
    if (rs !== r.status) problems.push(`ruta ${r.code} (${r.date.toISOString().slice(0, 10)}): status ${r.status} ≠ calculado ${rs}`);
  }
  // Código de ruta R-AAAA-NNNN único, y disponibilidad sin fecha: ningún
  // motorista ni placa en dos rutas activas (sin completar) a la vez.
  const codes = docs.routes.map((r) => r.code);
  for (const r of docs.routes) if (!/^R-\d{4}-\d{4,}$/.test(r.code || "")) problems.push(`ruta ${r._id}: código inválido «${r.code}»`);
  if (new Set(codes).size !== codes.length) problems.push("códigos de ruta repetidos");
  const crew = { motorista: new Map(), vehículo: new Map() };
  for (const r of docs.routes.filter((x) => x.status !== "Completada")) {
    for (const [kind, value] of [["motorista", r.driver && String(r.driver)], ["vehículo", r.vehicle]]) {
      if (!value) continue;
      if (crew[kind].has(value)) problems.push(`${kind} ${value} en dos rutas activas (${crew[kind].get(value)} y ${r.code})`);
      crew[kind].set(value, r.code);
    }
  }
  for (const i of docs.inventoryitems) if (i.stock < 0) problems.push(`stock negativo: ${i.name} ${i.color ?? ""}`);
  return problems;
}

// Resumen de las rutas generadas: códigos, fechas y estados (para probar el
// rango de fechas de Logística).
function routeSummary(routes) {
  const iso = (d) => new RealDate(d).toISOString().slice(0, 10);
  const svDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit" }).format(new RealDate(d));
  const monday = (key) => iso(+new RealDate(`${key}T00:00:00Z`) - ((new RealDate(`${key}T00:00:00Z`).getUTCDay() + 6) % 7) * 86400000);
  const today = dayKey(0);
  const thisMonday = monday(today);
  const byCode = [...routes].sort((a, b) => String(a.code).localeCompare(String(b.code), "es", { numeric: true }));
  const lines = [`${routes.length} rutas · códigos ${byCode[0].code} … ${byCode.at(-1).code}`];
  const dates = routes.map((r) => +new RealDate(r.date));
  lines.push(`días de las rutas (date): ${iso(Math.min(...dates))} → ${iso(Math.max(...dates))}`);
  const status = routes.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  lines.push(`por estado: ${Object.entries(status).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  const weeks = new Map();
  for (const r of routes.filter((x) => x.status === "Completada")) {
    const week = monday(svDay(r.completedAt || r.date));
    weeks.set(week, (weeks.get(week) || 0) + 1);
  }
  const thisWeek = weeks.get(thisMonday) || 0;
  const earlier = [...weeks.entries()].filter(([w]) => w < thisMonday).reduce((s, [, n]) => s + n, 0);
  lines.push(`completadas esta semana (desde el lunes ${thisMonday}): ${thisWeek} · de semanas anteriores: ${earlier} en ${weeks.size - (thisWeek ? 1 : 0)} semanas`);
  lines.push(`completadas por semana (lunes MM-DD:n): ${[...weeks.entries()].sort().map(([w, n]) => `${w.slice(5)}:${n}`).join(" ")}`);
  for (const r of byCode.filter((x) => x.status !== "Completada")) {
    lines.push(`activa ${r.code} · ${r.status} · creada ${iso(r.date)}${iso(r.date) < today ? " (de un día anterior)" : ""} · ${r.zone}${r.driver ? "" : " · sin motorista"}`);
  }
  return lines;
}

// Estados que se verán en el panel (dominios de StatusPill).
async function coverage(docs) {
  // Mismo criterio que batchState() del panel (frontend/src/lib/batchFlow.js).
  const batchState = (b) => {
    if (b.status === "Completado" && b.category !== "Pedido") return b.sentToWarehouseAt ? "En bodega" : "Por enviar";
    if (b.status === "En Proceso") return "En proceso";
    return b.status;
  };
  const count = (arr) => arr.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {});
  const out = {
    "pedido (status)": count(docs.orders.map((o) => o.status)),
    "lote": count(docs.productionbatches.map((b) => (b.packedAt ? "Empacado" : batchState(b)))),
    "lote · categoría": count(docs.productionbatches.map((b) => b.category)),
    "ruta": count(docs.routes.map((r) => (r.delayed && r.status !== "Completada" ? "Demorada" : r.status))),
    "transacción": count(docs.transactions.map((t) => `${t.type}/${t.status}`)),
    "empleado": count(docs.employees.map((e) => (e.isActive ? "Activo" : "Inactivo"))),
  };
  return out;
}

/* -------------------------------------------------------------------------- */
/* Reporte                                                                     */
/* -------------------------------------------------------------------------- */

const d10 = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—");
const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function preview(name, docs, all) {
  const sample = (arr, n = 8) => {
    if (arr.length <= n) return arr;
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(arr[Math.floor((i * (arr.length - 1)) / (n - 1))]);
    return out;
  };
  switch (name) {
    case "employees":
      return docs.map((e) => `${e.name} ${e.lastName} · ${e.department} · ${e.position} · $${e.hourlyRate}/h · ${e.isActive ? "activo" : "inactivo"} · ${e.attendance.length} marcaciones`);
    case "warehouses":
      return docs.map((w) => w.name);
    case "subcategories":
      return docs.map((sc) => `${sc.name} · ${sc.category} · ${sc.active ? "activa" : "inactiva"}`);
    case "vehicles":
      return docs.map((v) => v.plate);
    case "workschedules":
      return docs.map((w) => `entrada ${w.startTime} · ${w.workdayHours} h`);
    case "inventoryitems":
      return sample(docs, 10).map((i) => `${i.category} · ${i.name}${i.color ? " " + i.color : ""} · ${i.stock.toLocaleString("en-US")} ${i.unit} (mín ${i.minStock}) · ${i.location}${i.lastInbound?.quantity ? ` · último ingreso +${i.lastInbound.quantity} (${i.lastInbound.batchNumber})` : ""}`);
    case "orders":
      return sample([...docs].sort((a, b) => a.createdAt - b.createdAt), 10).map(
        (o) => `${o.orderNumber} · ${d10(o.createdAt)} · ${o.customer.name} · ${o.items.map((i) => `${i.product} ${i.color} ×${i.quantity.toLocaleString("en-US")}`).join(", ")} · ${money(o.total)} · ${o.status}`,
      );
    case "productionbatches":
      return sample([...docs].sort((a, b) => a.createdAt - b.createdAt), 10).map(
        (b) => `${b.batchNumber} · ${b.category} · ${b.product} ${b.color} · meta ${b.targetQuantity?.toLocaleString("en-US")} · producido ${b.producedQuantity.toLocaleString("en-US")} · ${b.status}${b.stopReason ? ` («${b.stopReason}»)` : ""}${b.sentToWarehouseAt ? ` · enviado ${b.sentQuantity} a ${b.destinationWarehouse}` : ""}${b.packedAt ? " · empacado" : ""}`,
      );
    case "dailybatches":
      return docs.map((d) => `${d.dailyBatchNumber} · ${new Date(d.date).toISOString().slice(0, 10)} · ${d.product} ${d.color}`);
    case "routes":
      return sample([...docs].sort((a, b) => a.createdAt - b.createdAt), 10).map(
        (r) => `${r.code} · ${new Date(r.date).toISOString().slice(0, 10)} · ${r.zone} · ${r.vehicle ?? "sin vehículo"} · ${r.orders.length} pedidos · ${r.deliveries.length} entregas · ${r.status}${r.delayed ? " (demorada)" : ""}`,
      );
    case "transactions":
      return sample([...docs].sort((a, b) => a.date - b.date), 10).map((t) => `${t.reference} · ${d10(t.date)} · ${t.type} · ${t.category} · ${t.concept} · ${money(t.amount)} · ${t.status}`);
    case "products":
      return docs.map((p) => `${p.name} · ${p.category} · subcategoría ${p.subcategory} · $${p.price} · mín ${p.minOrderQuantity} · colores ${p.colors.join("/")}`);
    case "customers":
      return docs.map((c) => {
        const n = all.customerorders.filter((l) => String(l.customer) === String(c._id)).length;
        return `${c.name} ${c.lastName} · ${c.email} · tel ${c.phone} · ${c.addresses.map((a) => `${a.label}: ${a.address}`).join(" | ")} · alta ${d10(c.createdAt)} · ${n} ${n === 1 ? "compra" : "compras"}`;
      });
    case "customerorders": {
      const orderOf = (id) => all.orders.find((o) => String(o._id) === String(id));
      const nameOf = (id) => {
        const c = all.customers.find((cc) => String(cc._id) === String(id));
        return `${c.name} ${c.lastName}`;
      };
      return [...docs]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((l) => {
          const o = orderOf(l.order);
          return `${o.orderNumber} · ${d10(o.createdAt)} · ${nameOf(l.customer)} · ${o.items.map((i) => `${i.product} ${i.color} ×${i.quantity.toLocaleString("en-US")}`).join(", ")} · ${money(o.total)} · ${o.status}${o.notes ? ` · nota «${o.notes}»` : ""}`;
        });
    }
    case "paymenttransactions":
      return [...docs]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((p) => `${all.orders.find((o) => String(o._id) === String(p.order)).orderNumber} · ${p.provider} · ${money(p.monto)} USD · tarjeta ****${p.cardLast4} · ${p.status} · idTransaccion ${p.idTransaccion.slice(0, 8)}… · ${d10(p.createdAt)}`);
    default:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Respaldo (EJSON) y corrida real                                             */
/* -------------------------------------------------------------------------- */

// Respaldo compartido con assign-route-codes.js (scripts/lib/backup.js).
const backup = (db, names) => backupCollections(db, names, { prefix: "pre-reset" });

// Colecciones, tipos, índices y validadores, para comparar antes/después.
async function structure(db) {
  const cols = await db.listCollections().toArray();
  const out = {};
  for (const c of cols) out[c.name] = { type: c.type, options: c.options ?? {}, indexes: await db.collection(c.name).indexes() };
  return out;
}

/* -------------------------------------------------------------------------- */
/* Principal                                                                   */
/* -------------------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);
  const run = args.includes("--run");
  const regenProducts = args.includes("--regenerar-productos");
  const includeStore = args.includes("--incluir-tienda");
  const { config } = await import(pathToFileURL(path.join(BACKEND_DIR, "config.js")).href);
  if (!config.db.URI) throw new Error("Falta DB_URI en el .env de Web/private/backend");

  console.log(run ? "MODO --run: se respalda, se borra y se repuebla la base." : "MODO --dry-run: no se escribe nada en la base.");
  const client = new MongoClient(config.db.URI);
  await client.connect();
  try {
    const db = client.db();
    const before = await structure(db);
    const existing = Object.keys(before);
    console.log(`Base: ${db.databaseName} · ${existing.length} colecciones`);

    // Administrador: exactamente un empleado con role "admin" (campo heredado).
    const admins = await db.collection("employees").find({ role: "admin" }, { projection: { password: 0, attendance: 0 } }).toArray();
    if (admins.length !== 1) throw new Error(`Se esperaba exactamente 1 empleado con role "admin" y hay ${admins.length}. No se hace nada.`);
    const admin = admins[0];
    console.log(`Administrador que se conserva: ${admin.name} ${admin.lastName} <${admin.email}> · _id ${admin._id}`);

    const unknown = existing.filter((n) => ![...PANEL, PRODUCTS, ...STORE, ...LEGACY].includes(n));
    const missing = PANEL.filter((n) => !existing.includes(n));
    if (missing.length) throw new Error(`Faltan colecciones del panel en la base: ${missing.join(", ")}. No se crean colecciones nuevas; no se hace nada.`);

    // Catálogo: el real (se conserva) o el regenerado. Cada producto se empareja
    // con su subcategoría; si algo no cuadra no se hace nada.
    const catalogSource = regenProducts ? catalogDocs() : await db.collection(PRODUCTS).find().toArray();
    const { pairs, errors: pairErrors } = pairProducts(catalogSource);
    console.log(`\n=== Emparejamiento producto → subcategoría (${regenProducts ? "catálogo regenerado" : "catálogo real, se conserva"}) ===`);
    for (const { product, sub } of pairs) {
      console.log(`- ${String(product._id ?? "(nuevo)").padEnd(24)} «${product.name}» [${product.category}] $${product.price} · mín ${product.minOrderQuantity} · ${(product.colors || []).join("/")}  →  subcategory = «${sub}»`);
    }
    if (pairErrors.length) throw new Error(`El emparejamiento no es válido; no se hace nada:\n- ${pairErrors.join("\n- ")}`);
    const catalog = pairs.map(({ product, sub }) => ({ sub, price: product.price, min: product.minOrderQuantity ?? 1, colors: product.colors }));

    console.log("\nGenerando datos (ensayo completo en una base en memoria)…");
    const { docs, warnings } = await simulate(catalog);
    if (regenProducts) docs.products = catalogSource;
    const problems = await checkGenerated(docs, admin._id);

    // Plan por colección.
    const reset = [...PANEL, ...(regenProducts ? [PRODUCTS] : []), ...(includeStore ? STORE : [])];
    console.log("\n=== Plan por colección ===");
    const rows = [];
    for (const name of existing.sort()) {
      const current = await db.collection(name).countDocuments();
      let action;
      let del = 0;
      let add = 0;
      if (name === "employees") {
        del = current - 1;
        add = docs.employees.length;
        action = "borrar todos menos el administrador · insertar nuevos";
      } else if (reset.includes(name)) {
        del = current;
        add = docs[name]?.length ?? 0;
        action = add ? "borrar todos · insertar nuevos" : "borrar todos (no se repuebla)";
      } else if (name === PRODUCTS) action = `SE CONSERVA · con --run se asigna subcategory a ${pairs.length} productos (un updateOne por _id, solo ese campo; usa --regenerar-productos para recrearlo)`;
      else if (STORE.includes(name)) action = "NO SE TOCA (tienda en línea; --incluir-tienda para reemplazarla)";
      else if (LEGACY.includes(name)) action = "NO SE TOCA (colección heredada, sin código que la use)";
      else action = "NO SE TOCA (no reconocida)";
      rows.push({ name, current, del, add, final: current - del + add, action });
    }
    for (const r of rows) console.log(`- ${r.name.padEnd(20)} hoy ${String(r.current).padStart(4)} · borrar ${String(r.del).padStart(4)} · insertar ${String(r.add).padStart(4)} · queda ${String(r.final).padStart(4)} · ${r.action}`);
    if (unknown.length) console.log(`\n⚠ Colecciones no reconocidas (no se tocan): ${unknown.join(", ")}`);

    console.log("\n=== Vista previa de los datos nuevos ===");
    for (const name of [...PANEL, ...(regenProducts ? [PRODUCTS] : []), ...(includeStore ? STORE : [])]) {
      const list = name === "employees" ? docs.employees : docs[name];
      console.log(`\n# ${name} (${list.length})`);
      for (const line of preview(name, list, docs)) console.log(`  ${line}`);
    }
    if (includeStore) {
      const sold = docs.paymenttransactions.reduce((s, p) => s + p.monto, 0);
      console.log(`\nTienda: ${docs.customers.length} cuentas · ${docs.customerorders.length} compras enlazadas a pedidos nuevos · cobrado por Wompi ${money(sold)} USD`);
    } else {
      console.log("\n⚠ Sin --incluir-tienda: los vínculos y pagos actuales de la tienda apuntarían a pedidos que se borran.");
    }
    const orders = docs.orders;
    const first = orders.reduce((m, o) => Math.min(m, +o.createdAt), Infinity);
    const last = orders.reduce((m, o) => Math.max(m, +o.createdAt), 0);
    const income = docs.transactions.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const spend = docs.transactions.filter((t) => t.type === "Gasto").reduce((s, t) => s + t.amount, 0);
    console.log(`\nPedidos: ${orders.length} entre ${d10(first)} y ${d10(last)} (UTC) · ${new Set(orders.map((o) => o.customer.name)).size} clientes distintos`);
    console.log(`Finanzas del período: ingresos ${money(income)} · gastos ${money(spend)} · neto ${money(income - spend)}`);
    console.log("\n=== Estados que se verán en el panel ===");
    for (const [k, v] of Object.entries(await coverage(docs))) console.log(`- ${k}: ${Object.entries(v).map(([s, n]) => `${s} ${n}`).join(" · ")}`);
    console.log("\n=== Rutas generadas (códigos, fechas y estados) ===");
    for (const line of routeSummary(docs.routes)) console.log(`- ${line}`);
    console.log("\n=== Productos en los datos generados (solo deben ser subcategorías) ===");
    const distinct = (label, names) => {
      const counts = names.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
      console.log(`- ${label}: ${Object.entries(counts).sort().map(([n, c]) => `${n} (${c})`).join(" · ")}`);
    };
    distinct("orders.items.product", docs.orders.flatMap((o) => o.items.map((i) => i.product)));
    distinct("productionbatches.product", docs.productionbatches.map((b) => b.product));
    distinct("dailybatches.product", docs.dailybatches.map((d) => d.product));
    distinct("inventoryitems.name (Producto Terminado)", docs.inventoryitems.filter((i) => i.category === "Producto Terminado").map((i) => i.name));
    console.log("\n=== Verificaciones ===");
    console.log(problems.length ? problems.map((p) => `✖ ${p}`).join("\n") : "✔ Sin referencias huérfanas; estados de pedidos y rutas coherentes con la lógica del sistema; sin stock negativo.");
    if (warnings.length) console.log(warnings.map((w) => `⚠ ${w}`).join("\n"));
    if (problems.length) throw new Error("Los datos generados tienen problemas; no se sigue.");

    if (!run) {
      console.log("\nDry-run terminado: no se escribió nada en la base.");
      return;
    }

    // --- Corrida real --------------------------------------------------------
    console.log("\nRespaldando la base completa…");
    const dir = await backup(db, existing);
    console.log(`✔ Respaldo en ${path.relative(BACKEND_DIR, dir)}`);

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        for (const name of reset) {
          const col = db.collection(name);
          const filter = name === "employees" ? { _id: { $ne: admin._id } } : {};
          await col.deleteMany(filter, { session });
          const list = docs[name] ?? [];
          if (list.length) await col.insertMany(list, { session, ordered: true });
        }
        // Catálogo conservado: solo se le asigna su subcategoría (nada más cambia).
        if (!regenProducts) {
          for (const { product, sub } of pairs) {
            await db.collection(PRODUCTS).updateOne({ _id: product._id }, { $set: { subcategory: sub } }, { session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    const after = await structure(db);
    const same = JSON.stringify(Object.keys(before).sort()) === JSON.stringify(Object.keys(after).sort()) && Object.keys(before).every((n) => JSON.stringify(before[n]) === JSON.stringify(after[n]));
    console.log("\n=== Resultado ===");
    for (const name of Object.keys(after).sort()) console.log(`- ${name.padEnd(20)} ${await db.collection(name).countDocuments()}`);
    console.log(same ? "✔ Mismas colecciones, índices, opciones y validadores que antes de la corrida (nada se soltó ni se recreó)." : "✖ La estructura cambió respecto de antes: revisar.");
    const withSub = await db.collection(PRODUCTS).countDocuments({ subcategory: { $in: SUB_NAMES } });
    console.log(withSub === pairs.length ? `✔ ${withSub} productos con su subcategoría asignada.` : `✖ Solo ${withSub} de ${pairs.length} productos quedaron con subcategoría: revisar.`);
    const stillAdmin = await db.collection("employees").countDocuments({ _id: admin._id, role: "admin" });
    console.log(stillAdmin === 1 ? "✔ El administrador sigue intacto." : "✖ No se encontró el administrador.");
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
}
