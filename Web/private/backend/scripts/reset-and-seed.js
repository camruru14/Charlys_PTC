/*
  Respaldo, reinicio y datos de prueba realistas desde el 1 de enero de 2026 (hora de El Salvador).

  Uso (desde Web/private/backend, donde está el .env):
    node scripts/reset-and-seed.js                      # esta ayuda
    node scripts/reset-and-seed.js --dry-run            # genera todo en memoria, imprime el resumen y los
                                                        #   chequeos; NO escribe nada
    node scripts/reset-and-seed.js --backup             # solo exporta todas las colecciones a
                                                        #   scripts/backups/<fecha-hora>/<coleccion>.json
    CONFIRM_RESET=BORRAR-TODO node scripts/reset-and-seed.js --backup --apply
                                                        # respalda, verifica el respaldo, borra y siembra
  Opciones: --seed=2026 (semilla del generador), --now=2026-10-14T16:30:00Z (fija «ahora»; sirve para
  reproducir exactamente una simulación).

  --apply exige --backup en la MISMA corrida y CONFIRM_RESET=BORRAR-TODO; si falta algo termina sin
  tocar nada. Borra con deleteMany por colección (sin drop: se conservan los índices) y todo el
  borrado + la inserción corre en UNA transacción de MongoDB: si algo falla, no queda nada a medias.

  Se conserva: empleados administradores (isAdministrator), vehículos, catálogo, categorías de gasto
  (solo se les agregan presupuestos), bodegas, líneas de producción, CompanySettings y WorkSchedule.
  Se borra: empleados no administradores, pedidos, CustomerOrder, transacciones, inventario, lotes,
  lotes diarios, rutas, novedades, contadores, clientes, pagos y recuperaciones de contraseña.

  No imprime la URI ni ningún valor del .env; las contraseñas generadas solo van a los CSV de
  scripts/seed-output/. No toca Cloudinary.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseEnv, config as loadEnv } from "dotenv";
import mongoose from "mongoose";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..");
// El .env se carga por ruta absoluta ANTES de importar config.js (que hace dotenv.config() relativo a la
// carpeta actual): así el script funciona corrido desde cualquier carpeta.
const ENV_FILE = path.join(backendRoot, ".env");
loadEnv({ path: ENV_FILE, quiet: true });
// El .env de esta máquina trae EMPLOYEE_PASSWORD_KEY con comillas mal puestas (dotenv la lee vacía). Sin tocar el
// archivo, se toma la llave de 64 hex de esa línea solo para este proceso (nunca se imprime).
{
  const valid = (v) => /^[0-9a-fA-F]{64}$/.test(v || "");
  if (!valid(process.env.EMPLOYEE_PASSWORD_KEY)) {
    const raw = fs.readFileSync(ENV_FILE, "utf8").match(/^s*EMPLOYEE_PASSWORD_KEYs*=(.*)$/m)?.[1] || "";
    const runs = raw.match(/[0-9a-fA-F]{64}/g) || [];
    if (runs.length === 1 && !/[0-9a-fA-F]{65}/.test(raw)) process.env.EMPLOYEE_PASSWORD_KEY = runs[0];
  }
}

const { config } = await import("../config.js");

// ---- Argumentos -------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DRY = flag("dry-run");
const BACKUP = flag("backup");
const VERIFY = flag("verify"); // solo vuelve a correr los chequeos leyendo la base (no escribe nada)
const APPLY = flag("apply");
const SEED = Number(option("seed") ?? 2026);
const NOW = option("now") ? new Date(option("now")) : new Date();

const out = (line = "") => console.log(line);
const title = (text) => out(`\n=== ${text} ===`);
// Mensajes de error sin cadenas de conexión.
const safe = (error) => String(error?.message || error).replace(/mongodb(\+srv)?:\/\/\S+/gi, "<URI>");

function help() {
  out(`Respaldo, reinicio y datos de prueba (desde el 1 de enero de 2026)

  node scripts/reset-and-seed.js --dry-run     Genera todo en memoria y muestra el resumen. No escribe nada.
  node scripts/reset-and-seed.js --verify      Repite los chequeos de coherencia leyendo la base. No escribe nada.
  node scripts/reset-and-seed.js --backup      Solo respalda todas las colecciones (scripts/backups/<fecha-hora>/).
  CONFIRM_RESET=BORRAR-TODO node scripts/reset-and-seed.js --backup --apply
                                               Respalda, verifica, borra y siembra (PowerShell:
                                               $env:CONFIRM_RESET="BORRAR-TODO"; node scripts/reset-and-seed.js --backup --apply)

  --seed=2026            Semilla del generador (misma semilla = mismos datos).
  --now=<fecha ISO>      Fija «ahora» para reproducir exactamente una simulación.

  --apply exige --backup y CONFIRM_RESET=BORRAR-TODO en la misma ejecución.
  Para restaurar: CONFIRM_RESTORE=RESTAURAR node scripts/restore-backup.js scripts/backups/<carpeta>`);
}

if (!DRY && !BACKUP && !APPLY && !VERIFY) {
  help();
  process.exit(0);
}
if (Number.isNaN(NOW.getTime())) {
  out("--now no es una fecha válida.");
  process.exit(1);
}
if (APPLY) {
  const problems = [];
  if (!BACKUP) problems.push("falta --backup en esta misma ejecución");
  if (process.env.CONFIRM_RESET !== "BORRAR-TODO") problems.push("falta la variable CONFIRM_RESET=BORRAR-TODO");
  if (DRY) problems.push("--dry-run y --apply no se combinan");
  if (problems.length) {
    out(`No se hizo nada: ${problems.join("; ")}.`);
    process.exit(1);
  }
}

// Colecciones: qué se borra por completo y qué se conserva. El resto (desconocidas) no se toca.
const WIPE = [
  "orders", "customerorders", "transactions", "inventoryitems", "productionbatches", "dailybatches", "routes",
  "activities", "activityseens", "counters", "customers", "paymenttransactions", "passwordresets",
  // Registros de operación antiguos que ya no tienen modelo en ninguno de los dos backends.
  "stockmovements", "inventorymovements",
];
const KEEP = ["vehicles", "products", "expensecategories", "warehouses", "productionlines", "companysettings", "workschedules"];
const KEEP_PATTERNS = [/^subcategories_backup_/]; // respaldo de la migración de subcategorías
const classify = (name) => (name === "employees" ? "empleados" : WIPE.includes(name) ? "borrar" : KEEP.includes(name) || KEEP_PATTERNS.some((p) => p.test(name)) ? "conservar" : "desconocida");

// ---- Base de datos ----------------------------------------------------------------------------
function dbNameAndHost(uri) {
  const name = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || "")?.[1] || "";
  const host = /@([^/?]+)/.exec(uri || "")?.[1] || "";
  return { name, host };
}

function assertSameDatabaseAsStore() {
  const own = dbNameAndHost(config.db.URI);
  const storeEnv = path.resolve(backendRoot, "../../public/backend/.env");
  if (!fs.existsSync(storeEnv)) throw new Error("No se encontró Web/public/backend/.env para comparar con la base de la tienda.");
  const store = dbNameAndHost(parseEnv(fs.readFileSync(storeEnv))?.DB_URI);
  if (!own.name || own.name !== store.name) throw new Error(`La tienda usa otra base (panel: «${own.name}», tienda: «${store.name || "?"}»). Abortado.`);
  if (own.host !== store.host) throw new Error(`La tienda apunta a otro clúster aunque la base se llame igual («${own.name}»). Abortado.`);
  return own.name;
}

await import("./seed/models.js"); // apaga autoIndex/autoCreate ANTES de cargar modelos y librerías
const { M } = await import("./seed/models.js");
const { generateDataset, START_KEY } = await import("./seed/dataset.js");
const { runChecks } = await import("./seed/checks.js");
const { isAdministrator } = await import("../src/lib/permissions.js");
const { encryptPassword } = await import("../src/lib/passwordCrypto.js");
const { checkPassword } = await import("../src/lib/employeeFields.js");
const T = await import("./seed/time.js");
const { default: bcryptjs } = await import("bcryptjs");
const { EJSON } = mongoose.mongo.BSON;

async function loadContext(db) {
  const all = (name, projection) => db.collection(name).find({}, projection ? { projection } : undefined).toArray();
  const [products, categories, warehouses, productionLines, vehicles, schedules, employees] = await Promise.all([
    all("products"),
    all("expensecategories"),
    all("warehouses"),
    all("productionlines"),
    all("vehicles"),
    all("workschedules"),
    all("employees", { password: 0, attendance: 0, photo: 0 }),
  ]);
  return {
    products,
    categories,
    warehouses,
    productionLines,
    vehicles,
    workSchedule: { startTime: schedules[0]?.startTime || "07:00", workdayHours: schedules[0]?.workdayHours ?? 8 },
    admins: employees.filter(isAdministrator),
    employeeCount: employees.length,
  };
}

async function collectionCounts(db) {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const counts = {};
  for (const name of names.sort()) counts[name] = await db.collection(name).countDocuments();
  return counts;
}

// ---- Respaldo ---------------------------------------------------------------------------------
async function makeBackup(db) {
  const d = T.dayKeyOf(NOW).replace(/-/g, "");
  const time = new Date(NOW.getTime() - T.SV_OFFSET_H * 3600000).toISOString().slice(11, 19).replace(/:/g, "");
  const dir = path.join(here, "backups", `${d}-${time}`);
  fs.mkdirSync(dir, { recursive: true });
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const written = {};
  for (const name of names.sort()) {
    const lines = [];
    for await (const doc of db.collection(name).find({})) lines.push(EJSON.stringify(doc, undefined, undefined, { relaxed: false }));
    fs.writeFileSync(path.join(dir, `${name}.json`), lines.length ? `${lines.join("\n")}\n` : "");
    written[name] = lines.length;
  }
  fs.writeFileSync(path.join(dir, "_meta.json"), JSON.stringify({ database: db.databaseName, createdAt: NOW.toISOString(), collections: written }, null, 2));
  return { dir, written };
}

// Cuenta las líneas de cada archivo y las compara con la colección tal como está AHORA.
async function verifyBackup(db, backup) {
  const problems = [];
  for (const [name, expected] of Object.entries(backup.written)) {
    const file = path.join(backup.dir, `${name}.json`);
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    const now = await db.collection(name).countDocuments();
    if (lines.length !== expected || lines.length !== now) problems.push(`${name}: archivo=${lines.length}, exportados=${expected}, colección ahora=${now}`);
    for (const line of lines.slice(0, 3)) EJSON.parse(line, { relaxed: false }); // que se pueda leer
  }
  if (problems.length) throw new Error(`El respaldo no cuadra con la base:\n  ${problems.join("\n  ")}`);
}

// ---- Salida ---------------------------------------------------------------------------------
const fmtMoney = (n) => `$${Math.round(n).toLocaleString("es-SV")}`;

function printSummary({ dbName, ctx, existing, ds, rep, mb }) {
  const { docs, meta } = ds;
  title("Contexto");
  out(`Base: ${dbName} (coincide con la de la tienda)`);
  out(`Hoy en El Salvador: ${meta.todayKey} · semilla ${meta.seed} · inicio ${meta.startKey}`);
  out(`Administradores que se conservan (${ctx.admins.length}): ${ctx.admins.map((a) => `${a.name} ${a.lastName} <${a.email}>`).join("; ")}`);
  out(`Categorías de gasto: ${ctx.categories.map((c) => c.name).join(", ")}${meta.missingCategories.length ? ` (faltaban: ${meta.missingCategories.join(", ")}; se usó «Otros»)` : ""}`);

  title("Por colección: existentes / se borran / se crean");
  const created = { employees: docs.employees.length, customers: docs.customers.length, orders: docs.orders.length, customerorders: docs.customerorders.length, paymenttransactions: docs.paymenttransactions.length, transactions: docs.transactions.length, inventoryitems: docs.inventoryitems.length, productionbatches: docs.productionbatches.length, dailybatches: docs.dailybatches.length, routes: docs.routes.length, counters: docs.counters.length };
  const names = Object.keys(existing).sort();
  out(`${"colección".padEnd(34)}${"existen".padStart(9)}${"se borran".padStart(11)}${"se crean".padStart(10)}${"quedan".padStart(9)}   acción`);
  for (const name of names) {
    const kind = classify(name);
    const have = existing[name];
    const del = kind === "borrar" ? have : kind === "empleados" ? Math.max(0, have - ctx.admins.length) : 0;
    const add = created[name] || 0;
    const note = kind === "conservar" ? (name === "expensecategories" ? "se conserva; se agregan presupuestos" : "se conserva") : kind === "desconocida" ? "NO se toca (revisar)" : "";
    out(`${name.padEnd(34)}${String(have).padStart(9)}${String(del).padStart(11)}${String(add).padStart(10)}${String(have - del + add).padStart(9)}   ${note}`);
  }
  for (const name of Object.keys(created)) if (!(name in existing)) out(`${name.padEnd(34)}${"0".padStart(9)}${"0".padStart(11)}${String(created[name]).padStart(10)}${String(created[name]).padStart(9)}   (colección nueva)`);

  title("Por mes");
  const months = meta.months;
  const row = (cells) => out(cells.map((c, i) => (i === 0 ? String(c).padEnd(9) : String(c).padStart(11))).join(""));
  row(["mes", "pedidos", "ventas", "gastos", "margen", "lotes", "rutas"]);
  for (const m of months) {
    const orders = docs.orders.filter((o) => T.dayKeyOf(o.createdAt).startsWith(m));
    const sales = orders.reduce((s, o) => s + o.total, 0);
    const expenses = docs.transactions.filter((t) => t.type === "Gasto" && t.date.toISOString().startsWith(m)).reduce((s, t) => s + t.amount, 0);
    const batches = docs.productionbatches.filter((b) => T.dayKeyOf(b.createdAt).startsWith(m)).length;
    const routes = docs.routes.filter((r) => T.dayKeyOf(r.createdAt).startsWith(m)).length;
    row([m, orders.length, fmtMoney(sales), fmtMoney(expenses), fmtMoney(sales - expenses), batches, routes]);
  }

  title("Resultados de la simulación");
  const count = (list, f) => list.reduce((acc, x) => ((acc[f(x)] = (acc[f(x)] || 0) + 1), acc), {});
  out(`Estados de pedidos: ${JSON.stringify(count(docs.orders, (o) => o.status))}`);
  {
    const recent = docs.orders.filter((o) => NOW - o.createdAt < 10 * 86400000);
    const routeOf = new Map(docs.routes.map((r) => [String(r._id), r]));
    const bucket = (o) => {
      if (o.status === "Entregado") return "Entregado";
      const r = o.delivery?.route && routeOf.get(String(o.delivery.route));
      if (o.status === "Empacado") return r ? `Empacado, ruta ${r.status}` : "Empacado esperando ruta";
      if (o.status === "En Tránsito") return "En Tránsito";
      return o.status;
    };
    const dist = count(recent, bucket);
    out(`Pedidos de los últimos 10 días (${recent.length}):`);
    for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) out(`    ${k.padEnd(30)}${String(v).padStart(4)}`);
    const lastPartials = docs.routes.flatMap((r) => r.deliveries.filter((d) => d.partial && NOW - d.at < 10 * 86400000));
    out(`    entregas parciales recientes: ${lastPartials.length}`);
  }
  if (process.env.SEED_DEBUG) out(`DEBUG roles: ${JSON.stringify(meta.stats.roles)}`);
  out(`Lotes: ${JSON.stringify(count(docs.productionbatches, (b) => `${b.category}/${b.status}`))}`);
  out(`Rutas: ${JSON.stringify(count(docs.routes, (r) => r.status))}`);
  out(`Líneas surtidas de existencias: ${meta.stats.linesStock} · enviadas a fabricar: ${meta.stats.linesManufactured} · divididas: ${meta.stats.linesSplit} · entregas parciales: ${meta.stats.partialRoutes}`);
  const pending = docs.transactions.filter((t) => t.status === "Pendiente");
  out(`Movimientos pendientes: ${pending.length} (${pending.filter((t) => t.dueDate < T.midnightUTC(meta.todayKey)).length} vencidos)`);
  out(`Presupuestos por categoría: ${[...ds.budgets].map(([k, v]) => `${k} (${v.length})`).join(", ")} · se pasan en algún mes: ${meta.overspent.join(", ") || "ninguna"}`);
  out(`Tamaño estimado de los documentos a insertar: ${mb.toFixed(1)} MB`);
  out("Nota: los pedidos de la tienda nacen «Procesando» (nunca «Pendiente»), igual que el checkout real.");

  title("Chequeos de coherencia (datos en memoria)");
  for (const r of rep.results) {
    out(`${r.errors.length ? "✗" : "✓"} ${r.name}: ${r.errors.length} error(es)`);
    r.errors.slice(0, rep.examples).forEach((e) => out(`      · ${e}`));
  }
}

function writeCsvs(ds) {
  const dir = path.join(here, "seed-output");
  fs.mkdirSync(dir, { recursive: true });
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const bom = "﻿";
  const emp = [["nombre", "correo", "area", "puesto", "contrasena"], ...ds.credentials.employees.map((e) => [e.name, e.email, e.department, e.position, e.password])];
  const cli = [["correo", "contrasena"], ...ds.credentials.customers.map((c) => [c.email, c.password])];
  fs.writeFileSync(path.join(dir, "empleados.csv"), bom + emp.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n");
  fs.writeFileSync(path.join(dir, "clientes.csv"), bom + cli.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n");
  return dir;
}

// Contraseñas: empleados cifrados con la llave del panel; clientes con bcrypt, como la tienda.
async function applyCredentials(ds, { hashCustomers }) {
  const byId = (list) => new Map(list.map((c) => [c.id, c.password]));
  const empPw = byId(ds.credentials.employees);
  const cusPw = byId(ds.credentials.customers);
  for (const e of ds.docs.employees) {
    const plain = empPw.get(String(e._id));
    checkPassword(plain);
    e.password = encryptPassword(plain);
  }
  for (const c of ds.docs.customers) {
    const plain = cusPw.get(String(c._id));
    c.password = hashCustomers ? await bcryptjs.hash(plain, 10) : "$2b$10$dry-run-placeholder-not-a-real-hash";
  }
}

// ---- Principal ----------------------------------------------------------------------------------
const startedAt = Date.now();
try {
  // La llave de contraseñas de empleados tiene que funcionar (sin imprimirla).
  const { decryptPassword } = await import("../src/lib/passwordCrypto.js");
  if (decryptPassword(encryptPassword("prueba")) !== "prueba") throw new Error("EMPLOYEE_PASSWORD_KEY no permite encriptar y desencriptar.");
  out("Llave de contraseñas de empleados: OK (encryptPassword/decryptPassword funcionan).");
  await mongoose.connect(config.db.URI, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  const dbName = assertSameDatabaseAsStore();
  if (db.databaseName !== dbName) throw new Error("El nombre de la base conectada no coincide con el del .env.");
  out(`Base de datos: ${dbName} (la tienda usa la misma).`);

  const ctx = await loadContext(db);
  if (!ctx.admins.length) throw new Error("No hay empleados administradores: no se hace nada.");
  const existing = await collectionCounts(db);

  if (VERIFY) {
    const docsNow = {};
    for (const name of ["employees", "customers", "orders", "customerorders", "paymenttransactions", "transactions", "inventoryitems", "productionbatches", "dailybatches", "routes", "counters"]) docsNow[name] = await db.collection(name).find({}).toArray();
    const repNow = runChecks({ docs: docsNow, ctx, now: NOW, startKey: START_KEY, meta: {}, mode: "base" });
    title("Chequeos leyendo la base");
    for (const r of repNow.results) {
      out(`${r.errors.length ? "✗" : "✓"} ${r.name}: ${r.errors.length} error(es)`);
      r.errors.slice(0, repNow.examples).forEach((e) => out(`      · ${e}`));
    }
    out("Documentos: " + Object.entries(docsNow).map(([n, l]) => `${n}=${l.length}`).join(", "));
    process.exit(repNow.totalErrors ? 1 : 0);
  }

  if (BACKUP && !APPLY) {
    const backup = await makeBackup(db);
    await verifyBackup(db, backup);
    title("Respaldo listo");
    out(`Carpeta: ${path.relative(process.cwd(), backup.dir)}`);
    for (const [n, c] of Object.entries(backup.written)) out(`  ${n.padEnd(34)}${String(c).padStart(7)} documentos`);
    process.exit(0);
  }

  const ds = await generateDataset({ ctx, M, seed: SEED, now: NOW, startKey: START_KEY });
  await applyCredentials(ds, { hashCustomers: false });
  const rep = runChecks({ docs: ds.docs, ctx, now: NOW, startKey: START_KEY, meta: ds.meta, mode: "memoria" });
  const mb = Buffer.byteLength(JSON.stringify(ds.docs)) / 1048576;
  printSummary({ dbName, ctx, existing, ds, rep, mb });
  if (rep.totalErrors > 0) {
    out(`\nHay ${rep.totalErrors} error(es) de coherencia: no se escribe nada.`);
    process.exit(1);
  }
  if (!APPLY) {
    out("\n--dry-run: no se escribió nada en la base.");
    process.exit(0);
  }

  // ---------------- --apply ----------------
  title("1. Respaldo");
  const backup = await makeBackup(db);
  out(`Carpeta: ${path.relative(process.cwd(), backup.dir)}`);
  await verifyBackup(db, backup);
  out("Respaldo verificado: cada archivo tiene los mismos documentos que su colección.");
  const restoreCommand = `CONFIRM_RESTORE=RESTAURAR node scripts/restore-backup.js ${path.relative(process.cwd(), backup.dir).replace(/\\/g, "/")}`;

  try {
    title("2. Borrado y siembra (una sola transacción)");
    await applyCredentials(ds, { hashCustomers: true });
    const csvDir = writeCsvs(ds);
    out(`Contraseñas escritas en ${path.relative(process.cwd(), csvDir)} (empleados.csv, clientes.csv).`);
    const adminIds = ctx.admins.map((a) => a._id);
    const deleted = {};
    const inserted = {};
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const k of Object.keys(deleted)) delete deleted[k];
        for (const k of Object.keys(inserted)) delete inserted[k];
        const existingNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
        for (const name of WIPE) {
          if (!existingNames.has(name)) continue;
          deleted[name] = (await db.collection(name).deleteMany({}, { session })).deletedCount;
        }
        deleted.employees = (await db.collection("employees").deleteMany({ _id: { $nin: adminIds } }, { session })).deletedCount;
        const order = ["employees", "customers", "orders", "customerorders", "paymenttransactions", "transactions", "inventoryitems", "productionbatches", "dailybatches", "routes", "counters"];
        for (const name of order) {
          const list = ds.docs[name];
          inserted[name] = 0;
          for (let i = 0; i < list.length; i += 500) {
            await db.collection(name).insertMany(list.slice(i, i + 500), { session, ordered: true });
            inserted[name] += Math.min(500, list.length - i);
          }
        }
        // Presupuestos: solo se agregan entradas a `budgets` de las categorías existentes.
        for (const c of ctx.categories) {
          const entries = ds.budgets.get(c.name);
          if (!entries) continue;
          const have = new Set((c.budgets || []).map((b) => b.month));
          const merged = [...(c.budgets || []), ...entries.filter((e) => !have.has(e.month))].sort((a, b) => (a.month < b.month ? -1 : 1));
          await db.collection("expensecategories").updateOne({ _id: c._id }, { $set: { budgets: merged, updatedAt: NOW } }, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    out(`Documentos borrados: ${JSON.stringify(deleted)}`);
    out(`Documentos creados: ${JSON.stringify(inserted)}`);

    title("3. Chequeos leyendo la base");
    const ctxAfter = await loadContext(db);
    const read = async (name) => db.collection(name).find({}).toArray();
    const docsAfter = {};
    for (const name of ["employees", "customers", "orders", "customerorders", "paymenttransactions", "transactions", "inventoryitems", "productionbatches", "dailybatches", "routes", "counters"]) docsAfter[name] = await read(name);
    const repAfter = runChecks({ docs: docsAfter, ctx: ctxAfter, now: NOW, startKey: START_KEY, meta: {}, mode: "base" });
    for (const r of repAfter.results) {
      out(`${r.errors.length ? "✗" : "✓"} ${r.name}: ${r.errors.length} error(es)`);
      r.errors.slice(0, repAfter.examples).forEach((e) => out(`      · ${e}`));
    }
    const mismatched = Object.keys(inserted).filter((n) => docsAfter[n].length !== (n === "employees" ? inserted[n] + ctxAfter.admins.length : inserted[n]));
    if (mismatched.length) throw new Error(`Los conteos no coinciden tras insertar: ${mismatched.join(", ")}`);
    if (repAfter.totalErrors > 0) throw new Error(`Chequeos tras el --apply: ${repAfter.totalErrors} error(es).`);

    title("Listo");
    out(`Base: ${dbName}`);
    out(`Administradores conservados: ${ctxAfter.admins.map((a) => `${a.name} ${a.lastName} <${a.email}>`).join("; ")}`);
    out(`Respaldo: ${path.relative(process.cwd(), backup.dir)}`);
    out(`Para restaurar: ${restoreCommand}`);
  } catch (error) {
    out(`\nERROR durante el borrado o la siembra: ${safe(error)}`);
    out("No reintentes --apply. Revisa el estado de la base y avísame con este detalle.");
    out(`Comando de restauración (no se ejecutó): ${restoreCommand}`);
    process.exitCode = 1;
  }
} catch (error) {
  out(`\nERROR: ${safe(error)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => null);
  out(`\n(${((Date.now() - startedAt) / 1000).toFixed(1)} s)`);
}
