import { Schema, model } from "mongoose";

// Lo que cada empleado ya vio de las novedades (ver Activity.js), por pestaña:
//  - entityId = un registro: lo abrió (clic) en esa pestaña en `seenAt`.
//  - entityId = null: la «base» de esa pestaña. Todo lo anterior a `seenAt` ya
//    está visto («Marcar todo como visto»); si no hay base, se toma la fecha
//    de alta del empleado.
// Un registro es novedad en una pestaña si tiene actividad posterior a su
// seenAt y a la base.
const activitySeenSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  key: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, default: null },
  seenAt: { type: Date, required: true },
});

activitySeenSchema.index({ employee: 1, key: 1, entityId: 1 }, { unique: true });
// Los «vistos» por registro se borran solos (la actividad dura 45 días); la base no.
activitySeenSchema.index({ seenAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60, partialFilterExpression: { entityId: { $type: "objectId" } } });

export default model("ActivitySeen", activitySeenSchema);
