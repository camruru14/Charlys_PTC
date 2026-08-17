const productsController = {};

import productModel from "../models/Product.js";
import cloudinary from "../utils/cloudinary.js";

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

// GET /api/products?category=Pelotas&search=azul&featured=true
// Catálogo público: solo productos activos.
productsController.getProducts = async (req, res) => {
  try {
    const { category, search, featured } = req.query;
    const filter = { active: true };

    if (category) filter.category = category;
    if (featured === "true") filter.featured = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await productModel.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// GET /api/products/admin/all  (requiere sesión de empleado)
// A diferencia de getProducts, no filtra por `active`: la pantalla de
// administración (Catálogo, en private/frontend) necesita ver también los
// productos desactivados para poder reactivarlos.
productsController.getAllProductsAdmin = async (_req, res) => {
  try {
    const products = await productModel.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// GET /api/products/:slug
productsController.getProductBySlug = async (req, res) => {
  try {
    const product = await productModel.findOne({
      slug: req.params.slug,
      active: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    res.json(product);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// POST /api/products  (requiere sesión de empleado)
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
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// PUT /api/products/:id  (requiere sesión de empleado)
productsController.updateProduct = async (req, res) => {
  try {
    const updated = await productModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    res.json(updated);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// DELETE /api/products/:id  (requiere sesión de empleado)
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
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// POST /api/products/:id/images  (requiere sesión de empleado, multipart/form-data, campo "images")
productsController.addImages = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const files = req.files || [];
    const newImages = files.map((file) => ({
      url: file.path, // secure_url que entrega multer-storage-cloudinary
      publicId: file.filename, // public_id en Cloudinary
    }));

    product.images.push(...newImages);
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// DELETE /api/products/:id/images/:publicId  (requiere sesión de empleado)
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
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default productsController;
