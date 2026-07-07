import { Schema, model } from "mongoose";

const inventoryItemSchema = new Schema(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ["Materia Prima", "Producto Terminado"],
      required: true,
    },
    type: { type: String },
    color: { type: String },
    unit: { type: String, default: "unidad" },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    location: { type: String },
  },
  { timestamps: true },
);

export default model("InventoryItem", inventoryItemSchema);
