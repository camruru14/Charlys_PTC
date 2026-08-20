import express from "express";
import dashboardController from "../controller/dashboardController.js";

const router = express.Router();

router.route("/").get(dashboardController.getSummary);

export default router;
