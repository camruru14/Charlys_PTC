const recoveryPasswordController = {};

import bcryptjs from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import HTMLRecoveryEmail from "../utils/sendMailRecovery.js";
import { sendMail } from "../utils/mailer.js";

import customerModel from "../models/Customer.js";
import passwordResetModel from "../models/PasswordReset.js";
import { ValidationError, checkNewPassword, normalizeEmailOrNull } from "../utils/validation.js";

// Recuperación de contraseña en 3 pasos por código (no por link de un clic):
// pedir código al correo -> verificar código -> escribir la nueva contraseña.
//
// El código NO viaja en ninguna cookie ni JWT (un JWT no está cifrado: cualquiera
// podría leerlo en su propio navegador). El servidor guarda solo
// sha256(code + resetId) en un PasswordReset; el cliente solo recibe el
// `resetId` (el _id de ese documento) y lo manda en los pasos 2 y 3. El estado del
// proceso (verifiedAt, usedAt, intentos, vencimiento) vive en la base de datos.
const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;

// Mismo mensaje para cualquier fallo al verificar el código (código malo, vencido,
// agotado o un resetId que no existe): no se revela si el correo tiene cuenta.
const BAD_CODE = "El código es incorrecto o ya venció. Revisa el correo o solicita uno nuevo.";
const BAD_RESET = "La solicitud venció o no es válida. Vuelve a pedir un código.";

const hashCode = (code, resetId) => crypto.createHash("sha256").update(`${code}${resetId}`).digest("hex");

const isResetId = (value) => typeof value === "string" && mongoose.isValidObjectId(value) && /^[0-9a-f]{24}$/i.test(value);

function sendError(res, error) {
  if (error instanceof ValidationError) return res.status(400).json({ message: error.message });
  console.error("error " + error);
  return res.status(500).json({ message: "Error interno del servidor." });
}

// Envía el correo sin que la respuesta lo espere: así la petición tarda lo mismo
// exista o no la cuenta. Si falla solo queda en el log.
function sendRecoveryMail(to, code) {
  sendMail({
    to,
    subject: "Recupera tu contraseña de Industrias Charly",
    html: HTMLRecoveryEmail(code),
  }).catch((error) => console.error("error al enviar el código de recuperación: " + (error?.message || error)));
}

// PASO 1: genera el código y lo manda por correo. Responde SIEMPRE lo mismo (200
// con un resetId) exista o no la cuenta; si no existe, el resetId es aleatorio y
// no se guarda nada.
recoveryPasswordController.requestCode = async (req, res) => {
  try {
    const email = normalizeEmailOrNull(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: "Escribe un correo válido." });
    }

    const userFound = await customerModel.findOne({ email });
    let resetId = new mongoose.Types.ObjectId().toString();

    if (userFound?.isActive) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      const reset = new passwordResetModel({
        customer: userFound._id,
        codeHash: "pendiente",
        expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
      });
      resetId = String(reset._id);
      reset.codeHash = hashCode(code, resetId);
      // Las escrituras y el correo NO se esperan: si se esperaran, la respuesta tardaría más cuando la
      // cuenta existe y el tiempo de respuesta revelaría si el correo está registrado. Un código nuevo
      // invalida los anteriores sin usar de esa cuenta; el correo sale solo si el código se guardó.
      passwordResetModel
        .deleteMany({ customer: userFound._id, usedAt: null })
        .then(() => reset.save())
        .then(() => sendRecoveryMail(userFound.email, code))
        .catch((error) => console.error("error al guardar el código de recuperación: " + error));
    }

    return res.status(200).json({ message: "Si el correo está registrado, te enviamos un código", resetId });
  } catch (error) {
    sendError(res, error);
  }
};

// PASO 2: compara el código contra el hash guardado. Máximo 5 intentos: cada
// intento se cuenta ANTES de comparar (atómico), así que ni las peticiones en
// paralelo permiten más; al llegar al límite el reset ya no sirve.
recoveryPasswordController.verifyCode = async (req, res) => {
  try {
    const { resetId, code } = req.body ?? {};
    if (!isResetId(resetId) || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ message: BAD_CODE });
    }

    const now = new Date();
    const reset = await passwordResetModel.findOneAndUpdate(
      { _id: resetId, usedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    if (!reset) {
      return res.status(400).json({ message: BAD_CODE });
    }

    const expected = Buffer.from(reset.codeHash, "hex");
    const received = Buffer.from(hashCode(code.trim(), resetId), "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ message: BAD_CODE });
    }

    await passwordResetModel.updateOne({ _id: reset._id }, { $set: { verifiedAt: now } });

    return res.status(200).json({ message: "Código verificado correctamente" });
  } catch (error) {
    sendError(res, error);
  }
};

// PASO 3: exige el reset ya verificado (sin usar ni vencido) y escribe la nueva
// contraseña. Se "gasta" el reset de forma atómica antes de cambiarla, así el mismo
// reset no sirve dos veces. Cambiar la contraseña cierra las sesiones abiertas de la
// cuenta (tokenVersion).
recoveryPasswordController.newPassword = async (req, res) => {
  try {
    const { resetId, newPassword, confirmNewPassword } = req.body ?? {};

    if (typeof newPassword !== "string" || newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden" });
    }
    checkNewPassword(newPassword, "La nueva contraseña");
    if (!isResetId(resetId)) {
      return res.status(400).json({ message: BAD_RESET });
    }

    const now = new Date();
    const reset = await passwordResetModel.findOneAndUpdate(
      { _id: resetId, verifiedAt: { $ne: null }, usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { returnDocument: "after" },
    );
    if (!reset) {
      return res.status(400).json({ message: "Primero debes verificar el código, o la solicitud ya venció. Vuelve a pedir un código." });
    }

    try {
      const passwordHash = await bcryptjs.hash(newPassword, 10);
      await customerModel.updateOne({ _id: reset.customer }, { $set: { password: passwordHash }, $inc: { tokenVersion: 1 } });
    } catch (error) {
      // No se pudo guardar: el reset vuelve a estar disponible para reintentar.
      await passwordResetModel.updateOne({ _id: reset._id }, { $set: { usedAt: null } }).catch(() => null);
      throw error;
    }

    return res.status(200).json({ message: "Contraseña actualizada" });
  } catch (error) {
    sendError(res, error);
  }
};

export default recoveryPasswordController;
