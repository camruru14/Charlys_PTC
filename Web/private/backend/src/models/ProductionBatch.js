import { Schema, model } from "mongoose";

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
    producedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Cantidad objetivo del lote ("Meta"). En lotes categoría "Pedido" se
    // prellena con la cantidad pedida al fabricar (ver manufactureOrderItem),
    // pero queda editable a mano desde el modal de edición como cualquier otro campo.
    targetQuantity: {
      type: Number,
      min: 0,
    },
    // Se llena solo cuando se usa el botón "Reportar" en Fabricación (endpoint
    // /report). Sirve para distinguir producción reportada de producción
    // simplemente capturada al crear/editar el lote a mano.
    lastReportedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Programado", "En Proceso", "Completado", "Detenido"],
      default: "Programado",
    },
    // "Diario": lote creado a mano o programado desde Lotes Diarios (el caso
    // normal). "Pedido": lote creado desde Fabricación > Pedidos al presionar
    // "Fabricar" sobre un producto de un pedido sin stock en Inventario.
    category: {
      type: String,
      enum: ["Diario", "Pedido"],
      default: "Diario",
    },
    operator: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    // Flujo de Fabricación (Fase 5): Programado → Iniciar (startedAt) →
    // En Proceso ⇄ Detenido (stoppedAt, stopReason) → Completar
    // (completedAt) → Enviar a bodega (sentToWarehouseAt, destinationWarehouse).
    startedAt: { type: Date },
    completedAt: { type: Date },
    stoppedAt: { type: Date },
    stopReason: { type: String },
    sentToWarehouseAt: { type: Date },
    destinationWarehouse: { type: String },
    // Lotes «Pedido»: cuándo se empacó lo fabricado para el pedido.
    packedAt: { type: Date },
    // Unidades ya sumadas a inventario por el envío a bodega. Enviar solo
    // suma producedQuantity − sentQuantity, así un envío repetido no duplica.
    sentQuantity: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
);

export default model("ProductionBatch", productionBatchSchema);
