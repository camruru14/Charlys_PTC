import express from "express";
import activityController from "../controller/activityController.js";

const router = express.Router();

// Burbujas de novedades del menú y de las pestañas (por empleado).
router.get("/counts", activityController.getCounts);
router.post("/seen", activityController.markSeen);

export default router;
