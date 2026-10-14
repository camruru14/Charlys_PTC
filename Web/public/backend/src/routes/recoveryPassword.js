import express from "express";
import recoveryPasswordController from "../controller/recoveryPasswordController.js";
import { requestCodeEmailLimiter, requestCodeIpLimiter, verifyCodeLimiter } from "../middlewares/limiter.js";

const router = express.Router();

router.route("/request-code").post(requestCodeIpLimiter, requestCodeEmailLimiter, recoveryPasswordController.requestCode);
router.route("/verify-code").post(verifyCodeLimiter, recoveryPasswordController.verifyCode);
router.route("/new-password").post(recoveryPasswordController.newPassword);

export default router;
