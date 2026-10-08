const productsController = {};

import productModel, { NAME_COLLATION } from "../models/Product.js";
import cloudinary, { uploadProductImageBuffer } from "../lib/cloudinary.js";
import { normalizeProductName } from "../lib/productName.js";
import { slugify } from "../lib/slugify.js";
import { isNameInUse, nameKey, usedNameKeys } from "../lib/productUsage.js";

/*
  Administración del catálogo de la tienda pública (pages/Catalogo.jsx del
  panel). Antes vivía en public/backend; se movió aquí para que el Catálogo
  funcione aunque la tienda no esté corriendo. Escribe en la misma colección
  "products" que public/backend lee (ver models/Product.js). Las rutas
  públicas de solo lectura (GET /products y GET /products/:slug) siguen en
  public/backend.

  El Catálogo es la ÚNICA fuente de productos: el `name` de un producto es el
  «producto» que se elige en Fabricación, Producción diaria e Inventario y el
  que guardan las líneas de los pedidos. Es único sin distinguir mayúsculas ni
  espacios sobrantes. Si ya se usa en pedidos, lotes o inventario
  (lib/productUsage.js) no se puede renombrar, cambiar de categoría ni
  eliminar (solo desactivar para ocultarlo de la tienda). El slug se genera al
  crear y no cambia al editar (lo usan los carritos guardados y los enlaces de
  la tienda).
*/

// Errores de datos (esquema o id mal formado) -> 400 con el mensaje; el resto, 500.
function sendError(res, error) {
  console.log("error " + error);
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  res.status(500).json({ message: "Error interno del servidor." });
}

const CATEGORIES = ["Pelotas", "Pajillas"];
const MAX_NAME_LENGTH = 60;

const duplicateMessage = (name) => `Ya existe un producto llamado «${name}»`;
const IN_USE_SUFFIX = "ya se usa en pedidos, lotes o inventario";

// Valida el nombre (ya normalizado) y la categoría. Devuelve el mensaje del
// 400 o null si están bien.
function nameAndCategoryError(name, category) {
  if (!name) return "Escribe el nombre del producto.";
  if (name.length > MAX_NAME_LENGTH) return `El nombre no puede pasar de ${MAX_NAME_LENGTH} caracteres.`;
  if (!CATEGORIES.includes(category)) return "Categoría no válida.";
  return null;
}

// ¿Otro producto ya se llama así? (sin distinguir mayúsculas). `exceptId`: el propio producto.
const nameTaken = (name, exceptId) =>
  productModel.exists({ name, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).collation(NAME_COLLATION);

// 11000 por el índice único de name (una carrera entre dos altas) -> el mismo 409.
const isDuplicateName = (error) => error?.code === 11000 && Boolean(error.keyPattern?.name);

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

// GET /api/products/names
// Los productos para los selectores y el formulario del Catálogo, ordenados
// por categoría y nombre, con `inUse` calculado en bloque. Incluye los
// inactivos: `active` solo controla la tienda.
productsController.getProductNames = async (_req, res) => {
  try {
    const [list, used] = await Promise.all([
      productModel.find().select("name category active").sort({ category: 1, name: 1 }).collation(NAME_COLLATION),
      usedNameKeys(),
    ]);
    res.json(
      list.map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        active: p.active,
        inUse: used.has(nameKey(p.name)),
      })),
    );
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/products
productsController.createProduct = async (req, res) => {
  try {
    const {
      category,
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
    const name = normalizeProductName(req.body.name);

    if (!name || !category || price === undefined) {
      return res.status(400).json({ message: "name, category y price son obligatorios." });
    }
    const invalid = nameAndCategoryError(name, category);
    if (invalid) return res.status(400).json({ message: invalid });
    if (await nameTaken(name)) return res.status(409).json({ message: duplicateMessage(name) });

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
    if (isDuplicateName(error)) return res.status(409).json({ message: duplicateMessage(normalizeProductName(req.body?.name)) });
    sendError(res, error);
  }
};

// PUT /api/products/:id
// El nombre y la categoría solo cambian si el producto no se usa en pedidos,
// lotes ni inventario; el resto de los campos siempre se edita.
productsController.updateProduct = async (req, res) => {
  try {
    const existing = await productModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const requested = req.body.name === undefined ? existing.name : normalizeProductName(req.body.name);
    const category = req.body.category ?? existing.category;
    // Renombrar = pedir otro nombre; si solo cambian los espacios sobrantes del
    // nombre guardado, no cuenta y el nombre guardado se conserva tal cual.
    const renames = requested !== normalizeProductName(existing.name);
    const name = renames ? requested : existing.name;
    const recategorizes = category !== existing.category;

    if (renames || recategorizes) {
      const invalid = nameAndCategoryError(name, category);
      if (invalid) return res.status(400).json({ message: invalid });
      if (await isNameInUse(existing.name)) {
        return res.status(409).json({
          message: `No se puede cambiar el nombre ni la categoría de «${existing.name}»: ${IN_USE_SUFFIX}.`,
        });
      }
      if (renames && (await nameTaken(name, existing._id))) {
        return res.status(409).json({ message: duplicateMessage(name) });
      }
    }

    // El slug no cambia y `subcategory` ya no existe: se ignoran los del cuerpo.
    const { name: _name, category: _category, slug: _slug, subcategory: _subcategory, ...fields } = req.body;
    const updated = await productModel.findByIdAndUpdate(
      req.params.id,
      { ...fields, name, category },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    res.json(updated);
  } catch (error) {
    if (isDuplicateName(error)) return res.status(409).json({ message: duplicateMessage(normalizeProductName(req.body?.name)) });
    sendError(res, error);
  }
};

// DELETE /api/products/:id
// No se elimina si su nombre ya se usa en pedidos, lotes o inventario.
productsController.deleteProduct = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    if (await isNameInUse(product.name)) {
      return res.status(409).json({
        message: `No se puede eliminar «${product.name}»: ${IN_USE_SUFFIX}. Desactívalo para ocultarlo de la tienda.`,
      });
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
