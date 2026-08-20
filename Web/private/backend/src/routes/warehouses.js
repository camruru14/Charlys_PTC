import express from "express";
import warehousesController from "../controller/warehousesController.js";

const router = express.Router();

router
  .route("/")
  .get(warehousesController.getWarehouses)
  .post(warehousesController.insertWarehouse);

router
  .route("/:id")
  .put(warehousesController.updateWarehouse)
  .delete(warehousesController.deleteWarehouse);

export default router;
