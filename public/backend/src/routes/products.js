import express from "express";
import productsController from "../controller/productsController.js";
import { requireEmployeeAuth } from "../middlewares/employeeAuthMiddleware.js";
import { uploadProductImages } from "../utils/cloudinary.js";

const router = express.Router();

// Público
router.route("/").get(productsController.getProducts);

// Administración del catálogo (requiere sesión de empleado, ver
// employeeAuthMiddleware.js — misma cookie "authCookie" que private/frontend)
// Va antes de "/:slug" para que "admin" no se interprete como un slug.
router.route("/admin/all").get(requireEmployeeAuth(), productsController.getAllProductsAdmin);

router.route("/:slug").get(productsController.getProductBySlug);

router.route("/").post(requireEmployeeAuth(), productsController.createProduct);
router
  .route("/:id")
  .put(requireEmployeeAuth(), productsController.updateProduct)
  .delete(requireEmployeeAuth(), productsController.deleteProduct);

router
  .route("/:id/images")
  .post(requireEmployeeAuth(), uploadProductImages.array("images", 6), productsController.addImages);
router.route("/:id/images/:publicId").delete(requireEmployeeAuth(), productsController.removeImage);

export default router;
