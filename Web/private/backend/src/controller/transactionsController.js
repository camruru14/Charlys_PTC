const transactionsController = {};

import transactionModel from "../models/Transaction.js";

// Genera el siguiente N° de transacción correlativo del año (TRAN-2026-0001, TRAN-2026-0002, ...)
export async function generateReference() {
  const prefix = `TRAN-${new Date().getFullYear()}-`;
  const last = await transactionModel
    .findOne({ reference: { $regex: `^${prefix}` } })
    .sort({ reference: -1 });

  const lastNumber = last ? parseInt(last.reference.slice(prefix.length), 10) : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

// SELECT
transactionsController.getTransactions = async (req, res) => {
  const transactions = await transactionModel
    .find()
    .populate("relatedOrder", "orderNumber")
    .sort({ date: -1 });
  res.json(transactions);
};

// INSERT
transactionsController.insertTransaction = async (req, res) => {
  const { concept, type, category, amount, status, date } = req.body;

  const reference = await generateReference();

  const newTransaction = new transactionModel({
    reference,
    concept,
    type,
    category,
    amount,
    status,
    date,
  });

  await newTransaction.save();
  res.json({ message: "Transaction saved", reference });
};

// ACTUALIZAR
transactionsController.updateTransaction = async (req, res) => {
  const { reference, concept, type, category, amount, status, date } = req.body;

  await transactionModel.findByIdAndUpdate(
    req.params.id,
    { reference, concept, type, category, amount, status, date },
    { returnDocument: "after" },
  );

  res.json({ message: "Transaction updated" });
};

// Eliminar
transactionsController.deleteTransaction = async (req, res) => {
  await transactionModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Transaction deleted" });
};

export default transactionsController;
