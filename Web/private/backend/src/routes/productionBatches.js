import express from "express";
import productionBatchesController from "../controller/productionBatchesController.js";

const router = express.Router();

router
  .route("/")
  .get(productionBatchesController.getBatches)
  .post(productionBatchesController.insertBatch);

// Empacar varios lotes de pedido Completados, todo o nada (antes de /:id).
router.post("/pack-completed", productionBatchesController.packCompleted);

router
  .route("/:id")
  .get(productionBatchesController.getBatch)
  .put(productionBatchesController.updateBatch)
  .delete(productionBatchesController.deleteBatch);

// Flujo del lote: iniciar, detener, reanudar, completar, reabrir y enviar a bodega
router.patch("/:id/start", productionBatchesController.startBatch);
router.patch("/:id/stop", productionBatchesController.stopBatch);
router.patch("/:id/resume", productionBatchesController.resumeBatch);
router.patch("/:id/complete", productionBatchesController.completeBatch);
router.patch("/:id/reopen", productionBatchesController.reopenBatch);
router.patch("/:id/send-to-warehouse", productionBatchesController.sendToWarehouse);
router.patch("/:id/undo-send", productionBatchesController.undoSend);

export default router;
