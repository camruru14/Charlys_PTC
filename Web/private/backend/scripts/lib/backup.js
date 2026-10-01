// Respaldo (EJSON) de colecciones, compartido por los scripts que escriben en
// la base (reset-and-seed.js y assign-route-codes.js): cada colección se
// guarda en backups/<prefix>-AAAA-MM-DD-HHmm/<colección>.json (con su
// manifest.json), se vuelve a leer para comprobar que quedó completa y, si
// algo no cuadra, lanza un error: quien llama NO escribe nada en la base.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EJSON } from "bson";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// `prefix`: «pre-reset», «pre-route-codes»… Devuelve la carpeta del respaldo.
export async function backupCollections(db, names, { prefix }) {
  const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/El_Salvador", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .replace(" ", "-")
    .replace(":", "");
  const dir = path.join(BACKEND_DIR, "backups", `${prefix}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), collections: {} };
  for (const name of names) {
    const col = db.collection(name);
    const docs = await col.find().toArray();
    const file = path.join(dir, `${name}.json`);
    fs.writeFileSync(file, EJSON.stringify(docs, { relaxed: false }, 0));
    const back = EJSON.parse(fs.readFileSync(file, "utf8"), { relaxed: false });
    const count = await col.countDocuments();
    if (back.length !== docs.length || back.length !== count) throw new Error(`respaldo de ${name} incompleto (${back.length} de ${count})`);
    manifest.collections[name] = { documents: count, indexes: await col.indexes() };
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

export { BACKEND_DIR };
