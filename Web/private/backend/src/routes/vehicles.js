import express from "express";
import vehiclesController from "../controller/vehiclesController.js";
import { uploadVehicleImage } from "../lib/cloudinary.js";

const router = express.Router();

router
  .route("/")
  .get(vehiclesController.getVehicles)
  .post(vehiclesController.insertVehicle);

router
  .route("/:id")
  .put(vehiclesController.updateVehicle)
  .delete(vehiclesController.deleteVehicle);

router
  .route("/:id/image")
  .post(uploadVehicleImage.single("image"), vehiclesController.setImage)
  .delete(vehiclesController.removeImage);

export default router;
