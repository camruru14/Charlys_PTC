import express from "express";
import productionLinesController from "../controller/productionLinesController.js";

const router = express.Router();

router.route("/").get(productionLinesController.getLines).post(productionLinesController.insertLine);

router.route("/:id").patch(productionLinesController.updateLine).delete(productionLinesController.deleteLine);

export default router;
