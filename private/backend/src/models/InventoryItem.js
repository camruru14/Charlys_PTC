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
    // Tipo de materia prima (Polimero, Aditivo, Tinta, Insumo). Solo aplica a
    // artículos de categoría "Materia Prima".
    materialType: { type: String },
    color: { type: String },
    unit: { type: String, default: "unidad" },
    stock: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    location: { type: String },
    // Se llena solo cuando el artículo se generó automáticamente al reportar un
    // lote desde Fabricación (botón "Reportar"). Permite identificar estos
    // artículos en la pestaña "Lotes Reportados" de Inventario y evitar
    // duplicados: un mismo lote actualiza su mismo artículo en vez de crear otro.
    // El registro se queda en "Lotes Reportados" para siempre (no se borra ni
    // se desvincula), aunque ya se haya enviado a almacén.
    batchNumber: { type: String },
    // Se marca true al confirmar "Enviar" en Lotes Reportados. Es solo un
    // indicador visual ahí (cambia el botón "Enviar" por "Enviado"): las
    // unidades reportadas no se cuentan desde este artículo, se suman al
    // producto terminado de "Artículos en almacén" con mismo artículo, color
    // y bodega (o se crea uno nuevo si no hay coincidencia). Ver
    // inventoryController.sendToWarehouse.
    sentToWarehouse: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default model("InventoryItem", inventoryItemSchema);
