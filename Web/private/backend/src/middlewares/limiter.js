import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1000,
  message: {
    status: 429,
    error: "Too many request",
  },
});

// Login: 10 intentos FALLIDOS cada 15 minutos por IP + correo (los que
// entran bien no cuentan). El correo se normaliza como en el login para que
// mayúsculas o espacios no den intentos extra. Solo se aplica a POST /api/auth/login.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
  message: { message: "Demasiados intentos. Espera unos minutos." },
});

export default limiter;
