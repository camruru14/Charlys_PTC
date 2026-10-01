import express from "express";
import routesController from "../controller/routesController.js";

const router = express.Router();

// Rutas de Logística: un motorista y un vehículo recogen en Almacén y/o
// Fabricación y entregan varios pedidos parada por parada.
router.route("/").get(routesController.getRoutes).post(routesController.createRoute);

// Motoristas y vehículos con su disponibilidad del día (antes de /:id).
router.get("/availability", routesController.getAvailability);

router
  .route("/:id")
  .get(routesController.getRoute)
  .patch(routesController.updateRoute)
  .delete(routesController.deleteRoute);

router.post("/:id/orders", routesController.addOrder);
router.delete("/:id/orders/:orderId", routesController.removeOrder);
router.patch("/:id/pickup", routesController.confirmPickup);
router.patch("/:id/depart", routesController.depart);
router.patch("/:id/orders/:orderId/deliver", routesController.deliverOrder);
router.patch("/:id/orders/:orderId/undeliver", routesController.undeliverOrder);

export default router;
