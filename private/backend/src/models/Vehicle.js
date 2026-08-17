import { Schema, model } from "mongoose";

// Vehículos de la flota, elegibles al asignar/editar una entrega en
// Logística. delivery.vehicle en Order.js sigue guardando la placa como
// texto, no una referencia (igual que "location" en InventoryItem con
// Warehouse): así un pedido ya despachado no se ve afectado si el vehículo
// se edita o elimina después. Mismo patrón que Warehouse.js.
const vehicleSchema = new Schema(
  {
    plate: {
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

export default model("Vehicle", vehicleSchema);
