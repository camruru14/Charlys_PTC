import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";
import employeeModel from "../models/Employee.js";

// Autenticación de administración del catálogo público (crear/editar/
// eliminar productos e imágenes): usa la MISMA cookie de sesión que el panel
// privado ("authCookie", firmada con el JWT_Secret_key de empleados — mismo
// .env, misma base de datos), en vez de una llave estática por header. Así
// cualquier empleado que ya inició sesión en private/frontend puede
// administrar el catálogo desde ahí mismo, sin un mecanismo de auth aparte.
// Copia del patrón de private/backend/src/middlewares/authMiddleware.js, con
// un paso extra: confirma que el empleado siga existiendo y activo, ya que
// este backend no tiene forma de saberlo por otro lado.
export const requireEmployeeAuth = () => {
  return async (req, res, next) => {
    try {
      const { authCookie } = req.cookies;

      if (!authCookie) {
        return res
          .status(403)
          .json({ message: "No cookie found, Authorization required" });
      }

      const decoded = jsonwebtoken.verify(authCookie, config.JWT.secret);

      const employee = await employeeModel.findById(decoded.id).select("-password");
      if (!employee || !employee.isActive) {
        return res.status(401).json({ message: "Access denied" });
      }

      req.employee = employee;
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        res.clearCookie("authCookie");
        return res.status(401).json({ message: "Invalid or expired session" });
      }

      console.log("error " + error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};
