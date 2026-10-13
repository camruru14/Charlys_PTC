const transactionsController = {};

import mongoose from "mongoose";
import transactionModel, { isStoreSale } from "../models/Transaction.js";
import expenseCategoryModel, { NAME_COLLATION, normalizeName } from "../models/ExpenseCategory.js";
import cloudinary, { uploadTransactionFileBuffer } from "../lib/cloudinary.js";

// Categoría de todo ingreso manual (las «Ventas» solo las crea la tienda).
export const OTHER_INCOME = "Otros ingresos";

// Métodos de pago que se pueden elegir al registrar un movimiento a mano
// («Wompi» es solo de las ventas de la tienda).
const MANUAL_PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque"];

const STORE_SALE_MESSAGE = "Las ventas de la tienda no se editan";

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

// Busca la transacción de :id (404 si el id no es válido o no existe).
// Devuelve null después de responder.
async function findTransaction(req, res) {
  const transaction = mongoose.isValidObjectId(req.params.id) ? await transactionModel.findById(req.params.id) : null;
  if (!transaction) {
    res.status(404).json({ message: "Transacción no encontrada" });
    return null;
  }
  return transaction;
}

// Borra el archivo de Cloudinary sin fallar si ya no existe.
const destroyFile = (attachment) =>
  attachment?.publicId
    ? cloudinary.uploader.destroy(attachment.publicId, { resource_type: attachment.resourceType || "image" }).catch(() => null)
    : null;

const isBlank = (value) => value === undefined || value === null || value === "";

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Valida y normaliza los datos de un movimiento manual. `body` trae lo que
// envía el cliente y `current` (solo al editar) lo que ya tiene guardado: lo
// que no venga en el body se conserva. Devuelve { error: { status, message } }
// o { data }. `data` no incluye reference, relatedOrder ni orderNumber.
async function parseManual(body = {}, current = null) {
  const pick = (key) => (key in body ? body[key] : current?.[key]);
  const fail = (message, status = 400) => ({ error: { status, message } });

  const concept = typeof pick("concept") === "string" ? pick("concept").trim() : "";
  if (!concept) return fail("Escribe el concepto");

  const type = pick("type");
  if (type !== "Ingreso" && type !== "Gasto") return fail("El tipo debe ser Ingreso o Gasto");

  const amount = typeof pick("amount") === "string" && pick("amount").trim() !== "" ? Number(pick("amount")) : pick("amount");
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return fail("El monto debe ser un número mayor o igual a 0");

  const status = isBlank(pick("status")) ? "Completado" : pick("status");
  if (status !== "Pendiente" && status !== "Completado") return fail("El estado debe ser Pendiente o Completado");

  const date = isBlank(pick("date")) ? new Date() : toDate(pick("date"));
  if (!date) return fail("La fecha no es válida");

  const paymentMethod = isBlank(pick("paymentMethod")) ? undefined : pick("paymentMethod");
  if (paymentMethod !== undefined && !MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
    return fail("El método de pago debe ser Efectivo, Transferencia o Cheque");
  }

  let dueDate;
  if (status === "Pendiente" && !isBlank(pick("dueDate"))) {
    dueDate = toDate(pick("dueDate"));
    if (!dueDate) return fail("La fecha de vencimiento no es válida");
  }

  let category = OTHER_INCOME;
  if (type === "Gasto") {
    const requested = typeof pick("category") === "string" ? normalizeName(pick("category")) : "";
    if (!requested) return fail("Elige la categoría del gasto");
    const found = await expenseCategoryModel.findOne({ name: requested }).collation(NAME_COLLATION);
    // Al editar se puede conservar la categoría que ya tenía el gasto aunque
    // esté archivada (o ya no exista como categoría).
    const keepsCurrent = current?.type === "Gasto" && normalizeName(current.category).toLocaleLowerCase("es") === requested.toLocaleLowerCase("es");
    if (found && !found.archived) category = found.name;
    else if (keepsCurrent) category = found?.name ?? current.category;
    else return fail(found ? "Esa categoría está archivada" : "La categoría no existe");
  }

  return { data: { concept, type, category, amount, status, date, paymentMethod, dueDate } };
}

// SELECT
transactionsController.getTransactions = async (req, res) => {
  const transactions = await transactionModel
    .find()
    .populate("relatedOrder", "orderNumber")
    .sort({ date: -1 });
  res.json(transactions);
};

