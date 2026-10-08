import { Schema, model } from "mongoose";

const dailyBatchSchema = new Schema(
  {
    dailyBatchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
    },
    product: {
      type: String,
      required: true,
    },
    color: {
      type: String,
    },
    // Meta (unidades a producir): entero entre 1 y 9 999 999 (el controlador la
    // exige al crear y al editar). Al programar el lote diario pasa a
    // targetQuantity del lote de fabricación. No es required en el esquema
    // porque los lotes diarios anteriores no la tienen: se muestran sin meta
    // hasta que se editen y no se pueden programar sin ella.
    targetQuantity: {
      type: Number,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

export default model("DailyBatch", dailyBatchSchema);
