const authController = {};

import employeeModel from "../models/Employee.js";
import { encryptPassword, readablePassword, verifyPassword } from "../lib/passwordCrypto.js";
import { clearSessionCookie, setSessionCookie, signSessionToken } from "../lib/session.js";
import { isAdministratorId } from "../lib/permissions.js";
import { checkPassword, normalizeDui, normalizeEmail, normalizeName, sendEmployeeError } from "../lib/employeeFields.js";
import cloudinary, { uploadEmployeePhotoBuffer } from "../lib/cloudinary.js";

// Mismo mensaje para un correo que no existe y para una contraseña mala: así no
// se puede averiguar qué correos tienen cuenta.
const BAD_CREDENTIALS = "Correo o contraseña incorrectos";

// LOGIN del panel administrativo (empleados)
authController.login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: BAD_CREDENTIALS });
    }

    //#1- Buscar el empleado por su correo (normalizado, como se guarda)
    let normalizedEmail;
    try {
      normalizedEmail = normalizeEmail(email);
    } catch {
      return res.status(401).json({ message: BAD_CREDENTIALS });
    }
    const employeeFound = await employeeModel.findOne({ email: normalizedEmail });
    if (!employeeFound) {
      return res.status(401).json({ message: BAD_CREDENTIALS });
    }

    //#2- Validar la contraseña: formato encriptado nuevo o hash bcrypt viejo
    // (ver lib/passwordCrypto.js)
    const isMatch = await verifyPassword(password, employeeFound.password);
    if (!isMatch) {
      return res.status(401).json({ message: BAD_CREDENTIALS });
    }

    //#3- Solo con la contraseña correcta se avisa que la cuenta está desactivada
    if (!employeeFound.isActive) {
      return res.status(403).json({ message: "Tu cuenta está desactivada. Habla con un administrador." });
    }

    //#4- Generar el token de sesión (30 días, audiencia «panel» y versión de
    // tokens; ver lib/session.js y authMiddleware.js)
    const isAdmin = await isAdministratorId(employeeFound._id);
    const token = signSessionToken(employeeFound);
    setSessionCookie(res, token);
    res.json({
      message: "Login successful",
      // El panel web sigue usando la cookie httpOnly; el token también
      // va en el cuerpo para clientes que no pueden usar cookies
      // (la app móvil, que lo manda como header Authorization: Bearer).
      token,
      user: {
        id: employeeFound._id,
        name: employeeFound.name,
        lastName: employeeFound.lastName,
        email: employeeFound.email,
        position: employeeFound.position,
        department: employeeFound.department,
        photoUrl: employeeFound.photo?.url || null,
        // Quien puede hacer acciones delicadas (eliminar pedidos): ver lib/permissions.js
        isAdmin,
      },
    });
  } catch (error) {
    console.log("error" + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// ---- Mi cuenta: datos del empleado que tiene la sesión abierta (req.user.id,
// ver authMiddleware.js). Para editar a OTRO empleado está /employees/:id
// (Configuración > Personal y permisos).

const toAccount = (e, isAdmin) => ({
  id: e._id,
  name: e.name,
  lastName: e.lastName,
  email: e.email,
  phone: e.phone || "",
  dui: e.dui || "",
  position: e.position || "",
  department: e.department || "",
  photoUrl: e.photo?.url || null,
  isAdmin: Boolean(isAdmin),
});

async function findSessionEmployee(req, res) {
  const employee = await employeeModel.findById(req.user?.id);
  if (!employee || !employee.isActive) {
    res.status(404).json({ message: "No se encontró tu cuenta" });
    return null;
  }
  return employee;
}

// GET /auth/me
authController.getMe = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (employee) res.json(toAccount(employee, await isAdministratorId(employee._id)));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// GET /auth/me/password: la contraseña propia en texto plano, para el ojo
// de «Contraseña actual» en Mi cuenta. { password, legacy } como en
// GET /employees/:id/password.
authController.getMyPassword = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (employee) res.json(readablePassword(employee.password));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// PUT /auth/me { name?, lastName?, phone?, dui? }: datos que no piden contraseña.
authController.updateMe = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;
    const body = req.body ?? {};
    if (body.name !== undefined) employee.name = normalizeName(body.name, "tu nombre");
    if (body.lastName !== undefined) employee.lastName = normalizeName(body.lastName, "tu apellido");
    employee.phone = typeof body.phone === "string" ? body.phone.trim() : employee.phone;
    if (body.dui !== undefined) employee.dui = normalizeDui(body.dui);
    await employee.save();
    res.json(toAccount(employee, await isAdministratorId(employee._id)));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// Borra la foto de Cloudinary sin fallar si ya no existe.
const destroyPhoto = (photo) => (photo?.publicId ? cloudinary.uploader.destroy(photo.publicId).catch(() => null) : null);

// POST /auth/me/photo (multipart, campo "photo"): sube la foto nueva, la guarda
// y borra la anterior; si no se pudo guardar, borra la recién subida.
authController.setPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Selecciona una imagen" });
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;

    const uploaded = await uploadEmployeePhotoBuffer(req.file.buffer);
    const previous = employee.photo;
    try {
      employee.photo = { url: uploaded.secure_url, publicId: uploaded.public_id };
      await employee.save();
    } catch (error) {
      await destroyPhoto({ publicId: uploaded.public_id });
      throw error;
    }
    if (previous?.publicId && previous.publicId !== uploaded.public_id) await destroyPhoto(previous);
    res.json(toAccount(employee, await isAdministratorId(employee._id)));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// DELETE /auth/me/photo: quita la foto de perfil (vuelven las iniciales).
authController.removePhoto = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;
    const previous = employee.photo;
    employee.photo = undefined;
    await employee.save();
    await destroyPhoto(previous);
    res.json(toAccount(employee, await isAdministratorId(employee._id)));
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// PUT /auth/me/credentials { currentPassword, email?, newPassword? }:
// cambiar el correo (con el que se inicia sesión) o la contraseña siempre
// pide la contraseña actual.
authController.updateCredentials = async (req, res) => {
  try {
    const employee = await findSessionEmployee(req, res);
    if (!employee) return;

    const { currentPassword, email, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || !currentPassword || !(await verifyPassword(currentPassword, employee.password))) {
      return res.status(400).json({ message: "La contraseña actual no es correcta" });
    }

    const nextEmail = email !== undefined && email !== "" ? normalizeEmail(email) : employee.email;
    if (nextEmail === employee.email && !newPassword) {
      return res.status(400).json({ message: "No hay cambios que guardar" });
    }
    employee.email = nextEmail;
    if (newPassword) employee.password = encryptPassword(checkPassword(newPassword));
    // Cambiar el correo o la contraseña cierra las demás sesiones de la cuenta
    // (tokenVersion); a esta se le entrega un token nuevo para que siga abierta.
    employee.tokenVersion = (employee.tokenVersion || 0) + 1;
    await employee.save();
    const token = signSessionToken(employee);
    setSessionCookie(res, token);
    res.json({ ...toAccount(employee, await isAdministratorId(employee._id)), token });
  } catch (error) {
    sendEmployeeError(res, error);
  }
};

// LOGOUT
authController.logout = async (req, res) => {
  clearSessionCookie(res);
  res.json({ message: "Logout successful" });
};

export default authController;
