const authController = {};

import bcryptjs from "bcryptjs";
import customerModel from "../models/Customer.js";
import {
  clearCustomerCookie,
  setCustomerCookie,
  signCustomerToken,
} from "../middlewares/customerAuthMiddleware.js";
import { ValidationError, checkNewPassword, normalizeEmailOrNull, optionalText, requiredText } from "../utils/validation.js";

const publicCustomer = (customer) => ({
  id: customer._id,
  name: customer.name,
  lastName: customer.lastName,
  email: customer.email,
  phone: customer.phone,
  addresses: customer.addresses,
});

// Mismo mensaje para un correo que no existe y para una contraseña mala: así no
// se puede averiguar qué correos tienen cuenta.
const BAD_CREDENTIALS = "Correo o contraseña incorrectos";

// Hash de relleno: con un correo inexistente también se hace una comparación bcrypt,
// para que la respuesta no tarde menos que con una cuenta real.
const DUMMY_HASH = bcryptjs.hashSync("relleno-sin-cuenta", 10);

const MAX_NAME = 60;
const MAX_PHONE = 30;
const MAX_ADDRESS = 250;

// Responde un error: los de validación con su mensaje (400); el resto, 500 sin detalles.
function sendError(res, error) {
  if (error instanceof ValidationError) return res.status(400).json({ message: error.message });
  console.error("error " + error);
  return res.status(500).json({ message: "Error interno del servidor." });
}

// REGISTRO de un cliente nuevo
authController.register = async (req, res) => {
  try {
    const { name, lastName, email, password, phone } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string" || !name.trim() || !email.trim() || !password) {
      return res
        .status(400)
        .json({ message: "Nombre, correo y contraseña son obligatorios." });
    }

    const normalizedEmail = normalizeEmailOrNull(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: "Escribe un correo válido." });
    }
    checkNewPassword(password);

    const existing = await customerModel.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "Ese correo ya está registrado." });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newCustomer = new customerModel({
      name: requiredText(name, MAX_NAME, "El nombre"),
      lastName: optionalText(lastName, MAX_NAME, "El apellido"),
      email: normalizedEmail,
      password: hashedPassword,
      phone: optionalText(phone, MAX_PHONE, "El teléfono"),
    });

    await newCustomer.save();

    setCustomerCookie(res, signCustomerToken(newCustomer));

    res.status(201).json({
      message: "Cuenta creada correctamente.",
      customer: publicCustomer(newCustomer),
    });
  } catch (error) {
    sendError(res, error);
  }
};

// LOGIN
authController.login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: BAD_CREDENTIALS });
    }

    const customerFound = await customerModel.findOne({ email: email.trim().toLowerCase() });

    const isMatch = await bcryptjs.compare(password, customerFound ? customerFound.password : DUMMY_HASH);
    if (!customerFound || !isMatch) {
      return res.status(401).json({ message: BAD_CREDENTIALS });
    }

    // Solo con la contraseña correcta se avisa que la cuenta está desactivada.
    if (!customerFound.isActive) {
      return res.status(403).json({ message: "Cuenta desactivada." });
    }

    setCustomerCookie(res, signCustomerToken(customerFound));

    res.json({
      message: "Sesión iniciada correctamente.",
      customer: publicCustomer(customerFound),
    });
  } catch (error) {
    sendError(res, error);
  }
};

// LOGOUT
authController.logout = async (_req, res) => {
  clearCustomerCookie(res);
  res.json({ message: "Sesión cerrada." });
};

// ACTUALIZAR PERFIL (nombre, apellido, teléfono, dirección). El correo no se
// toca acá porque es el identificador de la cuenta. La pantalla de Perfil
// solo maneja una dirección (igual que el checkout), así que se actualiza la
// que ya esté marcada como predeterminada, o se crea la primera si el
// cliente todavía no tenía ninguna. Una dirección vacía quita la
// predeterminada (el esquema no admite direcciones sin texto).
authController.updateProfile = async (req, res) => {
  try {
    const { name, lastName, phone, address } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "El nombre es obligatorio." });
    }

    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    customer.name = requiredText(name, MAX_NAME, "El nombre");
    customer.lastName = optionalText(lastName, MAX_NAME, "El apellido");
    customer.phone = optionalText(phone, MAX_PHONE, "El teléfono");

    if (address !== undefined && address !== null) {
      if (typeof address !== "string") throw new ValidationError("La dirección no es válida.");
      const text = address.trim();
      if (text.length > MAX_ADDRESS) throw new ValidationError(`La dirección no puede pasar de ${MAX_ADDRESS} caracteres.`);
      const defaultAddress = customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
      if (text) {
        if (defaultAddress) {
          defaultAddress.address = text;
        } else {
          customer.addresses.push({ address: text, isDefault: true });
        }
      } else if (defaultAddress) {
        customer.addresses.pull(defaultAddress._id);
      }
    }

    await customer.save();

    res.json({ message: "Perfil actualizado.", customer: publicCustomer(customer) });
  } catch (error) {
    sendError(res, error);
  }
};

// CAMBIAR CONTRASEÑA sabiendo la actual (distinto del flujo de "olvidé mi
// contraseña" por correo, ver recoveryPasswordController.js). Cierra las demás
// sesiones (tokenVersion) y le da a esta un token nuevo para que siga abierta.
authController.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    checkNewPassword(newPassword, "La nueva contraseña");

    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const matches = typeof currentPassword === "string" && (await bcryptjs.compare(currentPassword, customer.password));
    if (!matches) {
      return res.status(401).json({ message: "La contraseña actual es incorrecta." });
    }

    customer.password = await bcryptjs.hash(newPassword, 10);
    customer.tokenVersion = (customer.tokenVersion || 0) + 1;
    await customer.save();
    setCustomerCookie(res, signCustomerToken(customer));

    res.json({ message: "Contraseña actualizada." });
  } catch (error) {
    sendError(res, error);
  }
};

// PERFIL del cliente autenticado
authController.me = async (req, res) => {
  try {
    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }
    res.json({ customer: publicCustomer(customer) });
  } catch (error) {
    sendError(res, error);
  }
};

export default authController;
