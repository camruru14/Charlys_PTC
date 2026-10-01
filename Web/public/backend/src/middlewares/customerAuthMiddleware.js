import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";

// Cookie separada de la del panel privado (authCookie es de empleados) para
// que ambos sistemas puedan convivir sin pisarse si algún día comparten
// dominio.
export const CUSTOMER_COOKIE_NAME = "customerAuthCookie";

// Middleware que exige una sesión de cliente válida (checkout, "Mis
// pedidos", datos de cuenta).
export const requireCustomerAuth = () => {
  return (req, res, next) => {
    try {
      const token = req.cookies?.[CUSTOMER_COOKIE_NAME];

      if (!token) {
        return res.status(401).json({ message: "Debes iniciar sesión." });
      }

      const decoded = jsonwebtoken.verify(token, config.JWT.secret);
      req.customer = decoded; // { id }
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        const isProduction = process.env.NODE_ENV === "production";
        res.clearCookie(CUSTOMER_COOKIE_NAME, {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
        });
        return res.status(401).json({ message: "Sesión inválida o expirada." });
      }
      console.log("error " + error);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};

// Variante que NO bloquea si no hay sesión (útil en rutas donde el cliente
// puede o no estar logueado), pero adjunta req.customer si la cookie es
// válida.
export const attachCustomerIfPresent = () => {
  return (req, _res, next) => {
    try {
      const token = req.cookies?.[CUSTOMER_COOKIE_NAME];
      if (token) {
        req.customer = jsonwebtoken.verify(token, config.JWT.secret);
      }
    } catch {
      // Cookie inválida/expirada: seguimos como invitado, no es un error.
    }
    next();
  };
};
