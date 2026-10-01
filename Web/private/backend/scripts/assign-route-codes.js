// Códigos para las rutas existentes (R-AAAA-NNNN).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   node scripts/assign-route-codes.js            (= --dry-run, modo seguro)
//   node scripts/assign-route-codes.js --dry-run  (no escribe nada)
//   node scripts/assign-route-codes.js --run      (respalda y asigna)
//
// Las rutas creadas antes del código único no lo tienen y se muestran como
// «Ruta N» (el número se reiniciaba cada día y se repetía). Este script les
// asigna un código en orden cronológico (createdAt; si empatan, por _id), con el
// año de su creación (hora de El Salvador) y un consecutivo de 4 dígitos que
// reinicia cada año. Si ya hay rutas con código, continúa después del último de
// cada año sin duplicar. Es idempotente: las rutas que ya tienen código no se
// tocan, así que correrlo otra vez no cambia nada.
//
// Con --run: primero respalda la colección `routes` en
// backups/pre-route-codes-AAAA-MM-DD-HHmm/ (si el respaldo falla, no toca
// nada), después hace un $set de `code` por ruta (solo ese campo, y solo si la
// ruta sigue sin código) y verifica el índice único de `code` (lo crea si falta).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import { backupCollections, BACKEND_DIR } from "./lib/backup.js";

const COLLECTION = "routes";
const CODE_RE = /^R-(\d{4})-(\d{4,})$/;
const svYear = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador", year: "numeric" }).format(date);

// Cuándo se creó la ruta: createdAt, o su `date`, o la fecha que lleva el _id.
const createdOf = (route) => new Date(route.createdAt || route.date || route._id.getTimestamp());

// Calcula las asignaciones sin escribir nada.
// Devuelve { assignments: [{ _id, code, route }], existing, byYear, problems }.
export function planRouteCodes(routes) {
  const problems = [];
  const lastByYear = new Map();
  const seen = new Map();
  for (const r of routes) {
    if (!r.code) continue;
    const m = CODE_RE.exec(r.code);
    if (!m) {
      problems.push(`la ruta ${r._id} tiene un código con formato inesperado: «${r.code}»`);
      continue;
    }
    if (seen.has(r.code)) problems.push(`código duplicado ${r.code} en las rutas ${seen.get(r.code)} y ${r._id}`);
    seen.set(r.code, r._id);
    lastByYear.set(m[1], Math.max(lastByYear.get(m[1]) || 0, Number(m[2])));
  }
  const pending = routes
    .filter((r) => !r.code)
    .sort((a, b) => createdOf(a) - createdOf(b) || String(a._id).localeCompare(String(b._id)));
  const assignments = [];
  const byYear = {};
  for (const route of pending) {
    const year = svYear(createdOf(route));
    const seq = (lastByYear.get(year) || 0) + 1;
    lastByYear.set(year, seq);
    const code = `R-${year}-${String(seq).padStart(4, "0")}`;
    if (seen.has(code)) problems.push(`el código ${code} ya existe`);
    seen.set(code, route._id);
    assignments.push({ _id: route._id, code, route });
    (byYear[year] ||= []).push({ code, route });
  }
  return { assignments, existing: routes.length - pending.length, byYear, problems };
}

const label = (route) => `${new Date(route.date).toISOString().slice(0, 10)} · ${route.zone ?? "sin zona"} · ${route.status} · Ruta ${route.number ?? "?"}`;

