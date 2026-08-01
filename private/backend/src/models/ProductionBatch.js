import { Schema, model } from "mongoose";

// Materia prima consumida por el lote
const rawMaterialSchema = new Schema(
  {
    material: { type: String, required: true }, // ej. "Plástico PP", "Tinte rojo"
    quantityUsed: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "kg" },
  },
  { _id: false },
);

// Resultado del control de calidad del lote
const qualityCheckSchema = new Schema(
  {
    passed: { type: Boolean, default: true },
    inspectedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
    notes: { type: String },
    // Alertas de control de calidad (para mostrar en Fabricación)
    alerts: [
      {
        level: {
          type: String,
          enum: ["info", "warning", "critical"],
          default: "info",
        },
        message: { type: String },
      },
    ],
  },
  { _id: false },
);

const productionBatchSchema = new Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    product: {
      type: String,
      required: true,
    },
    color: {
      type: String,
    },
    productionLine: {
      type: String, // ej. "Línea 1"
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    producedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    wasteQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    wastePercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Programado", "En Proceso", "Completado", "Detenido"],
      default: "Programado",
    },
    qualityCheck: qualityCheckSchema,
    operator: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    rawMaterials: {
      type: [rawMaterialSchema],
      default: [],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Antes de guardar, calculamos el porcentaje de residuos automáticamente.
// Estilo síncrono (sin next): Mongoose lo resuelve al retornar.
productionBatchSchema.pre("save", function () {
  const totalProcessed = this.producedQuantity + this.wasteQuantity;
  this.wastePercentage =
    totalProcessed > 0
      ? Number(((this.wasteQuantity / totalProcessed) * 100).toFixed(2))
      : 0;
});

export default model("ProductionBatch", productionBatchSchema);
