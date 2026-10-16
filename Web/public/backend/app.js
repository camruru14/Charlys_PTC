import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import limiter from "./src/middlewares/limiter.js";

import authRoutes from "./src/routes/auth.js";
import recoveryPasswordRoutes from "./src/routes/recoveryPassword.js";
import productsRoutes from "./src/routes/products.js";
import ordersRoutes from "./src/routes/orders.js";
import { getPaymentsMode } from "./src/utils/payments.js";

const app = express();

// Render pone un proxy delante: confiar en 1 salto para que req.ip,
// el limitador de peticiones y las cookies secure vean la IP y el https reales.
app.set("trust proxy", 1);

// Orígenes que pueden llamar a este backend desde el navegador: las URLs exactas
// de CORS_ORIGINS (o, si no está definida y no es producción, los localhost de desarrollo) y la URL
// de producción de la tienda.
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : process.env.NODE_ENV !== "production"
      ? ["http://localhost:5175", "http://localhost:5176"]
      : []),
  "https://charly-public-frontend.vercel.app",
];

// Las URLs de preview que Vercel genera para cada deployment del frontend de la TIENDA (sufijo
// -ptc4), ej. charly-public-frontend-bfhllc7ip-ptc4.vercel.app, solo se aceptan en
// desarrollo/staging y con ALLOW_VERCEL_PREVIEWS="true". NO en producción: cualquiera puede crear
// en su propia cuenta de Vercel un proyecto con un nombre que coincida con este patrón, y con
// credentials: true le daría acceso a las sesiones de los clientes. En producción solo cuenta la
// lista exacta de arriba (CORS_ORIGINS + el dominio de producción de la tienda).
const previewsAllowed = process.env.ALLOW_VERCEL_PREVIEWS === "true" && process.env.NODE_ENV !== "production";
const vercelPreviewPattern = /^https:\/\/charly-public-frontend(-[a-z0-9]+)*-ptc4\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Peticiones sin header Origin (ej. Postman, servidor a servidor) -> permitir
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || (previewsAllowed && vercelPreviewPattern.test(origin))) {
        return callback(null, true);
      }
      return callback(Object.assign(new Error("Origen no permitido por CORS."), { status: 403, expose: true }));
    },
    credentials: true,
  }),
);

app.use(limiter);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "industrias-charly-public-backend" });
});

// Modo de pago activo (wompi / auto / demo): el checkout lo consulta para avisar al cliente. Sin datos sensibles.
app.get("/api/config/payments", (_req, res) => {
  res.json({ mode: getPaymentsMode() });
});

// Autenticación de clientes de la tienda (registro / login / logout / me)
app.use("/api/auth", authRoutes);

// Recuperación de contraseña por código (3 pasos; el estado vive en la base, ver PasswordReset)
app.use("/api/auth/recovery", recoveryPasswordRoutes);

// Catálogo de productos (público, solo lectura; se administra en private/backend)
app.use("/api/products", productsRoutes);

// Pedidos del e-commerce (checkout con cobro directo a Wompi, historial del cliente)
app.use("/api/orders", ordersRoutes);

// Manejador de errores global: sin esto, un error lanzado por un middleware
// ANTES del controlador (ej. el body JSON mal formado) nunca pasa por el
// try/catch del controlador — Express usa su handler por defecto, que
// responde 500 sin cuerpo. Los clientes esperan JSON con "message", así que
// sin esto el error nunca es legible del lado del cliente.
app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode;
  // Solo los errores del cliente (4xx, o los que se marcan con `expose`: body-parser,
  // validaciones) devuelven su mensaje. Cualquier otro error responde 500 genérico y
  // queda en el log: nunca se devuelve err.message crudo de un fallo interno.
  if (err.expose || (Number.isInteger(status) && status < 500)) {
    return res.status(Number.isInteger(status) && status >= 400 ? status : 400).json({ message: err.message || "Solicitud inválida." });
  }
  console.error("error " + err);
  res.status(500).json({ message: "Error interno del servidor." });
});

export default app;
