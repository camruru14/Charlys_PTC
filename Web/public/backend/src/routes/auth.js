import express from "express";
import authController from "../controller/authController.js";
import { requireCustomerAuth } from "../middlewares/customerAuthMiddleware.js";
import { loginLimiter } from "../middlewares/limiter.js";

const router = express.Router();

router.route("/register").post(authController.register);
router.route("/login").post(loginLimiter, authController.login);
router.route("/logout").post(authController.logout);
router
  .route("/me")
  .get(requireCustomerAuth(), authController.me)
  .put(requireCustomerAuth(), authController.updateProfile);
router.route("/password").put(requireCustomerAuth(), authController.changePassword);

export default router;
