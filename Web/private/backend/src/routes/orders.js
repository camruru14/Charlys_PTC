import express from "express";
import ordersController from "../controller/ordersController.js";

const router = express.Router();

router
  .route("/")
  .get(ordersController.getOrders)
  .post(ordersController.insertOrder);

// Verificar varias líneas de uno o varios pedidos, todo o nada (Inventario >
// Pedidos: «Verificar todo» y «Verificar seleccionados»).
router.route("/verify-bulk").post(ordersController.verifyBulk);

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

// Verificar / empacar un producto del pedido (Inventario > Pedidos), con su
// deshacer: unverify devuelve el stock; unpack solo si no se recogió.
router.route("/:id/items/:index/verify").patch(ordersController.verifyOrderItem);
router.route("/:id/items/:index/unverify").patch(ordersController.unverifyOrderItem);
router.route("/:id/items/:index/pack").patch(ordersController.packOrderItem);
router.route("/:id/items/:index/unpack").patch(ordersController.unpackOrderItem);

// Existencia parcial: tomar parte de una bodega y fabricar el resto en la
// misma línea (DELETE lo deshace mientras el lote siga Programado).
router
  .route("/:id/items/:index/split-partial")
  .patch(ordersController.splitPartialItem)
  .delete(ordersController.unsplitPartialItem);

// Enviar a fabricación (crea el lote Programado en el mismo clic). DELETE lo
// deshace: borra el lote si sigue Programado y la línea vuelve a sin procesar.
router
  .route("/:id/items/:index/send-manufacturing")
  .patch(ordersController.sendItemToManufacturing)
  .delete(ordersController.cancelManufacturingRequest);

// Alias de send-manufacturing (también crea el lote de una línea enviada
// antes sin lote).
router.route("/:id/items/:index/manufacture").patch(ordersController.manufactureOrderItem);

// Empacar un producto ya fabricado para este pedido (Fabricación > Pedidos),
// sin pasar por Inventario, y su deshacer (solo si no se recogió).
router.route("/:id/items/:index/pack-manufactured").patch(ordersController.packManufacturedItem);
router.route("/:id/items/:index/unpack-manufactured").patch(ordersController.unpackManufacturedItem);

// Confirmar que el motorista recogió lo que le tocaba en Almacén o
// Fabricación (checklist de recolección, Logística).
router.route("/:id/delivery/pickup").patch(ordersController.confirmPickup);

export default router;
