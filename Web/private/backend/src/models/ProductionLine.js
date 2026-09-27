import { Schema, model } from "mongoose";

// Líneas de producción (Configuración > Líneas de producción). Mismo patrón
// que Warehouse.js y Vehicle.js: ProductionBatch.productionLine sigue
// guardando el nombre como texto, no una referencia, así el historial de un
// lote no cambia si la línea se desactiva o se elimina después.
// active: false = ya no aparece para crear o iniciar lotes, pero se conserva.
const productionLineSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("ProductionLine", productionLineSchema);
