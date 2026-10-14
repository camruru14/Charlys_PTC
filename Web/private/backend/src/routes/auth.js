import express from "express";
import authController from "../controller/authController.js";
import { validateAuthCookie } from "../middlewares/authMiddleware.js";
import { uploadEmployeePhoto } from "../lib/cloudinary.js";
import { loginLimiter } from "../middlewares/limiter.js";

const router = express.Router();

router.route("/login").post(loginLimiter, authController.login);
router.route("/logout").post(authController.logout);

// Mi cuenta (Configuración): datos del empleado con la sesión abierta.
router.route("/me").get(validateAuthCookie(), authController.getMe).put(validateAuthCookie(), authController.updateMe);
router.route("/me/photo").post(validateAuthCookie(), uploadEmployeePhoto.single("photo"), authController.setPhoto).delete(validateAuthCookie(), authController.removePhoto);
router.route("/me/password").get(validateAuthCookie(), authController.getMyPassword);
router.route("/me/credentials").put(validateAuthCookie(), authController.updateCredentials);

export default router;
