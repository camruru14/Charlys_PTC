const authController = {};

import bcryptjs from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import customerModel from "../models/Customer.js";
import { config } from "../../config.js";
import { CUSTOMER_COOKIE_NAME } from "../middlewares/customerAuthMiddleware.js";

const publicCustomer = (customer) => ({
  id: customer._id,
  name: customer.name,
  lastName: customer.lastName,
  email: customer.email,
  phone: customer.phone,
  addresses: customer.addresses,
});

// REGISTRO de un cliente nuevo
authController.register = async (req, res) => {
  const { name, lastName, email, password, phone } = req.body;

  try {
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nombre, correo y contraseña son obligatorios." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 8 caracteres." });
    }

    const existing = await customerModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Ese correo ya está registrado." });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newCustomer = new customerModel({
      name,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
    });

    await newCustomer.save();

    const token = jsonwebtoken.sign({ id: newCustomer._id }, config.JWT.secret, {
      expiresIn: "30d",
    });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(201).json({
      message: "Cuenta creada correctamente.",
      customer: publicCustomer(newCustomer),
    });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// LOGIN
authController.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const customerFound = await customerModel.findOne({ email: email?.toLowerCase() });

    if (!customerFound) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    if (!customerFound.isActive) {
      return res.status(403).json({ message: "Cuenta desactivada." });
    }

    const isMatch = await bcryptjs.compare(password, customerFound.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Correo o contraseña inválidos." });
    }

    const token = jsonwebtoken.sign({ id: customerFound._id }, config.JWT.secret, {
      expiresIn: "30d",
    });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.json({
      message: "Sesión iniciada correctamente.",
      customer: publicCustomer(customerFound),
    });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// LOGOUT
authController.logout = async (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(CUSTOMER_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  res.json({ message: "Sesión cerrada." });
};

// ACTUALIZAR PERFIL (nombre, apellido, teléfono, dirección). El correo no se
// toca acá porque es el identificador de la cuenta. La pantalla de Perfil
// solo maneja una dirección (igual que el checkout), así que se actualiza la
// que ya esté marcada como predeterminada, o se crea la primera si el
// cliente todavía no tenía ninguna.
authController.updateProfile = async (req, res) => {
  const { name, lastName, phone, address } = req.body;

  try {
    if (!name?.trim()) {
      return res.status(400).json({ message: "El nombre es obligatorio." });
    }

    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    customer.name = name;
    customer.lastName = lastName;
    customer.phone = phone;

    if (typeof address === "string") {
      const defaultAddress = customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
      if (defaultAddress) {
        defaultAddress.address = address;
      } else if (address.trim()) {
        customer.addresses.push({ address, isDefault: true });
      }
    }

    await customer.save();

    res.json({ message: "Perfil actualizado.", customer: publicCustomer(customer) });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// CAMBIAR CONTRASEÑA sabiendo la actual (distinto del flujo de "olvidé mi
// contraseña" por correo, ver recoveryPasswordController.js).
authController.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres." });
    }

    const customer = await customerModel.findById(req.customer.id);
    if (!customer) {
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }

    const matches = await bcryptjs.compare(currentPassword || "", customer.password);
    if (!matches) {
      return res.status(401).json({ message: "La contraseña actual es incorrecta." });
    }

    customer.password = await bcryptjs.hash(newPassword, 10);
    await customer.save();

    res.json({ message: "Contraseña actualizada." });
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
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
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default authController;
