import express from "express";
import productsController from "../controller/productsController.js";
import { uploadProductImages } from "../lib/cloudinary.js";

const router = express.Router();

// Administración del catálogo de la tienda (pages/Catalogo.jsx). El catálogo
// público de solo lectura (GET /products y GET /products/:slug) sigue en
// public/backend.
router.route("/admin/all").get(productsController.getAllProductsAdmin);

router.route("/").post(productsController.createProduct);

router
  .route("/:id")
  .put(productsController.updateProduct)
  .delete(productsController.deleteProduct);

router
  .route("/:id/images")
  .post(uploadProductImages.array("images", 6), productsController.addImages);
router.route("/:id/images/:publicId").delete(productsController.removeImage);

export default router;
