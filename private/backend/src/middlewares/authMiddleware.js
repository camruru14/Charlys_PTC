import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";

/**
 * Middleware que valida la cookie de sesión (authCookie). El sistema ya no
 * maneja roles/permisos (un solo tipo de usuario): cualquier empleado
 * autenticado puede usar cualquier ruta, así que esto solo comprueba que la
 * sesión exista y sea válida.
 */
export const validateAuthCookie = () => {
  return (req, res, next) => {
    try {
      //#1- Extraer el token que está en la cookie (authCookie)
      const { authCookie } = req.cookies;

      if (!authCookie) {
        return res
          .status(403)
          .json({ message: "No cookie found, Authorization required" });
      }

      //Extraer toda la información de la cookie
      const decoded = jsonwebtoken.verify(authCookie, config.JWT.secret);

      // Dejamos disponible el usuario decodificado para los controladores
      req.user = decoded;

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        // Cookie firmada con un secreto viejo, corrupta o expirada:
        // la limpiamos para que el cliente no quede atascado reenviándola.
        res.clearCookie("authCookie");
        return res.status(401).json({ message: "Invalid or expired session" });
      }

      console.log("error " + error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};
