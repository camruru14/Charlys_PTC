const productsController = {};

import productModel from "../models/Product.js";
import { findSubcategoryByName } from "../lib/subcategories.js";
import { NAME_COLLATION } from "../models/Subcategory.js";
import cloudinary, { uploadProductImageBuffer } from "../lib/cloudinary.js";

/*
  Administración del catálogo de la tienda pública (pages/Catalogo.jsx del
  panel). Antes vivía en public/backend; se movió aquí para que el Catálogo
  funcione aunque la tienda no esté corriendo. Escribe en la misma colección
  "products" que public/backend lee (ver models/Product.js). Las rutas
  públicas de solo lectura (GET /products y GET /products/:slug) siguen en
  public/backend.

  El nombre de un producto es SIEMPRE el de su subcategoría (Configuración >
  Subcategorías): es el «producto» que muestra todo el sistema y la tienda. El
  panel ya no manda `name`; si llega en el cuerpo se ignora, y el backend lo
  llena con la subcategoría. Una subcategoría = un producto del catálogo. El
  slug se genera al crear y no cambia al editar (lo usan los carritos
  guardados y los enlaces de la tienda).
*/

// Genera un slug simple y legible a partir del nombre del producto.
// ej. "Pelota plástica 60 mm" -> "pelota-plastica-60-mm"
function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Errores de datos (esquema o id mal formado) -> 400 con el mensaje; el resto, 500.
function sendError(res, error) {
  console.log("error " + error);
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  res.status(500).json({ message: "Error interno del servidor." });
}

const CATEGORIES = ["Pelotas", "Pajillas"];
const sameName = (a, b) => String(a ?? "").trim().toLocaleLowerCase("es") === String(b ?? "").trim().toLocaleLowerCase("es");

// La subcategoría es obligatoria al crear o editar desde el panel: debe
// existir, estar activa (o ser la que el producto ya tenía) y pertenecer a la
// categoría del producto. Devuelve { name } con el nombre tal como está
// guardado en Configuración, o { error } con el mensaje para el 400.
async function resolveSubcategory(category, subcategory, current) {
  if (!CATEGORIES.includes(category)) return { error: "Categoría no válida." };
  const wanted = typeof subcategory === "string" ? subcategory.trim() : "";
  if (!wanted) return { error: "Elige una subcategoría." };

  const sub = await findSubcategoryByName(wanted);
  if (!sub) return { error: `La subcategoría «${wanted}» no existe.` };
  if (!sub.active && !sameName(sub.name, current)) return { error: `La subcategoría «${sub.name}» está inactiva.` };
  if (sub.category !== category) {
    return { error: `La subcategoría «${sub.name}» pertenece a «${sub.category}», no a «${category}».` };
  }
  return { name: sub.name };
}

// ¿Otro producto del catálogo ya usa esta subcategoría? (sin distinguir
// mayúsculas, como el nombre de la subcategoría). `exceptId`: el propio producto.
const subcategoryTaken = (name, exceptId) =>
  productModel.exists({ subcategory: name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).collation(NAME_COLLATION);
const takenMessage = (name) => `La subcategoría «${name}» ya tiene un producto en el catálogo.`;

// GET /api/products/admin/all
// A diferencia del catálogo público, no filtra por `active`: la pantalla de
// administración necesita ver también los productos desactivados para poder
// reactivarlos.
productsController.getAllProductsAdmin = async (_req, res) => {
  try {
    const products = await productModel.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/products
productsController.createProduct = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      description,
      price,
      compareAtPrice,
      colors,
      sizes,
      minOrderQuantity,
      stock,
      featured,
      active,
    } = req.body;

    if (!category || !subcategory || price === undefined) {
      return res
        .status(400)
        .json({ message: "category, subcategory y price son obligatorios." });
    }

    const resolved = await resolveSubcategory(category, subcategory);
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    if (await subcategoryTaken(resolved.name)) return res.status(409).json({ message: takenMessage(resolved.name) });

    // El nombre del producto es el de su subcategoría (se ignora el del cuerpo).
    const name = resolved.name;
    let slug = slugify(name);
    // Evitar colisiones de slug
    const existing = await productModel.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const newProduct = new productModel({
      name,
      slug,
      category,
      subcategory: resolved.name,
      description,
      price,
      compareAtPrice,
      colors: colors || [],
      sizes: sizes || [],
      minOrderQuantity,
      stock,
      featured: !!featured,
      active: active === undefined ? true : !!active,
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/products/:id
productsController.updateProduct = async (req, res) => {
  try {
    const existing = await productModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    // Lo que no venga en el cuerpo se toma del producto guardado: un producto
    // anterior a las subcategorías no se puede editar sin asignarle una.
    const resolved = await resolveSubcategory(
      req.body.category ?? existing.category,
      req.body.subcategory ?? existing.subcategory,
      existing.subcategory,
    );
    if (resolved.error) return res.status(400).json({ message: resolved.error });

    // Una subcategoría = un producto: solo se comprueba al cambiarla (un
    // producto que ya la tenía no se bloquea por datos anteriores).
    if (!sameName(resolved.name, existing.subcategory) && (await subcategoryTaken(resolved.name, existing._id))) {
      return res.status(409).json({ message: takenMessage(resolved.name) });
    }

    // El nombre siempre es el de la subcategoría y el slug no cambia: se
    // ignoran `name` y `slug` del cuerpo.
    const { name: _name, slug: _slug, ...fields } = req.body;
    const updated = await productModel.findByIdAndUpdate(
      req.params.id,
      { ...fields, subcategory: resolved.name, name: resolved.name },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    res.json(updated);
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/products/:id
productsController.deleteProduct = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    // Borrar también las imágenes en Cloudinary
    await Promise.all(
      product.images.map((img) =>
        cloudinary.uploader.destroy(img.publicId).catch(() => null),
      ),
    );

    await product.deleteOne();
    res.json({ message: "Producto eliminado." });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/products/:id/images  (multipart/form-data, campo "images", hasta 6)
productsController.addImages = async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ message: "Selecciona al menos una imagen." });

  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    // Si una falla, se borran las que sí subieron para no dejar huérfanas.
    const results = await Promise.allSettled(files.map((file) => uploadProductImageBuffer(file.buffer)));
    const uploaded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) {
      await Promise.all(uploaded.map((img) => cloudinary.uploader.destroy(img.public_id).catch(() => null)));
      throw failed.reason;
    }

    product.images.push(...uploaded.map((img) => ({ url: img.secure_url, publicId: img.public_id })));
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: error.message || "No se pudieron subir las imágenes." });
  }
};

// DELETE /api/products/:id/images/:publicId
productsController.removeImage = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId).catch(() => null);
    product.images = product.images.filter((img) => img.publicId !== publicId);
    await product.save();

    res.json(product);
  } catch (error) {
    sendError(res, error);
  }
};

export default productsController;
