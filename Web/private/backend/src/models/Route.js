import { Schema, model } from "mongoose";

/*
  Ruta de Logística (Fase 7): agrupa varios pedidos con un motorista y un
  vehículo. Primero recoge en Almacén y/o Fabricación, luego sale y entrega
  parada por parada. El estado se recalcula en cada cambio (lib/routes.js):
    Pendiente → Recolectando (motorista + vehículo + al menos un pedido)
    → En tránsito (al salir) → Completada (todas las paradas entregadas).
*/

const pickupSchema = new Schema({ confirmedAt: { type: Date } }, { _id: false });

// Registro de cada entrega (para «Deshacer» y para saber qué parada fue
// parcial). Un pedido entregado a medias sale de `orders`; aquí queda su
// posición para devolverlo si se deshace.
const deliverySchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    at: { type: Date, required: true },
    partial: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
  },
  { _id: false },
);

const routeSchema = new Schema(
  {
    // Correlativo por día, empezando en 1.
    number: { type: Number, required: true, min: 1 },
    // Día de la ruta: medianoche UTC de la fecha YYYY-MM-DD (hora de El Salvador).
    date: { type: Date, required: true },
    zone: { type: String, required: true, trim: true },
    driver: { type: Schema.Types.ObjectId, ref: "Employee" },
    vehicle: { type: String, trim: true }, // placa (Configuración > Vehículos)
    // Paradas en orden de entrega.
    orders: { type: [{ type: Schema.Types.ObjectId, ref: "Order" }], default: [] },
    status: {
      type: String,
      enum: ["Pendiente", "Recolectando", "En tránsito", "Completada"],
      default: "Pendiente",
    },
    delayed: { type: Boolean, default: false },
    departedAt: { type: Date },
    completedAt: { type: Date },
    pickups: {
      almacen: { type: pickupSchema, default: () => ({}) },
      fabricacion: { type: pickupSchema, default: () => ({}) },
    },
    deliveries: { type: [deliverySchema], default: [] },
  },
  { timestamps: true },
);

routeSchema.index({ date: 1, number: 1 }, { unique: true });

export default model("Route", routeSchema);
