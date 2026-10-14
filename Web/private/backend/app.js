import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "node:fs";
import swaggerUi from "swagger-ui-express";
import limiter from "./src/middlewares/limiter.js";
import { requireAdministrator, validateAuthCookie } from "./src/middlewares/authMiddleware.js";

import authRoutes from "./src/routes/auth.js";
import ordersRoutes from "./src/routes/orders.js";
import productionBatchesRoutes from "./src/routes/productionBatches.js";
import dailyBatchesRoutes from "./src/routes/dailyBatches.js";
import employeesRoutes from "./src/routes/employees.js";
import inventoryRoutes from "./src/routes/inventory.js";
import transactionsRoutes from "./src/routes/transactions.js";
import expenseCategoriesRoutes from "./src/routes/expenseCategories.js";
import dashboardRoutes from "./src/routes/dashboard.js";
import warehousesRoutes from "./src/routes/warehouses.js";
import vehiclesRoutes from "./src/routes/vehicles.js";
import routesRoutes from "./src/routes/routes.js";
import settingsRoutes from "./src/routes/settings.js";
import productionLinesRoutes from "./src/routes/productionLines.js";
import productsRoutes from "./src/routes/products.js";
import activityRoutes from "./src/routes/activity.js";
import { PRODUCT_IMAGE_MAX_MB, TRANSACTION_FILE_MAX_MB } from "./src/lib/cloudinary.js";

// Cargar especificación OpenAPI 3.1.0
const openapiDoc = JSON.parse(
  fs.readFileSync(new URL("./src/docs/Charlys_documentacion.json", import.meta.url), "utf-8"),
);

//Ejecutar express
const app = express();

// Render pone un proxy delante: confiar en 1 salto para que req.ip,
// el limitador de peticiones y las cookies secure vean la IP y el https reales.
app.set("trust proxy", 1);

// Orígenes que pueden llamar a este backend desde el navegador: las URLs exactas
// de CORS_ORIGINS (o, si no está definida, los localhost de desarrollo) y la URL
// de producción del panel.
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost:5173", "http://localhost:5174"]),
  "https://charly-private-frontend.vercel.app",
];

// Las URLs de preview que Vercel genera para cada deployment del frontend PRIVADO (sufijo -ptc4),
// ej. charly-private-frontend-ghi92n8y8-ptc4.vercel.app, solo se aceptan en desarrollo/staging y
// con ALLOW_VERCEL_PREVIEWS="true". NO en producción: cualquiera puede crear en su propia cuenta de
// Vercel un proyecto con un nombre que coincida con este patrón, y con credentials: true le daría
// acceso a las sesiones del panel. En producción solo cuenta la lista exacta de arriba
// (CORS_ORIGINS + el dominio de producción del panel).
const previewsAllowed = process.env.ALLOW_VERCEL_PREVIEWS === "true" && process.env.NODE_ENV !== "production";
const vercelPreviewPattern = /^https:\/\/charly-private-frontend(-[a-z0-9]+)*-ptc4\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Peticiones sin header Origin (ej. Postman, servidor a servidor) -> permitir
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || (previewsAllowed && vercelPreviewPattern.test(origin))) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS: " + origin));
    },
    //Permitir el envío de cookies y credenciales
    credentials: true,
  }),
);

app.use(limiter);

app.use(cookieParser());

app.use(express.json());

// Documentación de la API (Swagger UI y especificación JSON)
// Solo se monta fuera del entorno de producción y está protegida: solo un administrador
if (process.env.NODE_ENV !== "production") {
  app.get("/api-docs.json", validateAuthCookie(), requireAdministrator(), (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openapiDoc);
  });

  app.use(
    "/api-docs",
    validateAuthCookie(),
    requireAdministrator(),
    swaggerUi.serve,
    swaggerUi.setup(openapiDoc),
  );
}

//Creamos los endPoints
// Autenticación del panel (login / logout de empleados administrativos)
app.use("/api/auth", authRoutes);

