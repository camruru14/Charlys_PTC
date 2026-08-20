import express from "express";
import dailyBatchesController from "../controller/dailyBatchesController.js";

const router = express.Router();

router
  .route("/")
  .get(dailyBatchesController.getBatches)
  .post(dailyBatchesController.insertBatch);

router
  .route("/:id")
  .get(dailyBatchesController.getBatch)
  .put(dailyBatchesController.updateBatch)
  .delete(dailyBatchesController.deleteBatch);

// Programar - envía el lote diario a Lotes de fabricación
router.route("/:id/schedule").patch(dailyBatchesController.scheduleBatch);

export default router;
