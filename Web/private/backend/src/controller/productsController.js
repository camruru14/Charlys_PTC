const productsController = {};

import productModel from "../models/Product.js";
import cloudinary, { uploadProductImageBuffer } from "../lib/cloudinary.js";

/*
  Administración del catálogo de la tienda pública (pages/Catalogo.jsx del
  panel). Antes vivía en public/backend; se movió aquí para que el Catálogo
  funcione aunque la tienda no esté corriendo. Escribe en la misma colección
  "products" que public/backend lee (ver models/Product.js). Las rutas
  públicas de solo lectura (GET /products y GET /products/:slug) siguen en
  public/backend.
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
      name,
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

    if (!name || !category || price === undefined) {
      return res
        .status(400)
        .json({ message: "name, category y price son obligatorios." });
    }

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
    sendError(res, error);
  }
};

// PUT /api/products/:id
productsController.updateProduct = async (req, res) => {
  try {
    const updated = await productModel.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });

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