// Pedidos provenientes del e-commerce
app.use("/api/orders", validateAuthCookie(), ordersRoutes);

// Lotes de fabricación
app.use("/api/productionBatches", validateAuthCookie(), productionBatchesRoutes);

// Lotes Diarios (programación previa de Lotes de fabricación)
app.use("/api/dailyBatches", validateAuthCookie(), dailyBatchesRoutes);

// Empleados (RRHH)
app.use("/api/employees", validateAuthCookie(), employeesRoutes);

// Inventario / Almacén
app.use("/api/inventory", validateAuthCookie(), inventoryRoutes);

// Bodegas (usadas por Inventario, verificación de pedidos y reportes de Fabricación)
app.use("/api/warehouses", validateAuthCookie(), warehousesRoutes);

// Vehículos (usados por Logística al asignar/editar una entrega)
app.use("/api/vehicles", validateAuthCookie(), vehiclesRoutes);

// Rutas de Logística (motorista + vehículo + pedidos, parada por parada)
app.use("/api/routes", validateAuthCookie(), routesRoutes);

// Líneas de producción (Configuración; opciones al crear/iniciar lotes)
app.use("/api/productionLines", validateAuthCookie(), productionLinesRoutes);

// Catálogo de la tienda pública: administración (crear/editar/eliminar e
// imágenes). Misma colección "products" que lee public/backend.
app.use("/api/products", validateAuthCookie(), productsRoutes);

// Burbujas de novedades por módulo y pestaña (visto por empleado)
app.use("/api/activity", validateAuthCookie(), activityRoutes);

// Configuración compartida entre usuarios (horario laboral)
app.use("/api/settings", validateAuthCookie(), settingsRoutes);

// Finanzas (transacciones)
app.use("/api/transactions", validateAuthCookie(), transactionsRoutes);

// Categorías de gasto de Finanzas (Configuración › Categorías de gasto), con
// su presupuesto mensual opcional
app.use("/api/expense-categories", validateAuthCookie(), expenseCategoriesRoutes);

// Resumen del Dashboard
app.use("/api/dashboard", validateAuthCookie(), dashboardRoutes);

// Manejador de errores global (igual que en public/backend): un error lanzado
// antes del controlador (p. ej. multer rechazando el logo por tamaño o tipo)
// no pasa por su try/catch, y el handler por defecto de Express responde sin
// JSON; el panel espera { message }.
const MULTER_MESSAGES = {
  LIMIT_FILE_COUNT: "Puedes subir hasta 6 imágenes a la vez",
  LIMIT_UNEXPECTED_FILE: "Puedes subir hasta 6 imágenes a la vez",
};

app.use((err, _req, res, _next) => {
  console.log("error " + err);
  const isMulter = err.name === "MulterError";
  // Solo los errores del cliente (4xx, menos 401 y 403: esos los decide el middleware
  // de sesión; MulterError, body-parser, HttpError) conservan su status y mensaje.
  // Cualquier otro error, incluidos los de Cloudinary con http_code 401 o 403,
  // responde 500 genérico: nunca se devuelve err.message crudo en un 500.
  const raw = err.status ?? err.statusCode;
  const isClientError = Number.isInteger(raw) && raw >= 400 && raw < 500 && raw !== 401 && raw !== 403;
  if (!isClientError && !isMulter) {
    return res.status(500).json({ message: "Error interno del servidor." });
  }
  const status = isClientError ? raw : 400;
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? err.field === "file"
        ? `La factura no puede pesar más de ${TRANSACTION_FILE_MAX_MB} MB`
        : `La imagen no puede pesar más de ${err.field === "images" ? PRODUCT_IMAGE_MAX_MB : 5} MB`
      : (isMulter && MULTER_MESSAGES[err.code]) || err.message || "Solicitud inválida.";
  res.status(status).json({ message });
});

export default app;

