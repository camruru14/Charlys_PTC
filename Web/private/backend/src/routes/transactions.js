import express from "express";
import transactionsController from "../controller/transactionsController.js";
import { uploadTransactionFile } from "../lib/cloudinary.js";

const router = express.Router();

router
  .route("/")
  .get(transactionsController.getTransactions)
  .post(transactionsController.insertTransaction);

router
  .route("/:id")
  .put(transactionsController.updateTransaction)
  .delete(transactionsController.deleteTransaction);

router.patch("/:id/pay", transactionsController.payTransaction);

router
  .route("/:id/attachment")
  .post(uploadTransactionFile.single("file"), transactionsController.setAttachment)
  .delete(transactionsController.removeAttachment);

export default router;
