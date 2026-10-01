// Migración de pedidos para statusHistory y sentToInventoryAt (Fase 2).
//
// Uso (desde Web/private/backend, con el .env que tiene DB_URI):
//   npm run migrate:orders
//
// Es idempotente: se puede correr varias veces y solo toca los pedidos que
// todavía no están migrados.
//   1. inventoryRequestedAt (campo viejo) -> sentToInventoryAt, y se borra el
//      campo viejo.
//   2. Pedidos no entregados sin sentToInventoryAt: pasan a Inventario con la
//      misma regla que un pedido nuevo (sentToInventoryAt = createdAt).
//   3. Pedidos sin statusHistory: un registro con su status actual y la fecha
//      de updatedAt.
import mongoose from "mongoose";
import { config } from "../config.js";

async function main() {
  if (!config.db.URI) {
    throw new Error("Falta DB_URI en el .env de Web/private/backend");
  }
  await mongoose.connect(config.db.URI);
  // Colección cruda: el campo viejo inventoryRequestedAt ya no está en el esquema.
  const orders = mongoose.connection.collection("orders");

  const renamed = await orders.updateMany(
    { inventoryRequestedAt: { $exists: true }, sentToInventoryAt: { $exists: false } },
    [{ $set: { sentToInventoryAt: "$inventoryRequestedAt" } }],
  );
  const dropped = await orders.updateMany(
    { inventoryRequestedAt: { $exists: true } },
    { $unset: { inventoryRequestedAt: "" } },
  );

  const sent = await orders.updateMany(
    { status: { $ne: "Entregado" }, sentToInventoryAt: { $exists: false } },
    [{ $set: { sentToInventoryAt: { $ifNull: ["$createdAt", "$$NOW"] } } }],
  );

  const history = await orders.updateMany(
    { $or: [{ statusHistory: { $exists: false } }, { statusHistory: { $size: 0 } }] },
    [
      {
        $set: {
          statusHistory: [
            {
              status: { $ifNull: ["$status", "Pendiente"] },
              at: { $ifNull: ["$updatedAt", { $ifNull: ["$createdAt", "$$NOW"] }] },
            },
          ],
        },
      },
    ],
  );

  console.log(`inventoryRequestedAt -> sentToInventoryAt: ${renamed.modifiedCount}`);
  console.log(`inventoryRequestedAt eliminados:          ${dropped.modifiedCount}`);
  console.log(`Pedidos enviados a Inventario:            ${sent.modifiedCount}`);
  console.log(`Pedidos con statusHistory inicial:        ${history.modifiedCount}`);
}

main()
  .catch((error) => {
    console.error("Error en la migración:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
