import express from "express";
import ordersController from "../controller/ordersController.js";

const router = express.Router();

router
  .route("/")
  .get(ordersController.getOrders)
  .post(ordersController.insertOrder);

router
  .route("/:id")
  .get(ordersController.getOrder)
  .put(ordersController.updateOrder)
  .delete(ordersController.deleteOrder);

// Avanzar el estado del pedido en su ciclo de vida
router.route("/:id/status").patch(ordersController.updateStatus);

// Asignar motorista / vehículo (Logística)
router.route("/:id/delivery").patch(ordersController.assignDelivery);

// Solicitar / quitar solicitud a Inventario (pestaña "Pedidos" en Inventario)
router
  .route("/:id/request-inventory")
  .patch(ordersController.requestInventory)
  .delete(ordersController.cancelInventoryRequest);

// Verificar / empacar un producto del pedido (Inventario > Pedidos)
router.route("/:id/items/:index/verify").patch(ordersController.verifyOrderItem);
router.route("/:id/items/:index/pack").patch(ordersController.packOrderItem);

// Enviar / quitar un producto del pedido de Fabricación (Inventario >
// Pedidos lo envía; Fabricación > Pedidos lo puede quitar con "Eliminar").
router
  .route("/:id/items/:index/send-manufacturing")
  .patch(ordersController.sendItemToManufacturing)
  .delete(ordersController.cancelManufacturingRequest);

// Fabricar un producto enviado a Fabricación (Fabricación > Pedidos): crea
// el lote correspondiente en Lotes de fabricación.
router.route("/:id/items/:index/manufacture").patch(ordersController.manufactureOrderItem);

// Empacar un producto ya fabricado para este pedido (Fabricación > Fabricación
// de pedidos), sin pasar por Inventario.
router.route("/:id/items/:index/pack-manufactured").patch(ordersController.packManufacturedItem);

// Confirmar que el motorista recogió lo que le tocaba en Almacén o
// Fabricación (checklist de recolección, Logística).
router.route("/:id/delivery/pickup").patch(ordersController.confirmPickup);

export default router;
