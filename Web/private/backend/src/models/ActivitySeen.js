import { Schema, model } from "mongoose";

// Hasta cuándo vio cada empleado cada pestaña (ver Activity.js): lo que sea
// posterior a `seenAt` cuenta como novedad para ese empleado en esa pestaña.
const activitySeenSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  key: { type: String, required: true },
  seenAt: { type: Date, required: true },
});

activitySeenSchema.index({ employee: 1, key: 1 }, { unique: true });

export default model("ActivitySeen", activitySeenSchema);
