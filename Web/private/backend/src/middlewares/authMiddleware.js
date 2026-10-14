import jsonwebtoken from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../../config.js";
import employeeModel from "../models/Employee.js";
import { employeeModules, isAdministrator, isAdministratorId } from "../lib/permissions.js";
import { SESSION_AUDIENCE, clearSessionCookie } from "../lib/session.js";

/**
 * Middleware que valida la sesión del panel. Los módulos no se bloquean por
 * puesto (cualquier empleado autenticado puede usar las rutas del panel), pero
 * la sesión tiene que ser válida de verdad:
 *  - el JWT lleva la audiencia «panel» (un token sin ella, como los de la
 *    tienda, se rechaza) y no ha vencido;
 *  - el empleado existe, sigue activo y su `tv` coincide con
 *    Employee.tokenVersion (cambiar la contraseña o el correo, o desactivar la
 *    cuenta, cierra las sesiones abiertas; ver lib/session.js).
 * Las acciones sobre cuentas de empleados piden además requireAdministrator,
 * requireAdminOrSelf o requireSelfOrModule (más abajo).
 */
export const validateAuthCookie = () => {
  return async (req, res, next) => {
    try {
      //#1- Extraer el token: cookie (panel web) o header Authorization
      // Bearer (app móvil, que no puede usar cookies httpOnly)
      const { authCookie } = req.cookies;
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      const token = authCookie || bearerToken;

      if (!token) {
        return res
          .status(403)
          .json({ message: "No cookie found, Authorization required" });
      }

      //Extraer toda la información del token (firma, vencimiento y audiencia)
      const decoded = jsonwebtoken.verify(token, config.JWT.secret, { audience: SESSION_AUDIENCE });

      //#2- La cuenta debe existir, estar activa y tener la misma versión de tokens
      const employee = mongoose.isValidObjectId(decoded.id)
        ? await employeeModel.findById(decoded.id).select("isActive tokenVersion").lean()
        : null;
      if (!employee || !employee.isActive || decoded.tv !== (employee.tokenVersion || 0)) {
        clearSessionCookie(res);
        return res.status(401).json({ message: "Sesión inválida o expirada" });
      }

      // Dejamos disponible el usuario decodificado para los controladores
      req.user = decoded;

      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        // Cookie firmada con un secreto viejo, sin la audiencia del panel,
        // corrupta o expirada: la limpiamos para que el cliente no quede
        // atascado reenviándola.
        clearSessionCookie(res);
        return res.status(401).json({ message: "Sesión inválida o expirada" });
      }

      console.log("error " + error);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};

// `code`: los clientes (panel web y app) no lo confunden con una sesión vencida.
const adminOnly = (res) => res.status(403).json({ message: "Solo un administrador puede hacer esto", code: "ADMIN_ONLY" });

/**
 * Para acciones delicadas (eliminar un pedido, crear o borrar empleados): va
 * DESPUÉS de validateAuthCookie y deja pasar solo a un empleado activo que sea
 * administrador (ver lib/permissions.js). Si no, responde 403.
 */
export const requireAdministrator = () => {
  return async (req, res, next) => {
    try {
      if (!(await isAdministratorId(req.user?.id))) return adminOnly(res);
      next();
    } catch (error) {
      console.log("error " + error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};

/**
 * Para las acciones sobre una cuenta de empleado (`/employees/:id`): deja pasar
 * al propio empleado (req.user.id es el del parámetro `param`) o a un
 * administrador. Va DESPUÉS de validateAuthCookie.
 */
export const requireAdminOrSelf = (param = "id") => {
  return async (req, res, next) => {
    try {
      if (String(req.user?.id) === String(req.params[param])) return next();
      if (!(await isAdministratorId(req.user?.id))) return adminOnly(res);
      next();
    } catch (error) {
      console.log("error " + error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};

/**
 * Deja pasar al propio empleado, a un administrador o a quien tenga acceso al
 * módulo `moduleName` del panel (tabla de lib/permissions.js; los
 * administradores tienen todos). Para registrar marcaciones de asistencia.
 */
export const requireSelfOrModule = (moduleName, param = "id") => {
  return async (req, res, next) => {
    try {
      if (String(req.user?.id) === String(req.params[param])) return next();
      const employee = req.user?.id ? await employeeModel.findById(req.user.id).lean() : null;
      if (employee?.isActive && (isAdministrator(employee) || employeeModules(employee).includes(moduleName))) return next();
      res.status(403).json({ message: `Necesitas acceso al módulo ${moduleName} para hacer esto`, code: "MODULE_FORBIDDEN" });
    } catch (error) {
      console.log("error " + error);
      res.status(500).json({ message: "Error interno del servidor." });
    }
  };
};
