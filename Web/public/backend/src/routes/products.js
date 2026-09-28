import express from "express";
import productsController from "../controller/productsController.js";

const router = express.Router();

// Catálogo público de solo lectura. La administración del catálogo (crear,
// editar, eliminar productos e imágenes) vive en private/backend
// (/api/products, con la sesión del panel), sobre la misma colección.
router.route("/").get(productsController.getProducts);
router.route("/:slug").get(productsController.getProductBySlug);

export default router;
