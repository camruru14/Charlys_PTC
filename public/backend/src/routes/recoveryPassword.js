import express from "express";
import recoveryPasswordController from "../controller/recoveryPasswordController.js";

const router = express.Router();

router.route("/request-code").post(recoveryPasswordController.requestCode);
router.route("/verify-code").post(recoveryPasswordController.verifyCode);
router.route("/new-password").post(recoveryPasswordController.newPassword);

export default router;
