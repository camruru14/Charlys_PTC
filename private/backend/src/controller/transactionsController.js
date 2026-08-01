const transactionsController = {};

import transactionModel from "../models/Transaction.js";

// SELECT
transactionsController.getTransactions = async (req, res) => {
  const transactions = await transactionModel.find().sort({ date: -1 });
  res.json(transactions);
};

// INSERT
transactionsController.insertTransaction = async (req, res) => {
  const { reference, concept, type, category, amount, status, date } = req.body;

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
  res.json({ message: "Transaction saved" });
};

// ACTUALIZAR
transactionsController.updateTransaction = async (req, res) => {
  const { reference, concept, type, category, amount, status, date } = req.body;

  await transactionModel.findByIdAndUpdate(
    req.params.id,
    { reference, concept, type, category, amount, status, date },
    { new: true },
  );

  res.json({ message: "Transaction updated" });
};

// Eliminar
transactionsController.deleteTransaction = async (req, res) => {
  await transactionModel.findByIdAndDelete(req.params.id);
  res.json({ message: "Transaction deleted" });
};

// Resumen financiero (ingresos, gastos, rentabilidad)
transactionsController.getSummary = async (req, res) => {
  const transactions = await transactionModel.find();

  const income = transactions
    .filter((t) => t.type === "Ingreso")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "Gasto")
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    income,
    expense,
    net: income - expense,
    count: transactions.length,
  });
};

export default transactionsController;
