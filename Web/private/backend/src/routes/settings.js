import express from "express";
import settingsController from "../controller/settingsController.js";

const router = express.Router();

router
  .route("/work-schedule")
  .get(settingsController.getWorkSchedule)
  .put(settingsController.updateWorkSchedule);

export default router;
