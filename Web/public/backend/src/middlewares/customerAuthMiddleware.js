import jsonwebtoken from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../../config.js";
import customerModel from "../models/Customer.js";

// Cookie separada de la del panel privado (authCookie es de empleados) para
// que ambos sistemas puedan convivir sin pisarse si algún día comparten
// dominio.
export const CUSTOMER_COOKIE_NAME = "customerAuthCookie";

// Sesión de cliente: JWT de 30 días con la audiencia «store» y la versión de
// sesiones del cliente (`tv`). El panel privado exige la audiencia «panel», así
// que un token de cliente no sirve allá (ni al revés). Subir
// Customer.tokenVersion (cambio de contraseña) cierra todas las sesiones abiertas.
export const CUSTOMER_AUDIENCE = "store";
const SESSION_DAYS = 30;

export const signCustomerToken = (customer) =>
  jsonwebtoken.sign({ id: customer._id, tv: customer.tokenVersion || 0 }, config.JWT.secret, {
    expiresIn: `${SESSION_DAYS}d`,
    audience: CUSTOMER_AUDIENCE,
  });

const cookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax" };
};

export const setCustomerCookie = (res, token) =>
  res.cookie(CUSTOMER_COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });

export const clearCustomerCookie = (res) => res.clearCookie(CUSTOMER_COOKIE_NAME, cookieOptions());

// Middleware que exige una sesión de cliente válida (checkout, "Mis
// pedidos", datos de cuenta): el JWT firmado y con la audiencia «store», y el
// cliente existe, está activo y su versión de sesiones coincide.
export const requireCustomerAuth = () => {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[CUSTOMER_COOKIE_NAME];

      if (!token) {
        return res.status(401).json({ message: "Debes iniciar sesión." });
      }

      const decoded = jsonwebtoken.verify(token, config.JWT.secret, { audience: CUSTOMER_AUDIENCE });
      const customer = mongoose.isValidObjectId(decoded.id)
        ? await customerModel.findById(decoded.id).select("isActive tokenVersion").lean()
        : null;
      if (!customer || !customer.isActive || decoded.tv !== (customer.tokenVersion || 0)) {
        clearCustomerCookie(res);
        return res.status(401).json({ message: "Sesión inválida o expirada." });
      }

      req.customer = decoded; // { id, tv }
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        clearCustomerCookie(res);
        return res.status(401).json({ message: "Sesión inválida o expirada." });
      }
      console.error("error " + error);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};
