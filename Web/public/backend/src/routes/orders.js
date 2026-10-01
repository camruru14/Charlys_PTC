import express from "express";
import ordersController from "../controller/ordersController.js";
import { requireCustomerAuth } from "../middlewares/customerAuthMiddleware.js";

const router = express.Router();

router.route("/checkout").post(requireCustomerAuth(), ordersController.checkout);
router.route("/mine").get(requireCustomerAuth(), ordersController.getMyOrders);
router.route("/:id").get(requireCustomerAuth(), ordersController.getMyOrder);

export default router;
