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

export default router;
