const recoveryPasswordController = {};

import jsonwebtoken from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import HTMLRecoveryEmail from "../utils/sendMailRecovery.js";

import { config } from "../../config.js";

import customerModel from "../models/Customer.js";

// Recuperación de contraseña en 3 pasos por código (no por link de un clic):
// pedir código al correo -> verificar código -> escribir la nueva
// contraseña. Los 3 pasos comparten una cookie temporal separada de la
// sesión normal ("recoveryCookie", distinta de CUSTOMER_COOKIE_NAME) que
// guarda un JWT de 15 minutos; ese JWT es la única fuente de verdad de en
// qué paso va el usuario, el frontend solo lleva el paso visual.

// PASO 1: genera el código y lo manda por correo
recoveryPasswordController.requestCode = async (req, res) => {
  try {
    const { email } = req.body;

    const userFound = await customerModel.findOne({ email: email?.toLowerCase() });
    if (!userFound) {
      return res.status(404).json({ message: "No existe una cuenta con ese correo" });
    }

    const code = crypto.randomBytes(3).toString("hex");

    const token = jsonwebtoken.sign(
      { email: userFound.email, code, userType: "customer", verified: false },
      config.JWT.secret,
      { expiresIn: "15m" },
    );

    res.cookie("recoveryCookie", token, {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.email.user_email,
        pass: config.email.user_password,
      },
    });

    const mailOptions = {
      from: config.email.user_email,
      to: userFound.email,
      subject: "Recupera tu contraseña de Industrias Charly",
      html: HTMLRecoveryEmail(code),
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "Código enviado, revisa tu correo" });
  } catch (error) {
    console.log("error " + error);
    return res.status(500).json({ message: "Error al enviar el correo" });
  }
};

// PASO 2: compara el código contra el que quedó firmado en la cookie
recoveryPasswordController.verifyCode = async (req, res) => {
  try {
    const { codeRequest } = req.body;

    const token = req.cookies?.recoveryCookie;
    if (!token) {
      return res.status(400).json({ message: "El código expiró, solicítalo de nuevo" });
    }

    const decoded = jsonwebtoken.verify(token, config.JWT.secret);

    if (codeRequest !== decoded.code) {
      return res.status(400).json({ message: "Código incorrecto" });
    }

    const newToken = jsonwebtoken.sign(
      { email: decoded.email, userType: "customer", verified: true },
      config.JWT.secret,
      { expiresIn: "15m" },
    );

    res.cookie("recoveryCookie", newToken, {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });

    return res.status(200).json({ message: "Código verificado correctamente" });
  } catch (error) {
    console.log("error " + error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// PASO 3: exige la cookie ya verificada y escribe la nueva contraseña
recoveryPasswordController.newPassword = async (req, res) => {
  try {
    const { newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden" });
    }

    const token = req.cookies?.recoveryCookie;
    if (!token) {
      return res.status(400).json({ message: "El código expiró, solicítalo de nuevo" });
    }

    const decoded = jsonwebtoken.verify(token, config.JWT.secret);

    if (!decoded.verified) {
      return res.status(400).json({ message: "Primero debes verificar el código" });
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);

    await customerModel.findOneAndUpdate(
      { email: decoded.email },
      { password: passwordHash },
      { new: true },
    );

    res.clearCookie("recoveryCookie");

    return res.status(200).json({ message: "Contraseña actualizada" });
  } catch (error) {
    console.log("error " + error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export default recoveryPasswordController;
