import { Schema, model } from "mongoose";

// Cada línea del pedido
const orderItemSchema = new Schema(
  {
    product: { type: String, required: true }, // ej. "Pajilla", "Pelota"
    color: { type: String }, // ej. "Rojo", "Azul"
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    // Verificación en Inventario > Pedidos: se marca al confirmar el modal
    // "Verificar producto en inventario", que resta la cantidad pedida del
    // stock de la bodega elegida.
    verified: { type: Boolean, default: false },
    verifiedWarehouse: { type: String },
    verifiedAt: { type: Date },
    // Se marca al presionar "Empacar" (solo disponible una vez verificado).
    // También pone todo el pedido en estado "Empacado" para Logística.
    packed: { type: Boolean, default: false },
    packedAt: { type: Date },
  },
  { _id: false },
);

// Información de despacho / logística asociada al pedido
const deliverySchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: "Employee" }, // motorista
    vehicle: { type: String }, // placa o identificador de vehículo
    dispatchStatus: {
      type: String,
      enum: ["Saliendo", "A tiempo", "Demorado", "Entregado"],
      default: "Saliendo",
    },
    dispatchedAt: { type: Date },
    deliveredAt: { type: Date },
    address: { type: String },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      address: { type: String },
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "Pendiente",
        "Procesando",
        "En Fabricación",
        "Empacado",
        "En Tránsito",
        "Entregado",
      ],
      default: "Pendiente",
    },
    paymentStatus: {
      type: String,
      enum: ["Pendiente", "Pagado", "Reembolsado"],
      default: "Pendiente",
    },
    source: {
      type: String,
      default: "ecommerce",
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: "ProductionBatch",
    },
    delivery: deliverySchema,
    notes: {
      type: String,
    },
    // Se llena al confirmar "Solicitar" en Pedidos: marca que los productos de
    // este pedido se solicitaron a Inventario. Ahí aparece en la pestaña
    // "Pedidos" hasta que alguien lo quite de la lista (no afecta stock).
    inventoryRequestedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Order", orderSchema);
