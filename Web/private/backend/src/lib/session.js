import jsonwebtoken from "jsonwebtoken";
import { config } from "../../config.js";

/*
  Sesión del panel (web y app móvil): un JWT de 30 días con audiencia «panel»
  y la versión de tokens del empleado (`tv`). authMiddleware.js rechaza un token
  sin esa audiencia (por ejemplo, uno emitido por la tienda) y el que lleve una
  `tv` distinta de Employee.tokenVersion: subir esa versión cierra todas las
  sesiones abiertas de ese empleado (cambio de contraseña o de correo,
  desactivación).
*/
export const SESSION_AUDIENCE = "panel";
export const SESSION_DAYS = 30;

export const signSessionToken = (employee) =>
  jsonwebtoken.sign({ id: employee._id, tv: employee.tokenVersion || 0 }, config.JWT.secret, {
    expiresIn: `${SESSION_DAYS}d`,
    audience: SESSION_AUDIENCE,
  });

const baseCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax" };
};

// Guarda el token en la cookie de sesión del panel web.
export const setSessionCookie = (res, token) => res.cookie("authCookie", token, { ...baseCookieOptions(), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });

export const clearSessionCookie = (res) => res.clearCookie("authCookie", baseCookieOptions());
