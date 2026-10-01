const subcategoriesController = {};

import subcategoryModel, { SUBCATEGORY_CATEGORIES } from "../models/Subcategory.js";
import { isNameInUse, usedNameKeys } from "../lib/subcategories.js";

const IN_USE_MESSAGE = "No se puede eliminar: la subcategoría ya se usa en registros. Puedes desactivarla.";
const IN_USE_EDIT_MESSAGE = "No se puede cambiar el nombre ni la categoría: la subcategoría ya se usa en registros. Puedes desactivarla.";

const serverError = (res, error) => {
  console.log("error " + error);
  res.status(500).json({ message: "Error interno del servidor." });
};

const duplicateMessage = (name) => `Ya existe una subcategoría llamada «${name}»`;

// GET /subcategories?category=Pajillas&active=true
// Ordenada por categoría y nombre, con `inUse` calculado en bloque.
subcategoriesController.getSubcategories = async (req, res) => {
  const { category, active } = req.query;
  if (category !== undefined && !SUBCATEGORY_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Categoría no válida" });
  }

  const filter = {};
  if (category) filter.category = category;
  if (active === "true") filter.active = true;

  try {
    const [list, used] = await Promise.all([
      subcategoryModel.find(filter).sort({ category: 1, name: 1 }).collation({ locale: "es", strength: 2 }),
      usedNameKeys(),
    ]);
    res.json(
      list.map((s) => ({
        _id: s._id,
        name: s.name,
        category: s.category,
        active: s.active,
        inUse: used.has(s.name.trim().toLocaleLowerCase("es")),
      })),
    );
  } catch (error) {
    serverError(res, error);
  }
};

// POST /subcategories { name, category }
subcategoriesController.insertSubcategory = async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const { category } = req.body;
  if (!name) return res.status(400).json({ message: "Escribe el nombre de la subcategoría" });
  if (!SUBCATEGORY_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Elige una categoría válida (Pajillas o Pelotas)" });
  }

  try {
    const created = await subcategoryModel.create({ name, category });
    res.status(201).json({ ...created.toObject(), inUse: false });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: duplicateMessage(name) });
    serverError(res, error);
  }
};

// PATCH /subcategories/:id { name?, category?, active? }
// Cambiar solo `active` siempre se permite; cambiar el nombre o la categoría
// no, si la subcategoría ya se usa en algún registro.
subcategoriesController.updateSubcategory = async (req, res) => {
  const { category, active } = req.body;
  const name = typeof req.body.name === "string" ? req.body.name.trim() : undefined;
  if (name !== undefined && !name) return res.status(400).json({ message: "Escribe el nombre de la subcategoría" });
  if (category !== undefined && !SUBCATEGORY_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Elige una categoría válida (Pajillas o Pelotas)" });
  }
  if (active !== undefined && typeof active !== "boolean") {
    return res.status(400).json({ message: "Indica si la subcategoría está activa" });
  }
  if (name === undefined && category === undefined && active === undefined) {
    return res.status(400).json({ message: "No hay cambios que guardar" });
  }

  try {
    const sub = await subcategoryModel.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subcategoría no encontrada" });

    const renames = name !== undefined && name !== sub.name;
    const recategorizes = category !== undefined && category !== sub.category;
    const inUse = renames || recategorizes ? await isNameInUse(sub.name) : false;
    if (inUse) return res.status(409).json({ message: IN_USE_EDIT_MESSAGE });

    if (renames) sub.name = name;
    if (recategorizes) sub.category = category;
    if (active !== undefined) sub.active = active;
    await sub.save();
    res.json({ ...sub.toObject(), inUse: await isNameInUse(sub.name) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: duplicateMessage(name) });
    serverError(res, error);
  }
};

// DELETE /subcategories/:id — solo si no se usa en ningún registro.
subcategoriesController.deleteSubcategory = async (req, res) => {
  try {
    const sub = await subcategoryModel.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subcategoría no encontrada" });
    if (await isNameInUse(sub.name)) return res.status(409).json({ message: IN_USE_MESSAGE });

    await sub.deleteOne();
    res.json({ message: "Subcategoría eliminada" });
  } catch (error) {
    serverError(res, error);
  }
};

export default subcategoriesController;
