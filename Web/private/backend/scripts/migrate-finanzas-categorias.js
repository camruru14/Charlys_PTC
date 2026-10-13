/*
  Migración: categorías de gasto de Finanzas y método de pago de las ventas.

  Las categorías de gasto dejan de estar escritas en el código y pasan a la
  colección "expensecategories" (ver src/models/ExpenseCategory.js), con el
  nombre único sin distinguir mayúsculas (índice con collation
  { locale: "es", strength: 2 }). Este script deja la base coherente con eso.

  Uso (desde Web/private/backend, donde está el .env):
    node scripts/migrate-finanzas-categorias.js            # MODO PRUEBA: solo lee e imprime
    node scripts/migrate-finanzas-categorias.js --apply    # aplica los cambios

  Pasos:
    A) Lee los valores distintos de `category` de las transacciones de gasto.
    B) Crea las categorías por defecto que no existan (Materia Prima, Planilla,
       Logística, Servicios, Mantenimiento y Otros), con el nombre EXACTO que
       ya usa la base si coincide (sin distinguir mayúsculas), sin presupuesto.
    C) Crea una categoría (ícono tag, color gray) por cada otro nombre de gasto
       encontrado que no sea «Ventas» ni «Otros ingresos», y las lista.
       Si un mismo nombre aparece escrito de varias formas (mayúsculas o
       espacios), se unifica con la forma más usada y se reescriben los gastos.
    D) Los gastos sin categoría (o con la categoría vacía) pasan a «Otros». Se
       listan con su referencia.
    E) Las ventas de la tienda (con relatedOrder u orderNumber) sin
       paymentMethod reciben "Wompi".
    F) Crea el índice único de name de expensecategories (la misma
       especificación que el modelo).
    G) Imprime un resumen.
  Los pasos B a E van en una transacción; F después, solo si salió bien.
  Es idempotente: una segunda corrida no cambia nada.

  No se importa database.js y se desactivan autoIndex y autoCreate de
  mongoose ANTES de cargar los modelos: en modo prueba el script no escribe
  nada.
*/
import mongoose from "mongoose";
import { config } from "../config.js";

mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const { default: expenseCategoryModel, NAME_COLLATION, RESERVED_NAMES, normalizeName } = await import("../src/models/ExpenseCategory.js");
const { default: transactionModel } = await import("../src/models/Transaction.js");

const APPLY = process.argv.includes("--apply");
const EXAMPLES = 8;

// Categorías por defecto, en este orden.
const DEFAULTS = [
  { name: "Materia Prima", icon: "box", color: "amber" },
  { name: "Planilla", icon: "people", color: "blue" },
  { name: "Logística", icon: "truck", color: "teal" },
  { name: "Servicios", icon: "bolt", color: "purple" },
  { name: "Mantenimiento", icon: "wrench", color: "rose" },
  { name: "Otros", icon: "tag", color: "gray" },
];
const FALLBACK = "Otros";

// --- Utilidades ----------------------------------------------------------------

const keyOf = (value) => normalizeName(value).toLocaleLowerCase("es");
const out = (line = "") => console.log(line);
const title = (text) => out(`\n=== ${text} ===`);
const q = (text) => `«${text}»`;
const examples = (list, format) => list.slice(0, EXAMPLES).forEach((item) => out(`    · ${format(item)}`));
const more = (list) => (list.length > EXAMPLES ? out(`    … y ${list.length - EXAMPLES} más`) : null);

const reservedKeys = new Set(RESERVED_NAMES.map(keyOf));

const SALE_FILTER = {
  $or: [{ relatedOrder: { $exists: true, $ne: null } }, { orderNumber: { $exists: true, $nin: [null, ""] } }],
  paymentMethod: { $in: [null, ""] },
};

const summary = { created: 0, renamedVariants: 0, movedToOther: 0, sales: 0, index: "—" };

// --- Programa ------------------------------------------------------------------

