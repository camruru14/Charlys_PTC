import mongoose from "mongoose";

/*
  Carga los modelos de los dos backends SIN crear índices ni colecciones (autoIndex/autoCreate
  apagados antes de definirlos): este script nunca modifica el esquema de la base. Los modelos de la
  tienda (Customer, PaymentTransaction) se importan de Web/public/backend: solo se usan para validar y
  armar los documentos, nunca se conectan.
*/
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const load = async (path) => (await import(path)).default;

export const M = {
  Employee: await load("../../src/models/Employee.js"),
  Order: await load("../../src/models/Order.js"),
  CustomerOrder: await load("../../src/models/CustomerOrder.js"),
  Transaction: await load("../../src/models/Transaction.js"),
  InventoryItem: await load("../../src/models/InventoryItem.js"),
  ProductionBatch: await load("../../src/models/ProductionBatch.js"),
  DailyBatch: await load("../../src/models/DailyBatch.js"),
  Route: await load("../../src/models/Route.js"),
  Customer: await load("../../../../public/backend/src/models/Customer.js"),
  PaymentTransaction: await load("../../../../public/backend/src/models/PaymentTransaction.js"),
};
