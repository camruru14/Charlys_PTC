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

// Flujo del lote: iniciar, detener, reanudar, completar, reabrir y enviar a bodega
router.patch("/:id/start", productionBatchesController.startBatch);
router.patch("/:id/stop", productionBatchesController.stopBatch);
router.patch("/:id/resume", productionBatchesController.resumeBatch);
router.patch("/:id/complete", productionBatchesController.completeBatch);
router.patch("/:id/reopen", productionBatchesController.reopenBatch);
router.patch("/:id/send-to-warehouse", productionBatchesController.sendToWarehouse);
router.patch("/:id/undo-send", productionBatchesController.undoSend);

// Flujo antiguo (solo lo usa la app Movil): reportar producción / deshacer reporte
router
  .route("/:id/report")
  .patch(productionBatchesController.reportProduction)
  .delete(productionBatchesController.undoReport);

export default router;
