import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import limiter from "./src/middlewares/limiter.js";

import authRoutes from "./src/routes/auth.js";
import recoveryPasswordRoutes from "./src/routes/recoveryPassword.js";
import productsRoutes from "./src/routes/products.js";
import ordersRoutes from "./src/routes/orders.js";

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:5175",
      "http://localhost:5176",
      // private/frontend (panel administrativo): administra el catálogo
      // público desde ahí con la misma sesión de empleado, ver
      // employeeAuthMiddleware.js.
      "http://localhost:5173",
      "http://localhost:5174",
    ];

// Además de las URLs exactas de arriba, aceptamos cualquier URL que Vercel
// genere para estos 2 proyectos (cada deployment/preview tiene un hash
// distinto en el dominio, ej. charly-public-frontend-bfhllc7ip-ptc4.vercel.app),
// para no tener que actualizar CORS_ORIGINS manualmente en cada deploy nuevo.
const vercelPreviewPattern =
  /^https:\/\/charly-(public|private)-frontend(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Peticiones sin header Origin (ej. Postman, servidor a servidor) -> permitir
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS: " + origin));
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

// Autenticación de clientes de la tienda (registro / login / logout / me)
app.use("/api/auth", authRoutes);

// Recuperación de contraseña por código (3 pasos, cookie temporal aparte de la sesión)
app.use("/api/auth/recovery", recoveryPasswordRoutes);

// Catálogo de productos (público + administración por sesión de empleado)
app.use("/api/products", productsRoutes);

// Pedidos del e-commerce (checkout con cobro directo a Wompi, historial del cliente)
app.use("/api/orders", ordersRoutes);

export default app;
