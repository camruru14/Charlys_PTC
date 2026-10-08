/*
  Migración: retira las subcategorías y unifica los nombres de producto.

  El Catálogo (colección "products") es ahora la única fuente de productos y
  el `name` de un producto es único sin distinguir mayúsculas ni espacios
  (índice único con collation { locale: "es", strength: 2 }, ver
  src/models/Product.js). Este script ajusta la base de datos para que quede
  coherente con el código.

  Uso (desde Web/private/backend, donde está el .env):
    node scripts/migrate-remove-subcategories.js            # MODO PRUEBA: solo lee e imprime
    node scripts/migrate-remove-subcategories.js --apply    # aplica los cambios

  Pasos:
    A) Lee productos, subcategorías y los nombres usados en pedidos, lotes,
       producción diaria y Producto Terminado.
    B) Normaliza el nombre de cada producto (recorta y colapsa espacios); si
       tiene `subcategory` y su name difiere, el name pasa a ser el nombre
       exacto de la subcategoría.
    C) Si quedan dos productos con el mismo nombre (sin distinguir mayúsculas),
       los lista y ABORTA sin aplicar nada (también con --apply).
    D) Crea un producto inactivo (precio 0) por cada subcategoría sin producto.
    E) Reescribe con el nombre exacto del producto los valores de pedidos,
       lotes, producción diaria e inventario que solo difieren en mayúsculas o
       espacios. Los artículos de inventario que quedarían duplicados (mismo
       nombre + color + bodega) no se tocan: se listan como conflicto.
    F) Lista (sin modificar) los nombres usados que no corresponden a ningún
       producto (registros antiguos «Pajilla»/«Pelota»): quedan como historial.
    G) Quita el campo `subcategory` de los productos.
    H) Crea el índice único de name (la misma especificación que el modelo).
    I) Renombra "subcategories" a "subcategories_backup_AAAAMMDD" (no la borra).
  Los pasos B, D, E y G van en una transacción; H e I después, solo si salió bien.
  Es idempotente: una segunda corrida no cambia nada.

  No se importa database.js (crearía índices de rutas al conectar) y se
  desactivan autoIndex y autoCreate de mongoose ANTES de cargar los modelos:
  en modo prueba el script no escribe nada.
*/
import mongoose from "mongoose";
import { config } from "../config.js";

mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const { default: productModel, NAME_COLLATION } = await import("../src/models/Product.js");
const { default: orderModel } = await import("../src/models/Order.js");
const { default: productionBatchModel } = await import("../src/models/ProductionBatch.js");
const { default: dailyBatchModel } = await import("../src/models/DailyBatch.js");
const { default: inventoryModel } = await import("../src/models/InventoryItem.js");
const { slugify } = await import("../src/lib/slugify.js");

const APPLY = process.argv.includes("--apply");
const EXAMPLES = 5;

// --- Utilidades ----------------------------------------------------------------

const norm = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const keyOf = (value) => norm(value).toLocaleLowerCase("es");
const out = (line = "") => console.log(line);
const title = (text) => out(`\n=== ${text} ===`);
const examples = (list, format) => list.slice(0, EXAMPLES).forEach((item) => out(`    · ${format(item)}`));
const more = (list) => (list.length > EXAMPLES ? out(`    … y ${list.length - EXAMPLES} más`) : null);
const q = (text) => `«${text}»`;

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// Orders: «Nombre (talla)» -> { base, suffix }.
function splitSize(value) {
  const index = value.indexOf(" (");
  return index >= 0 ? { base: value.slice(0, index), suffix: value.slice(index) } : { base: value, suffix: "" };
}

const summary = {
  B: { renamed: 0 },
  D: { created: 0 },
  E: { orders: 0, productionBatches: 0, dailyBatches: 0, inventory: 0, inventoryConflicts: 0 },
  F: { orders: 0, productionBatches: 0, dailyBatches: 0, inventory: 0 },
  G: { unset: 0 },
  H: "—",
  I: "—",
};

// --- Programa ------------------------------------------------------------------

