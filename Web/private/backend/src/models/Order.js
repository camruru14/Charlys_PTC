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
    // Dónde se empacó la línea: se llena solo (nunca a mano) al marcarla como
    // empacada. "Almacén" desde el flujo normal de Inventario > Pedidos
    // (packOrderItem); "Fabricación" desde Fabricación > Fabricación de
    // pedidos (packManufacturedItem), cuando el producto no había en stock y
    // se fabricó exclusivamente para este pedido. Logística lo usa para saber
    // dónde tiene que pasar el motorista a recoger (ver getRequiredPickups).
    packedLocation: { type: String, enum: ["Almacén", "Fabricación"] },
    // Se marca al presionar "Enviar a fabricación" en el modal "Verificar
    // producto en inventario" (Inventario > Pedidos), cuando no hay stock
    // suficiente para cubrir el pedido. La línea aparece entonces en
    // Fabricación > Pedidos; en Inventario > Pedidos queda como "Enviado".
    sentToManufacturing: { type: Boolean, default: false },
    sentToManufacturingAt: { type: Date },
    // Se llena al presionar "Fabricar" en Fabricación > Pedidos: crea un lote
    // en Lotes de fabricación (categoría "Pedido", meta = cantidad pedida) y
    // queda enlazado aquí.
    manufacturingBatch: { type: Schema.Types.ObjectId, ref: "ProductionBatch" },
    manufacturedAt: { type: Date },
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
    // Checklist de recolección: se llenan cuando Logística confirma que el
    // motorista ya recogió lo que le tocaba en ese lugar (ver confirmPickup y
    // getRequiredPickups en Logistica.jsx). Si el pedido nunca tuvo nada que
    // recoger en un lugar, el campo correspondiente se queda vacío.
    pickupWarehouseAt: { type: Date },
    pickupFactoryAt: { type: Date },
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
