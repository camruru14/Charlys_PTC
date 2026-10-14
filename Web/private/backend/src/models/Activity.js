import { Schema, model } from "mongoose";

// Registro de novedades del panel: una acción del flujo de trabajo que agrega o
// cambia algo en una o varias pestañas (burbujas del menú lateral y de las
// pestañas). No guarda el detalle de lo ocurrido, solo QUÉ elemento cambió y
// DÓNDE se debe ver: cada empleado cuenta los elementos distintos (entityId)
// posteriores a su «visto» (ActivitySeen). Se borra solo a los 45 días.
//
// IMPORTANTE: copia intencional en public/backend/src/models/Activity.js (la
// tienda registra aquí cada pedido nuevo). Si se cambia el esquema, hay que
// actualizar los dos.
export const ACTIVITY_TTL_DAYS = 45;

const activitySchema = new Schema({
  // Pestañas afectadas, p. ej. ["fabricacion.pedidos"] (ver lib/activityKeys.js).
  keys: { type: [String], required: true },
  entityType: {
    type: String,
    enum: ["order", "batch", "dailyBatch", "route", "inventory", "transaction", "employee"],
    required: true,
  },
  entityId: { type: Schema.Types.ObjectId, required: true },
  // «created», «sent-to-manufacturing», etc.: solo para depurar.
  action: { type: String },
  // Empleado que lo hizo (null si vino de la tienda).
  actor: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
  at: { type: Date, default: Date.now },
});

activitySchema.index({ keys: 1, at: -1 });
activitySchema.index({ at: 1 }, { expireAfterSeconds: ACTIVITY_TTL_DAYS * 24 * 60 * 60 });

export default model("Activity", activitySchema);
