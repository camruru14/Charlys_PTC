import express from "express";
import settingsController from "../controller/settingsController.js";
import { uploadCompanyLogo } from "../lib/cloudinary.js";

const router = express.Router();

router
  .route("/work-schedule")
  .get(settingsController.getWorkSchedule)
  .put(settingsController.updateWorkSchedule);

router
  .route("/company")
  .get(settingsController.getCompany)
  .put(settingsController.updateCompany);

router.route("/company/logo").post(uploadCompanyLogo.single("logo"), settingsController.updateLogo);

export default router;
