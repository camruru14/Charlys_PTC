import express from "express";
import subcategoriesController from "../controller/subcategoriesController.js";

const router = express.Router();

router.route("/").get(subcategoriesController.getSubcategories).post(subcategoriesController.insertSubcategory);

router.route("/:id").patch(subcategoriesController.updateSubcategory).delete(subcategoriesController.deleteSubcategory);

export default router;