// INSERT (movimiento manual). Responde con el _id para que el panel suba la
// factura justo después.
transactionsController.insertTransaction = async (req, res) => {
  const { error, data } = await parseManual(req.body);
  if (error) return res.status(error.status).json({ message: error.message });

  const reference = await generateReference();
  const created = await transactionModel.create({ reference, ...data });
  res.json({ message: "Transaction saved", reference, _id: created._id });
};

// ACTUALIZAR. Las ventas de la tienda no se editan; reference, relatedOrder y
// orderNumber nunca los cambia el cliente. Pasar a «Completado» registra
// paidAt y quita el vencimiento; volver a «Pendiente» quita paidAt.
transactionsController.updateTransaction = async (req, res) => {
  const transaction = await findTransaction(req, res);
  if (!transaction) return;
  if (isStoreSale(transaction)) return res.status(409).json({ message: STORE_SALE_MESSAGE });

  const { error, data } = await parseManual(req.body, transaction);
  if (error) return res.status(error.status).json({ message: error.message });

  const wasPending = transaction.status === "Pendiente";
  transaction.set({
    concept: data.concept,
    type: data.type,
    category: data.category,
    amount: data.amount,
    status: data.status,
    date: data.date,
    paymentMethod: data.paymentMethod,
    dueDate: data.dueDate,
  });
  if (data.status === "Completado" && wasPending) transaction.paidAt = new Date();
  if (data.status === "Pendiente") transaction.paidAt = undefined;
  await transaction.save();

  res.json({ message: "Transaction updated" });
};

// PATCH /:id/pay - marca como pagado (o cobrado). Si ya estaba completado no
// cambia nada.
transactionsController.payTransaction = async (req, res) => {
  const transaction = await findTransaction(req, res);
  if (!transaction) return;
  if (isStoreSale(transaction)) return res.status(409).json({ message: STORE_SALE_MESSAGE });

  if (transaction.status !== "Completado") {
    transaction.status = "Completado";
    transaction.paidAt = new Date();
    transaction.dueDate = undefined;
    await transaction.save();
  }
  res.json({ message: "Transaction paid", transaction });
};

// Eliminar. Su factura (si tiene) también se borra de Cloudinary.
transactionsController.deleteTransaction = async (req, res) => {
  const transaction = await findTransaction(req, res);
  if (!transaction) return;
  if (isStoreSale(transaction)) return res.status(409).json({ message: "Las ventas de la tienda no se eliminan" });

  await transaction.deleteOne();
  await destroyFile(transaction.attachment);
  res.json({ message: "Transaction deleted" });
};

// POST /:id/attachment (multipart, campo "file"). Sube la factura nueva,
// guarda la transacción y borra la factura anterior de Cloudinary.
transactionsController.setAttachment = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecciona una factura" });
  const transaction = await findTransaction(req, res);
  if (!transaction) return;
  if (isStoreSale(transaction)) return res.status(409).json({ message: "Las ventas de la tienda no admiten archivos" });

  const uploaded = await uploadTransactionFileBuffer(req.file.buffer, req.file.originalname);
  const previous = transaction.attachment;
  try {
    transaction.attachment = {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      resourceType: uploaded.resource_type || "image",
      name: req.file.originalname,
      // Las imágenes se re-codifican a JPEG al subirlas; el PDF queda como PDF.
      mimeType: req.file.mimetype === "application/pdf" ? "application/pdf" : "image/jpeg",
    };
    await transaction.save();
  } catch (error) {
    // Si no se pudo guardar, la factura recién subida quedaría huérfana.
    await destroyFile({ publicId: uploaded.public_id, resourceType: uploaded.resource_type });
    throw error;
  }
  if (previous?.publicId && previous.publicId !== uploaded.public_id) await destroyFile(previous);
  res.json(transaction);
};

// DELETE /:id/attachment
transactionsController.removeAttachment = async (req, res) => {
  const transaction = await findTransaction(req, res);
  if (!transaction) return;
  if (isStoreSale(transaction)) return res.status(409).json({ message: "Las ventas de la tienda no admiten archivos" });

  const previous = transaction.attachment;
  transaction.attachment = undefined;
  await transaction.save();
  await destroyFile(previous);
  res.json(transaction);
};

export default transactionsController;
