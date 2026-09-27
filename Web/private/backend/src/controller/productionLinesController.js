const productionLinesController = {};

import productionLineModel from "../models/ProductionLine.js";
import productionBatchModel from "../models/ProductionBatch.js";

// Líneas con las que arranca el sistema (las que antes estaban fijas en el
// panel, en lib/batchFlow.js).
const DEFAULT_LINES = ["Línea 1", "Línea 2", "Línea 3", "Línea 4"];

const sortByName = (a, b) => a.name.localeCompare(b.name, "es", { numeric: true });

// Primera lectura con la colección vacía: se crean las líneas por defecto más
// las que ya usan los lotes existentes. Como no se permite eliminar la última
// línea, la colección solo está vacía antes de este primer uso.
async function seedIfEmpty() {
  if (await productionLineModel.exists({})) return;
  const used = await productionBatchModel.distinct("productionLine");
  const names = [...new Set([...DEFAULT_LINES, ...used.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim())])];
  await productionLineModel.insertMany(names.map((name) => ({ name })), { ordered: false }).catch((error) => {
    // Dos lecturas a la vez: la otra ya las creó (índice único).
    if (error.code !== 11000) throw error;
  });
}

// Lotes en proceso ahora mismo por línea: { "Línea 1": 2, … }.
async function inProcessByLine() {
  const rows = await productionBatchModel.aggregate([
    { $match: { status: "En Proceso", productionLine: { $nin: [null, ""] } } },
    { $group: { _id: "$productionLine", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

// SELECT - todas las líneas, con cuántos lotes tiene en proceso cada una.
productionLinesController.getLines = async (req, res) => {
  try {
    await seedIfEmpty();
    const [lines, busy] = await Promise.all([productionLineModel.find(), inProcessByLine()]);
    res.json(
      lines
        .map((l) => ({ _id: l._id, name: l.name, active: l.active, inProcess: busy.get(l.name) || 0 }))
        .sort(sortByName),
    );
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// INSERT { name }
productionLinesController.insertLine = async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ message: "Escribe el nombre de la línea" });

  try {
    const line = await productionLineModel.create({ name });
    res.status(201).json(line);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: `Ya existe la línea «${name}»` });
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// PATCH /:id { name?, active? }. Al renombrar, los lotes que guardan el nombre
// viejo como texto (ProductionBatch.productionLine) pasan al nuevo, para que
// su historial y las estadísticas por línea sigan juntos.
productionLinesController.updateLine = async (req, res) => {
  const { active } = req.body;
  const name = typeof req.body.name === "string" ? req.body.name.trim() : undefined;
  if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ message: "Indica si la línea está activa" });
  if (name !== undefined && !name) return res.status(400).json({ message: "Escribe el nombre de la línea" });
  if (active === undefined && name === undefined) return res.status(400).json({ message: "No hay cambios que guardar" });

  try {
    const line = await productionLineModel.findById(req.params.id);
    if (!line) return res.status(404).json({ message: "Línea no encontrada" });
    if (active === false && line.active) {
      const activeCount = await productionLineModel.countDocuments({ active: true });
      if (activeCount <= 1) return res.status(409).json({ message: "Debe quedar al menos una línea activa para iniciar lotes" });
    }

    const previousName = line.name;
    if (name !== undefined) line.name = name;
    if (active !== undefined) line.active = active;
    await line.save();
    if (name !== undefined && name !== previousName) {
      await productionBatchModel.updateMany({ productionLine: previousName }, { $set: { productionLine: name } });
    }
    res.json(line);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: `Ya existe la línea «${name}»` });
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// Eliminar. No se permite si la línea tiene un lote en proceso ahora mismo,
// ni si es la última línea activa.
productionLinesController.deleteLine = async (req, res) => {
  try {
    const line = await productionLineModel.findById(req.params.id);
    if (!line) return res.status(404).json({ message: "Línea no encontrada" });

    const inProcess = await productionBatchModel.countDocuments({ productionLine: line.name, status: "En Proceso" });
    if (inProcess > 0) {
      return res.status(409).json({
        message: `No se puede eliminar «${line.name}»: tiene ${inProcess} ${inProcess === 1 ? "lote en proceso" : "lotes en proceso"}. Complétalos o detenlos primero.`,
      });
    }
    if (line.active && (await productionLineModel.countDocuments({ active: true })) <= 1) {
      return res.status(409).json({ message: `No se puede eliminar «${line.name}»: es la única línea activa` });
    }

    await line.deleteOne();
    res.json({ message: "Line deleted" });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default productionLinesController;
