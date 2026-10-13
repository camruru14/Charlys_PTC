import express from "express";
import dashboardController from "../controller/dashboardController.js";
import dashboardMobileController from "../controller/dashboardMobileController.js";

const router = express.Router();

router.route("/").get(dashboardController.getSummary);
// Resumen anterior, que todavía lee la app móvil.
router.route("/mobile").get(dashboardMobileController.getSummary);

export default router;
