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

export default router;
