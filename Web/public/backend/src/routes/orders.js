import express from "express";
import ordersController from "../controller/ordersController.js";
import { requireCustomerAuth } from "../middlewares/customerAuthMiddleware.js";
import { checkoutCustomerLimiter, checkoutIpLimiter } from "../middlewares/limiter.js";

const router = express.Router();

// Pagar: máximo 5 intentos cada 10 minutos por cliente y 10 por IP.
router.route("/checkout").post(checkoutIpLimiter, requireCustomerAuth(), checkoutCustomerLimiter, ordersController.checkout);
router.route("/mine").get(requireCustomerAuth(), ordersController.getMyOrders);
router.route("/:id").get(requireCustomerAuth(), ordersController.getMyOrder);

export default router;
