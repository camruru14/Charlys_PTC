import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1000,
  message: {
    status: 429,
    error: "Too many request",
    message: "Demasiadas solicitudes. Espera unos minutos.",
  },
});

const MINUTE = 60 * 1000;

// Correo escrito en el cuerpo, normalizado como lo guardan las cuentas.
const emailOf = (req) => (typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "");

// Límite con un mensaje legible en español (el frontend muestra `message`).
const limit = (windowMinutes, max, message, keyGenerator, extra = {}) =>
  rateLimit({
    windowMs: windowMinutes * MINUTE,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { message },
    ...extra,
  });

// Login: 10 intentos FALLIDOS cada 15 minutos por IP + correo (los que entran bien no cuentan).
export const loginLimiter = limit(
  15,
  10,
  "Demasiados intentos. Espera unos minutos.",
  (req) => `${ipKeyGenerator(req.ip)}|${emailOf(req)}`,
  { skipSuccessfulRequests: true },
);

// Pedir un código de recuperación: 3 cada 15 minutos por correo y 10 por IP.
export const requestCodeEmailLimiter = limit(15, 3, "Ya pediste varios códigos. Espera unos minutos antes de pedir otro.", (req) => `email:${emailOf(req) || ipKeyGenerator(req.ip)}`);
export const requestCodeIpLimiter = limit(15, 10, "Demasiadas solicitudes de código. Espera unos minutos.", (req) => ipKeyGenerator(req.ip));

// Verificar el código: 10 cada 15 minutos por IP.
export const verifyCodeLimiter = limit(15, 10, "Demasiados intentos. Espera unos minutos.", (req) => ipKeyGenerator(req.ip));

// Pagar (crear pedido): 5 cada 10 minutos por cliente y 10 por IP. El del cliente
// va DESPUÉS de requireCustomerAuth (usa req.customer).
export const checkoutCustomerLimiter = limit(10, 5, "Hiciste varios intentos de pago seguidos. Espera unos minutos antes de intentarlo de nuevo.", (req) => `customer:${req.customer?.id || ipKeyGenerator(req.ip)}`);
export const checkoutIpLimiter = limit(10, 10, "Demasiados intentos de pago desde tu conexión. Espera unos minutos.", (req) => ipKeyGenerator(req.ip));

export default limiter;
