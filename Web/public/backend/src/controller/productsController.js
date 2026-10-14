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

    if (typeof category === "string" && category) filter.category = category;
    if (featured === "true") filter.featured = true;
    // El texto buscado se escapa (no es una expresión regular del usuario) y se limita
    // a 60 caracteres: sin esto, un patrón mal formado daba 500 o podía trabar la búsqueda.
    if (typeof search === "string" && search.trim()) {
      const escaped = search.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
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
