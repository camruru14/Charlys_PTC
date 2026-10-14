/*
  Restaura un respaldo hecho por reset-and-seed.js (EJSON canónico, un documento por línea).

  Uso (desde Web/private/backend):
    CONFIRM_RESTORE=RESTAURAR node scripts/restore-backup.js scripts/backups/<carpeta>
    (PowerShell: $env:CONFIRM_RESTORE="RESTAURAR"; node scripts/restore-backup.js scripts/backups/<carpeta>)

  Por cada colección del respaldo hace deleteMany({}) y vuelve a insertar sus documentos (con sus _id,
  fechas y ObjectId originales), todo en UNA transacción: o se restaura todo o no cambia nada. Se
  conservan los índices. Exige que la base conectada se llame igual que la del respaldo. No imprime la
  URI ni valores del .env.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

// El .env se carga por ruta absoluta antes de importar config.js: funciona desde cualquier carpeta.
const ENV_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
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

const out = (line = "") => console.log(line);
const safe = (error) => String(error?.message || error).replace(/mongodb(\+srv)?:\/\/\S+/gi, "<URI>");
const folder = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (!folder) {
  out("Uso: CONFIRM_RESTORE=RESTAURAR node scripts/restore-backup.js scripts/backups/<carpeta>");
  process.exit(0);
}
if (process.env.CONFIRM_RESTORE !== "RESTAURAR") {
  out("No se hizo nada: falta la variable CONFIRM_RESTORE=RESTAURAR.");
  process.exit(1);
}
const dir = path.resolve(folder);
const metaFile = path.join(dir, "_meta.json");
if (!fs.existsSync(metaFile)) {
  out(`No se hizo nada: ${folder} no parece un respaldo (falta _meta.json).`);
  process.exit(1);
}

const { EJSON } = mongoose.mongo.BSON;
const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));

try {
  // Lee y valida TODO el respaldo antes de tocar la base.
  const data = {};
  for (const [name, expected] of Object.entries(meta.collections)) {
    const lines = fs.readFileSync(path.join(dir, `${name}.json`), "utf8").split("\n").filter(Boolean);
    if (lines.length !== expected) throw new Error(`${name}: el archivo tiene ${lines.length} documentos y el respaldo registró ${expected}.`);
    data[name] = lines.map((line) => EJSON.parse(line, { relaxed: false }));
  }

  await mongoose.connect(config.db.URI, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== meta.database) throw new Error(`El respaldo es de la base «${meta.database}» y estás conectado a «${db.databaseName}». Abortado.`);
  out(`Restaurando ${Object.keys(data).length} colecciones en la base ${db.databaseName} desde ${folder}…`);

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const session = await mongoose.startSession();
  const report = {};
  try {
    await session.withTransaction(async () => {
      for (const [name, docs] of Object.entries(data)) {
        if (existing.has(name)) await db.collection(name).deleteMany({}, { session });
        for (let i = 0; i < docs.length; i += 500) await db.collection(name).insertMany(docs.slice(i, i + 500), { session, ordered: true });
        report[name] = docs.length;
      }
    });
  } finally {
    await session.endSession();
  }
  for (const [name, count] of Object.entries(report)) {
    const now = await db.collection(name).countDocuments();
    out(`  ${name.padEnd(34)}${String(count).padStart(7)} restaurados · ahora hay ${now}${now === count ? "" : "  ← NO COINCIDE"}`);
  }
  out("Restauración terminada.");
} catch (error) {
  out(`ERROR: ${safe(error)}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => null);
}