export async function assignRouteCodes(db, { dryRun = true, log = console.log } = {}) {
  const col = db.collection(COLLECTION);
  const routes = await col.find({}, { projection: { code: 1, number: 1, zone: 1, status: 1, date: 1, createdAt: 1 } }).toArray();
  const { assignments, existing, byYear, problems } = planRouteCodes(routes);

  log(`Rutas en la base: ${routes.length} · con código: ${existing} · sin código: ${assignments.length}`);
  for (const [year, list] of Object.entries(byYear)) {
    log(`\n${year}: ${list.length} ruta(s) recibirían ${list[0].code} … ${list.at(-1).code}`);
    const sample = list.length <= 6 ? list : [...list.slice(0, 3), null, ...list.slice(-3)];
    for (const item of sample) log(item ? `  ${item.code}  ←  ${label(item.route)}` : "  …");
  }

  const indexes = await col.indexes().catch(() => []);
  const codeIndex = indexes.find((i) => i.key?.code === 1);
  log(`\nÍndice único de code: ${codeIndex ? (codeIndex.unique ? `existe (${codeIndex.name}${codeIndex.sparse ? ", sparse" : ""})` : `existe pero NO es único (${codeIndex.name})`) : "no existe todavía"}`);
  const legacy = indexes.find((i) => i.name === "date_1_number_1");
  if (legacy) log("Índice obsoleto date_1_number_1: existe; el backend lo elimina al arrancar (database.js) y debe quitarse antes de crear la segunda ruta de un mismo día.");

  const all = [...routes.filter((r) => r.code).map((r) => r.code), ...assignments.map((a) => a.code)];
  const duplicates = all.filter((c, i) => all.indexOf(c) !== i);
  if (duplicates.length) problems.push(`códigos duplicados: ${[...new Set(duplicates)].join(", ")}`);
  if (problems.length) throw new Error(`No se asigna nada:\n- ${problems.join("\n- ")}`);
  log(`✔ Sin duplicados: ${all.length} códigos distintos entre existentes y nuevos.`);

  const result = { total: routes.length, existing, assigned: assignments.length, byYear: Object.fromEntries(Object.entries(byYear).map(([y, l]) => [y, l.length])), backupDir: null };
  if (dryRun) {
    log("\nDry-run terminado: no se escribió nada en la base.");
    return result;
  }
  if (!assignments.length && codeIndex?.unique) {
    log("\nNada que asignar y el índice ya existe.");
    return result;
  }

  if (assignments.length) {
    log("\nRespaldando la colección routes…");
    const dir = await backupCollections(db, [COLLECTION], { prefix: "pre-route-codes" });
    result.backupDir = dir;
    log(`✔ Respaldo en ${path.relative(BACKEND_DIR, dir)}`);
    // Solo `code`, y solo si la ruta sigue sin código (así no pisa nada).
    const ops = assignments.map((a) => ({ updateOne: { filter: { _id: a._id, code: { $exists: false } }, update: { $set: { code: a.code } } } }));
    const written = await col.bulkWrite(ops, { ordered: true });
    if (written.modifiedCount !== assignments.length) throw new Error(`Se esperaba modificar ${assignments.length} rutas y se modificaron ${written.modifiedCount}`);
    log(`✔ ${written.modifiedCount} rutas con código nuevo.`);
  }
  if (!codeIndex?.unique) {
    await col.createIndex({ code: 1 }, { unique: true, sparse: true });
    log("✔ Índice único (sparse) de code creado.");
  }

  const stillMissing = await col.countDocuments({ $or: [{ code: { $exists: false } }, { code: null }, { code: "" }] });
  const dup = await col.aggregate([{ $group: { _id: "$code", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray();
  log(stillMissing === 0 && dup.length === 0 ? "✔ Todas las rutas tienen código y no hay códigos repetidos." : `✖ Quedan ${stillMissing} rutas sin código y ${dup.length} códigos repetidos.`);
  return result;
}

async function main() {
  const run = process.argv.includes("--run");
  const { config } = await import(pathToFileURL(path.join(BACKEND_DIR, "config.js")).href);
  if (!config.db.URI) throw new Error("Falta DB_URI en el .env de Web/private/backend");
  console.log(run ? "MODO --run: se respalda y se asignan los códigos." : "MODO --dry-run: no se escribe nada en la base.");
  const client = new MongoClient(config.db.URI);
  await client.connect();
  try {
    await assignRouteCodes(client.db(), { dryRun: !run });
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

