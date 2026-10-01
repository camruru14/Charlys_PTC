const productsController = {};

import productModel from "../models/Product.js";

// Solo lectura: la administración del catálogo (crear, editar, eliminar e
// imágenes) está en private/backend/src/controller/productsController.js.

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

export default productsController;
