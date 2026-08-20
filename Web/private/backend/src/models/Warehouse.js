import { Schema, model } from "mongoose";

// Bodegas físicas del sistema. Reemplaza la constante WAREHOUSES hardcodeada
// que antes vivía en el frontend (hooks/useBatchForm.js): ahora Inventario,
// el modal de verificación de pedidos (indirectamente, vía los artículos que
// ya tienen bodega) y los reportes de Fabricación leen esta lista real desde
// /api/warehouses en vez de un arreglo fijo de un solo elemento.
const warehouseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Warehouse", warehouseSchema);
