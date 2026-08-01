import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";

/**
 * Middleware que valida la cookie de sesión (authCookie) y comprueba
 * que el rol del usuario esté dentro de los roles permitidos.
 *
 * @param {string[]} allowedTypes Roles autorizados para el recurso.
 */
export const validateAuthCookie = (allowedTypes = []) => {
  return (req, res, next) => {
    try {
      //#1- Extraer el token que está en la cookie (authCookie)
      //ya que en esa cookie está el tipo de usuario que inició sesión
      const { authCookie } = req.cookies;

      if (!authCookie) {
        return res
          .status(403)
          .json({ message: "No cookie found, Authorization required" });
      }

      //Extraer toda la información de la cookie
      const decoded = jsonwebtoken.verify(authCookie, config.JWT.secret);

      if (allowedTypes.length > 0 && !allowedTypes.includes(decoded.userType)) {
        return res.status(401).json({ message: "Access denied" });
      }

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
