import express from "express";
import productionBatchesController from "../controller/productionBatchesController.js";

const router = express.Router();

router
  .route("/")
  .get(productionBatchesController.getBatches)
  .post(productionBatchesController.insertBatch);

router
  .route("/:id")
  .get(productionBatchesController.getBatch)
  .put(productionBatchesController.updateBatch)
  .delete(productionBatchesController.deleteBatch);

// Registro manual de producción reportada por el empleado
router.route("/:id/report").patch(productionBatchesController.reportProduction);

export default router;
