import express from "express";
import expenseCategoriesController from "../controller/expenseCategoriesController.js";

const router = express.Router();

router
  .route("/")
  .get(expenseCategoriesController.getCategories)
  .post(expenseCategoriesController.insertCategory);

// Antes de "/:id": «budgets» no es un id.
router.put("/budgets", expenseCategoriesController.saveBudgets);

router.put("/:id", expenseCategoriesController.updateCategory);

export default router;
