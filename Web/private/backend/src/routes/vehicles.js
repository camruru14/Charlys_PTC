import express from "express";
import vehiclesController from "../controller/vehiclesController.js";

const router = express.Router();

router
  .route("/")
  .get(vehiclesController.getVehicles)
  .post(vehiclesController.insertVehicle);

router
  .route("/:id")
  .put(vehiclesController.updateVehicle)
  .delete(vehiclesController.deleteVehicle);

export default router;
