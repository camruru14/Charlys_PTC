import express from "express";
import transactionsController from "../controller/transactionsController.js";

const router = express.Router();

router
  .route("/")
  .get(transactionsController.getTransactions)
  .post(transactionsController.insertTransaction);

router.route("/summary").get(transactionsController.getSummary);

router
  .route("/:id")
  .put(transactionsController.updateTransaction)
  .delete(transactionsController.deleteTransaction);

export default router;
