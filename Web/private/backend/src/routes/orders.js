import express from "express";
import ordersController from "../controller/ordersController.js";
import { requireAdministrator } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Los pedidos solo los crea el checkout de la tienda (public/backend): el
// panel los consulta, los hace avanzar y elimina los ya entregados. No hay
// POST ni PUT.
router.route("/").get(ordersController.getOrders);

// Verificar varias líneas de uno o varios pedidos, todo o nada (Inventario >
// Pedidos: «Verificar todo» y «Verificar seleccionados»).
router.route("/verify-bulk").post(ordersController.verifyBulk);

// Eliminar un pedido entregado: solo administradores (403 si no).
router
  .route("/:id")
  .get(ordersController.getOrder)
  .delete(requireAdministrator(), ordersController.deleteOrder);

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

export default router;
