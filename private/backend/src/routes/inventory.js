import express from "express";
import inventoryController from "../controller/inventoryController.js";

const router = express.Router();

router
  .route("/")
  .get(inventoryController.getItems)
  .post(inventoryController.insertItem);

router
  .route("/:id")
  .get(inventoryController.getItem)
  .put(inventoryController.updateItem)
  .delete(inventoryController.deleteItem);

// Enviar un lote reportado a Artículos en almacén
router.route("/:id/send").patch(inventoryController.sendToWarehouse);

// Eliminar un lote reportado (deshace el reporte, se refleja también en Fabricación)
router.route("/:id/report").delete(inventoryController.undoReport);

export default router;