async function main() {
  out(APPLY ? "MODO APLICAR (--apply): se escribirán cambios en la base." : "MODO PRUEBA: solo lectura; no se escribe nada. Usa --apply para aplicar.");

  await mongoose.connect(config.db.URI);
  const db = mongoose.connection.db;
  const transactions = db.collection(transactionModel.collection.name);
  const categories = db.collection(expenseCategoryModel.collection.name);

  // ---- A) Lectura --------------------------------------------------------------
  title("A) Categorías usadas por los gastos");
  const usedRows = await transactions.aggregate([{ $match: { type: "Gasto" } }, { $group: { _id: "$category", n: { $sum: 1 } } }]).toArray();
  const blankDocs = await transactions
    .find({ type: "Gasto", $or: [{ category: { $exists: false } }, { category: null }, { category: { $regex: /^\s*$/ } }] }, { projection: { reference: 1, concept: 1 } })
    .sort({ reference: 1 })
    .toArray();
  const used = usedRows.filter((r) => typeof r._id === "string" && r._id.trim());
  const existing = await categories.find({}).toArray();
  out(`  Gastos: ${usedRows.reduce((s, r) => s + r.n, 0)} · nombres de categoría distintos: ${used.length} · sin categoría: ${blankDocs.length}`);
  used.sort((a, b) => b.n - a.n).forEach((r) => out(`    · ${q(r._id)} (${r.n})`));
  out(`  Categorías ya creadas en expensecategories: ${existing.length}${existing.length ? ` (${existing.map((c) => c.name).join(", ")})` : ""}`);

  // Agrupa por nombre sin distinguir mayúsculas ni espacios.
  const groups = new Map(); // key -> [{ raw, n }]
  for (const r of used) {
    const key = keyOf(r._id);
    groups.set(key, [...(groups.get(key) || []), { raw: r._id, n: r.n }]);
  }
  // Las categorías que ya existen mandan sobre cualquier variante.
  const existingByKey = new Map(existing.map((c) => [keyOf(c.name), c]));
  const canonicalOf = (key, variants) => {
    if (existingByKey.has(key)) return existingByKey.get(key).name;
    const best = [...variants].sort((a, b) => b.n - a.n || a.raw.localeCompare(b.raw, "es"))[0];
    return normalizeName(best.raw);
  };

  // ---- B) Categorías por defecto -----------------------------------------------
  title("B) Categorías por defecto que faltan");
  const toCreate = []; // { name, icon, color, order }
  const taken = new Set(existingByKey.keys());
  DEFAULTS.forEach((d, index) => {
    const key = keyOf(d.name);
    if (taken.has(key)) return;
    taken.add(key);
    // Si la base ya usa ese nombre con otras mayúsculas, se conserva el de la base.
    const name = groups.has(key) ? canonicalOf(key, groups.get(key)) : d.name;
    toCreate.push({ name, icon: d.icon, color: d.color, order: index });
  });
  out(`  Se crearían: ${toCreate.length}`);
  toCreate.forEach((c) => out(`    · ${q(c.name)} · ${c.icon} · ${c.color} · orden ${c.order}`));
  summary.created += toCreate.length;

  // ---- C) Otras categorías encontradas -----------------------------------------
  title("C) Otras categorías de gasto encontradas");
  const defaultKeys = new Set(DEFAULTS.map((d) => keyOf(d.name)));
  const extras = [];
  const skipped = []; // nombres reservados usados por algún gasto
  let nextOrder = Math.max(DEFAULTS.length - 1, ...existing.map((c) => (typeof c.order === "number" ? c.order : -1))) + 1;
  for (const [key, variants] of [...groups].sort((a, b) => canonicalOf(a[0], a[1]).localeCompare(canonicalOf(b[0], b[1]), "es"))) {
    if (reservedKeys.has(key)) {
      skipped.push(...variants);
      continue;
    }
    if (defaultKeys.has(key) || existingByKey.has(key)) continue;
    const name = canonicalOf(key, variants);
    extras.push({ name, icon: "tag", color: "gray", order: nextOrder++, n: variants.reduce((s, v) => s + v.n, 0) });
  }
  out(`  Se crearían: ${extras.length}`);
  extras.forEach((c) => out(`    · ${q(c.name)} (${c.n} gasto(s)) · tag · gray · orden ${c.order}`));
  if (skipped.length) {
    out(`  AVISO: gastos con una categoría reservada (no se crea como categoría ni se cambia): ${skipped.map((s) => `${q(s.raw)} (${s.n})`).join(", ")}`);
  }
  summary.created += extras.length;
  const allToCreate = [...toCreate, ...extras];

  // Variantes que se unifican: gastos cuyo nombre exacto difiere del canónico.
  const rewrites = []; // { from, to, n }
  for (const [key, variants] of groups) {
    if (reservedKeys.has(key)) continue;
    const canonical = existingByKey.has(key) ? existingByKey.get(key).name : allToCreate.find((c) => keyOf(c.name) === key)?.name;
    if (!canonical) continue;
    for (const v of variants) if (v.raw !== canonical) rewrites.push({ from: v.raw, to: canonical, n: v.n });
  }
  title("C2) Nombres escritos de varias formas (se unifican)");
  out(`  Valores a reescribir: ${rewrites.length}`);
  examples(rewrites, (r) => `${q(r.from)} -> ${q(r.to)} (${r.n})`);
  more(rewrites);
  summary.renamedVariants = rewrites.reduce((s, r) => s + r.n, 0);

  // ---- D) Gastos sin categoría -------------------------------------------------
  title(`D) Gastos sin categoría -> ${q(FALLBACK)}`);
  const fallbackKey = keyOf(FALLBACK);
  const fallbackName = existingByKey.has(fallbackKey) ? existingByKey.get(fallbackKey).name : allToCreate.find((c) => keyOf(c.name) === fallbackKey)?.name || FALLBACK;
  out(`  Gastos que pasan a ${q(fallbackName)}: ${blankDocs.length}`);
  examples(blankDocs, (t) => `${t.reference} · ${t.concept || "—"}`);
  more(blankDocs);
  summary.movedToOther = blankDocs.length;

  // ---- E) Método de pago de las ventas -----------------------------------------
  title('E) Ventas de la tienda sin método de pago -> "Wompi"');
  const sales = await transactions.find(SALE_FILTER, { projection: { reference: 1, orderNumber: 1 } }).sort({ reference: 1 }).toArray();
  out(`  Ventas a actualizar: ${sales.length}`);
  examples(sales, (t) => `${t.reference}${t.orderNumber ? ` · pedido ${t.orderNumber}` : ""}`);
  more(sales);
  summary.sales = sales.length;

  // ---- F) Índice ---------------------------------------------------------------
  title("F) Índice único de expensecategories.name");
  const [indexKeys, indexOptions] = expenseCategoryModel.schema.indexes().find(([keys]) => Object.keys(keys).length === 1 && keys.name === 1);
  const sameCollation = (c) => c && c.locale === NAME_COLLATION.locale && c.strength === NAME_COLLATION.strength;
  const existingIndexes = await categories.indexes().catch(() => []);
  const indexOk = existingIndexes.find((i) => Object.keys(i.key).length === 1 && i.key.name === 1 && i.unique && sameCollation(i.collation));
  const indexOther = existingIndexes.find((i) => Object.keys(i.key).length === 1 && i.key.name === 1 && i !== indexOk);
  summary.index = indexOk
    ? `ya existe (${indexOk.name}); no se hace nada`
    : indexOther
      ? `CONFLICTO: ya existe un índice ${indexOther.name} sobre name con otra especificación; no se toca`
      : "se crearía";
  out(`  Especificación: ${JSON.stringify(indexKeys)} ${JSON.stringify(indexOptions)}`);
  out(`  Estado: ${summary.index}`);

  // ---- Aplicar -----------------------------------------------------------------
  const pending = allToCreate.length + rewrites.length + blankDocs.length + sales.length;
  if (!APPLY) {
    printSummary(pending, indexOk);
    return 0;
  }

  title("APLICANDO");
  if (pending) {
    const session = await mongoose.connection.startSession();
    try {
      await session.withTransaction(async () => {
        if (allToCreate.length) {
          const now = new Date();
          await categories.insertMany(
            allToCreate.map((c) => ({ name: c.name, icon: c.icon, color: c.color, archived: false, order: c.order, budgets: [], createdAt: now, updatedAt: now, __v: 0 })),
            { session },
          );
        }
        for (const r of rewrites) await transactions.updateMany({ type: "Gasto", category: r.from }, { $set: { category: r.to } }, { session });
        if (blankDocs.length) {
          await transactions.updateMany(
            { _id: { $in: blankDocs.map((t) => t._id) } },
            { $set: { category: fallbackName } },
            { session },
          );
        }
        if (sales.length) await transactions.updateMany({ _id: { $in: sales.map((t) => t._id) } }, { $set: { paymentMethod: "Wompi" } }, { session });
      });
      out("  Transacción confirmada (pasos B a E).");
    } finally {
      await session.endSession();
    }
  } else {
    out("  Pasos B a E: nada que cambiar.");
  }

  // F solo si lo anterior salió bien (si la transacción falló, se lanzó antes).
  if (!indexOk && !indexOther) {
    await categories.createIndex(indexKeys, indexOptions);
    summary.index = "creado";
    out("  Índice único de name creado.");
  }
  printSummary(pending, indexOk);
  return 0;
}

function printSummary(pending, indexOk) {
  title(`G) RESUMEN (${APPLY ? "aplicado" : "modo prueba, no se cambió nada"})`);
  out(`  Categorías creadas ........................ ${summary.created}`);
  out(`  Gastos con el nombre de categoría unificado  ${summary.renamedVariants}`);
  out(`  Gastos movidos a «Otros» .................. ${summary.movedToOther}`);
  out(`  Ventas con método de pago «Wompi» ......... ${summary.sales}`);
  out(`  Índice único de name ...................... ${summary.index}`);
  if (!APPLY) {
    out(
      pending || !indexOk
        ? "\nHAY cambios por aplicar. Para aplicarlos: node scripts/migrate-finanzas-categorias.js --apply"
        : "\nNo hay nada que cambiar: la base ya está migrada.",
    );
  }
}

let code = 0;
try {
  code = await main();
} catch (error) {
  console.error(`\nERROR: ${error.message}`);
  if (APPLY) console.error("Si falló la transacción no se cambió ningún dato (pasos B a E); F no se ejecutó.");
  code = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
process.exit(code);
