import { api } from "./api";

// Acciones de un lote de fabricación, con los mismos endpoints que
// LotesFabricacion.jsx y PedidosFabricacion.jsx de la web. Cada una trae su
// reversa (la que usa «Deshacer»), o null si la web no ofrece deshacer.
const url = (batchId, action) => `/productionBatches/${batchId}/${action}`;
const lineUrl = (orderId, index, action) => `/orders/${orderId}/items/${index}/${action}`;

export const batchApi = {
  // body: { productionLine, operator } si faltan al iniciar
  start: (id, body = {}) => api.patch(url(id, "start"), body),
  stop: (id, reason) => api.patch(url(id, "stop"), { reason }),
  resume: (id) => api.patch(url(id, "resume")),
  complete: (id, producedQuantity) => api.patch(url(id, "complete"), { producedQuantity }),
  reopen: (id) => api.patch(url(id, "reopen")),
  sendToWarehouse: (id, warehouse) => api.patch(url(id, "send-to-warehouse"), { warehouse }),
  undoSend: (id) => api.patch(url(id, "undo-send")),
  // Lotes de pedido: empacar la línea fabricada (uno) o varios completados.
  packManufactured: (orderId, index) => api.patch(lineUrl(orderId, index, "pack-manufactured")),
  unpackManufactured: (orderId, index) => api.patch(lineUrl(orderId, index, "unpack-manufactured")),
  packCompleted: (batchIds) => api.post("/productionBatches/pack-completed", { batchIds }),
};
