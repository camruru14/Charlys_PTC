import { Schema, model } from "mongoose";

/*
  Ruta de Logística (Fase 7): agrupa varios pedidos con un motorista y un
  vehículo. Primero recoge en Almacén y/o Fabricación, luego sale y entrega
  parada por parada. El estado se recalcula en cada cambio (lib/routes.js):
    Pendiente → Recolectando (motorista + vehículo + al menos un pedido)
    → En tránsito (al salir) → Completada (todas las paradas entregadas).
  Cada ruta tiene un código único que no se reinicia: R-AAAA-NNNN (año de
  creación + consecutivo del año), como ORD-AAAA-NNNN en los pedidos.
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
    // Código único de la ruta: R-AAAA-NNNN. Las rutas anteriores a este campo
    // no lo tienen y se muestran con su número (índice sparse).
    code: { type: String, trim: true },
    // OBSOLETO: antes era el correlativo por día (se reiniciaba cada día y dejó
    // de ser único). Ya no se calcula por día ni se usa en código nuevo; solo
    // identifica a las rutas viejas sin código. Las rutas nuevas guardan aquí
    // el consecutivo del código, únicamente para que la app móvil (que todavía
    // muestra «Ruta N») no vea un número vacío: quitar al actualizar el móvil.
    number: { type: Number, min: 1 },
    // Día en que se creó la ruta: medianoche UTC de la fecha YYYY-MM-DD (hora de El Salvador).
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

// Único solo entre las rutas que ya tienen código (las viejas no lo tienen).
routeSchema.index({ code: 1 }, { unique: true, sparse: true });
routeSchema.index({ date: 1 });
routeSchema.index({ status: 1, completedAt: 1 });

export default model("Route", routeSchema);
