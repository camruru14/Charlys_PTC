import mongoose from "mongoose";
import inventoryModel from "../models/InventoryItem.js";

// Error con status HTTP y mensaje en español listo para mostrar en el panel.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Responde un error: los HttpError con su status y mensaje; el resto como 500.
export function sendError(res, error) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  console.log("error " + error);
  return res.status(500).json({ message: "Error interno del servidor." });
}

// Ejecuta fn(session) dentro de una transacción de MongoDB (la base es un
// replica set de Atlas). Si fn lanza, no se aplica nada. withTransaction
// puede reintentar fn ante errores transitorios, así que fn debe cargar sus
// documentos con la sesión en cada intento.
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// Filtro del producto terminado en almacén: mismo artículo + color + bodega
// y sin batchNumber (los artículos con batchNumber son reportes de lote, no
// stock real de almacén).
function finishedStockFilter(product, color, warehouse) {
  return {
    category: "Producto Terminado",
    name: product,
    color: color || { $in: [null, ""] },
    location: warehouse,
    batchNumber: { $exists: false },
  };
}

// Descuenta `quantity` del stock de ese producto/color en esa bodega. El
// descuento es atómico y condicionado a que alcance (stock >= quantity), así
// dos verificaciones simultáneas nunca dejan el stock negativo. El artículo
// se conserva aunque quede en 0 (así deshacer lo deja exactamente igual y
// Inventario lo muestra como «Bajo mínimo»).
export async function takeStock({ product, color, warehouse, quantity }, session) {
  if (!warehouse) throw new HttpError(400, "Selecciona una bodega");
  const updated = await inventoryModel.findOneAndUpdate(
    { ...finishedStockFilter(product, color, warehouse), stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { session, returnDocument: "after" },
  );
  if (!updated) {
    const label = `${product}${color ? ` · ${color}` : ""}`;
    throw new HttpError(409, `No hay existencia suficiente de ${label} en ${warehouse}`);
  }
  return updated;
}

// Suma `quantity` al producto terminado con ese artículo, color y bodega; si
// no existe, lo crea con esa cantidad. `inbound` ({ quantity, batchNumber,
// at }) se guarda como lastInbound: es la marca de «ingreso reciente» que
// muestra Inventario cuando llega un lote desde Fabricación.
export async function addFinishedStock({ product, color, warehouse, quantity, unit, unitCost, inbound }, session) {
  if (!warehouse || !quantity) return null;
  const update = { $inc: { stock: quantity } };
  if (inbound) update.$set = { lastInbound: inbound };
  const updated = await inventoryModel.findOneAndUpdate(finishedStockFilter(product, color, warehouse), update, {
    session,
    returnDocument: "after",
  });
  if (updated) return updated;
  const [created] = await inventoryModel.create(
    [
      {
        name: product,
        category: "Producto Terminado",
        color,
        stock: quantity,
        location: warehouse,
        ...(unit ? { unit } : {}),
        ...(unitCost ? { unitCost } : {}),
        ...(inbound ? { lastInbound: inbound } : {}),
      },
    ],
    { session },
  );
  return created;
}

// Devuelve `quantity` al stock de ese producto/color en esa bodega. Si el
// artículo ya no existe (p. ej. se borró a mano), se recrea con esa cantidad.
export async function returnStock({ product, color, warehouse, quantity }, session) {
  await addFinishedStock({ product, color, warehouse, quantity }, session);
}