async function main() {
  out(APPLY ? "MODO APLICAR (--apply): se escribirán cambios en la base." : "MODO PRUEBA: solo lectura; no se escribe nada. Usa --apply para aplicar.");

  await mongoose.connect(config.db.URI);
  const db = mongoose.connection.db;
  const col = (model) => db.collection(model.collection.name);
  const products = col(productModel);
  const orders = col(orderModel);
  const productionBatches = col(productionBatchModel);
  const dailyBatches = col(dailyBatchModel);
  const inventory = col(inventoryModel);
  const subcategories = db.collection("subcategories");

  // ---- A) Lectura --------------------------------------------------------------
  title("A) Lectura");
  const productDocs = await products.find({}, { projection: { name: 1, slug: 1, category: 1, subcategory: 1, active: 1 } }).toArray();
  const subDocs = await subcategories.find({}).toArray();
  const countBy = async (collection, field, filter = {}, unwind) => {
    const pipeline = [{ $match: filter }, ...(unwind ? [{ $unwind: `$${unwind}` }] : []), { $group: { _id: `$${field}`, n: { $sum: 1 } } }];
    return (await collection.aggregate(pipeline).toArray()).filter((r) => typeof r._id === "string" && r._id.trim());
  };
  const usedOrders = await countBy(orders, "items.product", {}, "items");
  const usedProduction = await countBy(productionBatches, "product");
  const usedDaily = await countBy(dailyBatches, "product");
  const usedInventory = await countBy(inventory, "name", { category: "Producto Terminado" });
  out(`  Productos: ${productDocs.length}`);
  out(`  Subcategorías: ${subDocs.length}${subDocs.length === 0 ? " (colección vacía o ya renombrada)" : ""}`);
  out(`  Nombres distintos usados · pedidos (líneas): ${usedOrders.length} · lotes de fabricación: ${usedProduction.length} · producción diaria: ${usedDaily.length} · Producto Terminado: ${usedInventory.length}`);

  // ---- B) Nombres de productos -------------------------------------------------
  title("B) Normalizar el nombre de cada producto");
  const subByKey = new Map(subDocs.map((s) => [keyOf(s.name), s]));
  const renames = []; // { _id, from, to, reason }
  const finalName = new Map(); // _id (string) -> nombre final
  for (const p of productDocs) {
    let target = norm(p.name);
    let reason = target !== p.name ? "espacios" : null;
    if (typeof p.subcategory === "string" && p.subcategory.trim()) {
      const sub = subByKey.get(keyOf(p.subcategory));
      const subName = sub ? norm(sub.name) : norm(p.subcategory);
      if (target !== subName) {
        target = subName;
        reason = "su nombre difiere de la subcategoría";
      }
    }
    finalName.set(String(p._id), target);
    if (target !== p.name) renames.push({ _id: p._id, from: p.name, to: target, reason });
  }
  summary.B.renamed = renames.length;
  out(`  Productos que cambian de nombre: ${renames.length}`);
  examples(renames, (r) => `${q(r.from)} -> ${q(r.to)} (${r.reason})`);
  more(renames);

  // ---- C) Duplicados -----------------------------------------------------------
  title("C) Duplicados (sin distinguir mayúsculas ni espacios)");
  const groups = new Map();
  for (const p of productDocs) {
    const key = keyOf(finalName.get(String(p._id)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const duplicates = [...groups.values()].filter((g) => g.length > 1);
  if (duplicates.length) {
    out(`  CONFLICTO: ${duplicates.length} nombre(s) repetido(s) entre productos. No se aplica NADA hasta resolverlos a mano (editar o eliminar en el Catálogo):`);
    for (const g of duplicates) {
      out(`    · ${q(finalName.get(String(g[0]._id)))}:`);
      g.forEach((p) => out(`        - _id ${p._id} · name ${q(p.name)} · categoría ${p.category} · ${p.active === false ? "inactivo" : "activo"}`));
    }
    out("\nABORTADO: hay duplicados (paso C).");
    return 1;
  }
  out("  Sin duplicados.");

  // ---- D) Productos para subcategorías sin producto ----------------------------
  title("D) Productos nuevos para subcategorías sin producto");
  const takenKeys = new Set(groups.keys());
  const takenSlugs = new Set(productDocs.map((p) => p.slug).filter(Boolean));
  const creations = [];
  for (const sub of [...subDocs].sort((a, b) => String(a.name).localeCompare(String(b.name), "es"))) {
    const name = norm(sub.name);
    if (!name || takenKeys.has(keyOf(name))) continue;
    let slug = slugify(name) || "producto";
    let n = 1;
    while (takenSlugs.has(slug)) slug = `${slugify(name) || "producto"}-${(Date.now() + n++).toString(36)}`;
    takenSlugs.add(slug);
    takenKeys.add(keyOf(name));
    creations.push({ name, slug, category: sub.category, subActive: sub.active !== false });
  }
  summary.D.created = creations.length;
  out(`  Productos que se crearían (inactivos, precio 0): ${creations.length}`);
  creations.forEach((c) => out(`    · ${q(c.name)} · ${c.category} · slug ${c.slug}${c.subActive ? "" : " · (su subcategoría estaba inactiva)"}`));
  if (creations.length) out("  Después: completa su precio y fotos en el Catálogo, o elimínalos si no se usan.");

  // ---- E) Unificar nombres en los registros ------------------------------------
  title("E) Unificar nombres en pedidos, lotes, producción diaria e inventario");
  // clave del nombre -> nombre exacto del producto (existentes y por crear)
  const exactByKey = new Map();
  for (const p of productDocs) exactByKey.set(keyOf(finalName.get(String(p._id))), finalName.get(String(p._id)));
  for (const c of creations) exactByKey.set(keyOf(c.name), c.name);

  // value -> nombre exacto si coincide con un producto pero no exactamente.
  const fixValue = (value, { size = false } = {}) => {
    const whole = exactByKey.get(keyOf(value));
    if (whole !== undefined) return whole !== value ? whole : null;
    if (!size) return null;
    const { base, suffix } = splitSize(value);
    if (!suffix) return null;
    const exact = exactByKey.get(keyOf(base));
    return exact !== undefined && `${exact}${suffix}` !== value ? `${exact}${suffix}` : null;
  };
  const matches = (value, { size = false } = {}) => {
    if (exactByKey.has(keyOf(value))) return true;
    return size && splitSize(value).suffix ? exactByKey.has(keyOf(splitSize(value).base)) : false;
  };

  const plans = {}; // colección -> [{ from, to, n }]
  const planFor = (used, opts) => used.map((r) => ({ from: r._id, to: fixValue(r._id, opts), n: r.n })).filter((r) => r.to);
  plans.orders = planFor(usedOrders, { size: true });
  plans.productionBatches = planFor(usedProduction);
  plans.dailyBatches = planFor(usedDaily);

  // Inventario (Producto Terminado): por artículo, para detectar conflictos.
  const finished = await inventory.find({ category: "Producto Terminado" }, { projection: { name: 1, color: 1, location: 1, batchNumber: 1 } }).toArray();
  const stockKey = (name, item) => JSON.stringify([name, item.color || "", item.location || "", item.batchNumber || ""]);
  const candidates = [];
  const settled = new Map(); // clave final -> cantidad de artículos que ya la ocupan sin renombrarse
  for (const item of finished) {
    const to = typeof item.name === "string" ? fixValue(item.name) : null;
    if (to) candidates.push({ item, to });
    else settled.set(stockKey(item.name, item), (settled.get(stockKey(item.name, item)) || 0) + 1);
  }
  const byNewKey = new Map();
  candidates.forEach((c) => {
    const key = stockKey(c.to, c.item);
    byNewKey.set(key, [...(byNewKey.get(key) || []), c]);
  });
  const inventoryRenames = [];
  const inventoryConflicts = [];
  for (const [key, list] of byNewKey) {
    if (list.length > 1 || settled.has(key)) inventoryConflicts.push(...list.map((c) => ({ ...c, with: list.length > 1 ? "otro artículo que también se renombraría a lo mismo" : "un artículo que ya tiene ese nombre" })));
    else inventoryRenames.push(list[0]);
  }
  summary.E.inventoryConflicts = inventoryConflicts.length;
  summary.E.inventory = inventoryRenames.length;
  summary.E.orders = plans.orders.reduce((s, r) => s + r.n, 0);
  summary.E.productionBatches = plans.productionBatches.reduce((s, r) => s + r.n, 0);
  summary.E.dailyBatches = plans.dailyBatches.reduce((s, r) => s + r.n, 0);

  const printPlan = (label, list, unit) => {
    out(`  ${label}: ${list.reduce((s, r) => s + r.n, 0)} ${unit} a reescribir (${list.length} valor(es) distinto(s))`);
    examples(list, (r) => `${q(r.from)} -> ${q(r.to)} (${r.n})`);
    more(list);
  };
  printPlan("Pedidos (líneas, orders.items.product)", plans.orders, "línea(s)");
  printPlan("Lotes de fabricación (productionbatches.product)", plans.productionBatches, "lote(s)");
  printPlan("Producción diaria (dailybatches.product)", plans.dailyBatches, "registro(s)");
  out(`  Inventario (Producto Terminado): ${inventoryRenames.length} artículo(s) a renombrar`);
  examples(inventoryRenames, (c) => `${q(c.item.name)} -> ${q(c.to)} · color ${c.item.color || "—"} · bodega ${c.item.location || "—"}`);
  more(inventoryRenames);
  out(`  Inventario: ${inventoryConflicts.length} CONFLICTO(S) (no se renombran ni se fusionan; revisar a mano)`);
  inventoryConflicts.forEach((c) =>
    out(`    · _id ${c.item._id} · ${q(c.item.name)} -> ${q(c.to)} · color ${c.item.color || "—"} · bodega ${c.item.location || "—"} · chocaría con ${c.with}`),
  );

  // ---- F) Nombres sin producto -------------------------------------------------
  title("F) Nombres usados que no corresponden a ningún producto (se conservan como historial)");
  const orphans = (used, opts) => used.filter((r) => !matches(r._id, opts)).sort((a, b) => b.n - a.n);
  const orphanLists = {
    orders: orphans(usedOrders, { size: true }),
    productionBatches: orphans(usedProduction),
    dailyBatches: orphans(usedDaily),
    inventory: orphans(usedInventory),
  };
  const orphanLabels = { orders: "Pedidos (líneas)", productionBatches: "Lotes de fabricación", dailyBatches: "Producción diaria", inventory: "Producto Terminado (artículos)" };
  for (const [k, list] of Object.entries(orphanLists)) {
    summary.F[k] = list.reduce((s, r) => s + r.n, 0);
    out(`  ${orphanLabels[k]}: ${summary.F[k]} registro(s) con ${list.length} nombre(s) sin producto`);
    list.slice(0, 15).forEach((r) => out(`    · ${q(r._id)} (${r.n})`));
    if (list.length > 15) out(`    … y ${list.length - 15} más`);
  }

  // ---- G) subcategory ----------------------------------------------------------
  title("G) Quitar el campo subcategory de los productos");
  summary.G.unset = await products.countDocuments({ subcategory: { $exists: true } });
  out(`  Productos con el campo: ${summary.G.unset}`);

  // ---- H) Índice ---------------------------------------------------------------
  title("H) Índice único de products.name");
  const [indexKeys, indexOptions] = productModel.schema.indexes().find(([keys]) => Object.keys(keys).length === 1 && keys.name === 1);
  const sameCollation = (c) => c && c.locale === NAME_COLLATION.locale && c.strength === NAME_COLLATION.strength;
  const existingIndexes = await products.indexes().catch(() => []);
  const indexOk = existingIndexes.find((i) => Object.keys(i.key).length === 1 && i.key.name === 1 && i.unique && sameCollation(i.collation));
  const indexOther = existingIndexes.find((i) => Object.keys(i.key).length === 1 && i.key.name === 1 && i !== indexOk);
  if (indexOk) {
    summary.H = `ya existe (${indexOk.name}); no se hace nada`;
  } else if (indexOther) {
    summary.H = `CONFLICTO: ya existe un índice ${indexOther.name} sobre name con otra especificación; no se toca`;
  } else {
    summary.H = "se crearía";
  }
  out(`  Especificación: ${JSON.stringify(indexKeys)} ${JSON.stringify(indexOptions)}`);
  out(`  Estado: ${summary.H}`);

  // ---- I) Respaldo de subcategories -------------------------------------------
  title("I) Renombrar la colección subcategories");
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  let backupName = `subcategories_backup_${todayStamp()}`;
  for (let n = 2; collections.includes(backupName); n++) backupName = `subcategories_backup_${todayStamp()}_${n}`;
  const hasSubcategories = collections.includes("subcategories");
  summary.I = hasSubcategories ? `se renombraría a ${backupName}` : "no existe la colección; se omite";
  out(`  ${summary.I}`);

  // ---- Aplicar -----------------------------------------------------------------
  const pending =
    renames.length + creations.length + summary.E.orders + summary.E.productionBatches + summary.E.dailyBatches + inventoryRenames.length + summary.G.unset;
  if (!APPLY) {
    printSummary(pending, indexOk, hasSubcategories);
    return 0;
  }

  title("APLICANDO");
  if (pending) {
    const session = await mongoose.connection.startSession();
    try {
      await session.withTransaction(async () => {
        for (const r of renames) await products.updateOne({ _id: r._id }, { $set: { name: r.to } }, { session });
        if (creations.length) {
          const now = new Date();
          await products.insertMany(
            creations.map((c) => ({
              name: c.name,
              slug: c.slug,
              category: c.category,
              description: "",
              price: 0,
              colors: [],
              sizes: [],
              images: [],
              minOrderQuantity: 1,
              stock: 0,
              active: false,
              featured: false,
              createdAt: now,
              updatedAt: now,
              __v: 0,
            })),
            { session },
          );
        }
        for (const r of plans.orders) {
          await orders.updateMany({ "items.product": r.from }, { $set: { "items.$[el].product": r.to } }, { arrayFilters: [{ "el.product": r.from }], session });
        }
        for (const r of plans.productionBatches) await productionBatches.updateMany({ product: r.from }, { $set: { product: r.to } }, { session });
        for (const r of plans.dailyBatches) await dailyBatches.updateMany({ product: r.from }, { $set: { product: r.to } }, { session });
        for (const c of inventoryRenames) await inventory.updateOne({ _id: c.item._id }, { $set: { name: c.to } }, { session });
        await products.updateMany({ subcategory: { $exists: true } }, { $unset: { subcategory: "" } }, { session });
      });
      out("  Transacción confirmada (pasos B, D, E y G).");
    } finally {
      await session.endSession();
    }
  } else {
    out("  Pasos B, D, E y G: nada que cambiar.");
  }

  // H e I solo si lo anterior salió bien (si la transacción falló, se lanzó antes).
  if (!indexOk && !indexOther) {
    await products.createIndex(indexKeys, indexOptions);
    summary.H = "creado";
    out("  Índice único de name creado.");
  }
  if (hasSubcategories) {
    await subcategories.rename(backupName);
    summary.I = `renombrada a ${backupName}`;
    out(`  Colección subcategories renombrada a ${backupName}.`);
  }
  printSummary(pending, indexOk, hasSubcategories);
  return 0;
}

function printSummary(pending, indexOk, hasSubcategories) {
  title(`RESUMEN (${APPLY ? "aplicado" : "modo prueba, no se cambió nada"})`);
  out(`  B) Productos renombrados/normalizados .... ${summary.B.renamed}`);
  out(`  C) Duplicados ............................ 0`);
  out(`  D) Productos creados desde subcategorías . ${summary.D.created}`);
  out(`  E) Registros reescritos .................. pedidos ${summary.E.orders} · lotes ${summary.E.productionBatches} · producción diaria ${summary.E.dailyBatches} · inventario ${summary.E.inventory}`);
  out(`     Conflictos de inventario .............. ${summary.E.inventoryConflicts}`);
  out(`  F) Sin producto (historial) .............. pedidos ${summary.F.orders} · lotes ${summary.F.productionBatches} · producción diaria ${summary.F.dailyBatches} · Producto Terminado ${summary.F.inventory}`);
  out(`  G) Productos con subcategory quitado ..... ${summary.G.unset}`);
  out(`  H) Índice único de name .................. ${summary.H}`);
  out(`  I) Colección subcategories ............... ${summary.I}`);
  if (!APPLY) {
    out(
      pending || !indexOk || hasSubcategories
        ? "\nHAY cambios por aplicar. Para aplicarlos: node scripts/migrate-remove-subcategories.js --apply"
        : "\nNo hay nada que cambiar: la base ya está migrada.",
    );
  }
}

let code = 0;
try {
  code = await main();
} catch (error) {
  console.error(`\nERROR: ${error.message}`);
  if (APPLY) console.error("Si falló la transacción no se cambió ningún dato (pasos B, D, E y G); H e I no se ejecutaron.");
  code = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
process.exit(code);
