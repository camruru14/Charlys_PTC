// Códigos para las rutas viejas (R-AAAA-NNNN).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   npm run migrate:route-codes -- --dry-run   (solo muestra lo que haría)
//   npm run migrate:route-codes
//
// Las rutas creadas antes del código único no lo tienen y se muestran como
// «Ruta N» (el número se reiniciaba cada día y repetía). Este script les asigna
// un código en orden cronológico (createdAt; si faltara, la fecha de la ruta y
// su número), con el año de su creación y continuando el consecutivo de cada año
// después del último código que ya exista. Es idempotente: las rutas que ya
// tienen código no se tocan. También elimina el índice único obsoleto
// (date, number), que impediría crear dos rutas el mismo día.
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import routeModel from "../src/models/Route.js";
import { localDayKey } from "../src/lib/routes.js";
import { ensureRouteIndexes } from "../src/lib/routeIndexes.js";

const created = (route) => new Date(route.createdAt || route.date).getTime();

export async function migrateRouteCodes({ dryRun = false, log = console.log } = {}) {
  if (!dryRun) await ensureRouteIndexes(log);

  const withCode = await routeModel.find({ code: { $exists: true, $ne: null } }).select("code");
  const lastByYear = new Map();
  for (const { code } of withCode) {
    const [, year, seq] = code.split("-");
    lastByYear.set(year, Math.max(lastByYear.get(year) || 0, Number(seq)));
  }

  const pending = (await routeModel.find({ $or: [{ code: { $exists: false } }, { code: null }, { code: "" }] })).sort(
    (a, b) => created(a) - created(b) || a.date - b.date || (a.number || 0) - (b.number || 0),
  );

  const summary = { assigned: 0, byYear: {} };
  for (const route of pending) {
    const year = localDayKey(new Date(created(route))).slice(0, 4);
    const seq = (lastByYear.get(year) || 0) + 1;
    lastByYear.set(year, seq);
    const code = `R-${year}-${String(seq).padStart(4, "0")}`;
    log(`${dryRun ? "Asignaría" : "Asigno"} ${code} a la Ruta ${route.number ?? "?"} · ${new Date(route.date).toISOString().slice(0, 10)} · ${route.zone} · ${route.status}`);
    if (!dryRun) {
      route.code = code;
      await route.save();
    }
    summary.assigned += 1;
    summary.byYear[year] = (summary.byYear[year] || 0) + 1;
  }
  return summary;
}

async function main() {
  const { config } = await import("../config.js");
  if (!config.db.URI) throw new Error("Falta DB_URI en el .env de Web/private/backend");
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(config.db.URI);
  if (dryRun) console.log("Modo --dry-run: no se escribe nada.\n");
  const summary = await migrateRouteCodes({ dryRun });
  console.log("");
  console.log(`Rutas ${dryRun ? "que recibirían código" : "con código nuevo"}: ${summary.assigned}`);
  for (const [year, n] of Object.entries(summary.byYear)) console.log(`  ${year}: ${n}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error("Error en la migración:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
