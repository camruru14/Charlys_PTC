import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "node:fs";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./src/docs/Charlys_documentacion.json" with {type: "json"};
import limiter from "./src/middlewares/limiter.js";
import { validateAuthCookie } from "./src/middlewares/authMiddleware.js";

import authRoutes from "./src/routes/auth.js";
import ordersRoutes from "./src/routes/orders.js";
import productionBatchesRoutes from "./src/routes/productionBatches.js";
import dailyBatchesRoutes from "./src/routes/dailyBatches.js";
import employeesRoutes from "./src/routes/employees.js";
import inventoryRoutes from "./src/routes/inventory.js";
import transactionsRoutes from "./src/routes/transactions.js";
import dashboardRoutes from "./src/routes/dashboard.js";
import warehousesRoutes from "./src/routes/warehouses.js";
import vehiclesRoutes from "./src/routes/vehicles.js";
import routesRoutes from "./src/routes/routes.js";
import settingsRoutes from "./src/routes/settings.js";
import productionLinesRoutes from "./src/routes/productionLines.js";
import productsRoutes from "./src/routes/products.js";
import { PRODUCT_IMAGE_MAX_MB } from "./src/lib/cloudinary.js";

// Cargar especificación OpenAPI 3.1.0
const openapiDoc = JSON.parse(
  fs.readFileSync(new URL("./src/docs/Charlys_documentacion.json", import.meta.url), "utf-8"),
);

//Ejecutar express
const app = express();

// Render pone un proxy delante: confiar en 1 salto para que req.ip,
// el limitador de peticiones y las cookies secure vean la IP y el https reales.
app.set("trust proxy", 1);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

// Además de las URLs exactas de arriba, aceptamos cualquier URL que Vercel
// genere para estos 2 proyectos (cada deployment/preview tiene un hash
// distinto en el dominio, ej. charly-private-frontend-ghi92n8y8-ptc4.vercel.app),
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
    //Permitir el envío de cookies y credenciales
    credentials: true,
  }),
);

app.use(limiter);

app.use(cookieParser());

app.use(express.json());

// Documentación de la API (Swagger UI y especificación JSON)
// Solo se monta fuera del entorno de producción y está protegida exclusivamente para rol admin
if (process.env.NODE_ENV !== "production") {
  app.get("/api-docs.json", validateAuthCookie(["admin"]), (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openapiDoc);
  });

  app.use(
    "/api-docs",
    validateAuthCookie(["admin"]),
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

// Configuración compartida entre usuarios (horario laboral)
app.use("/api/settings", validateAuthCookie(), settingsRoutes);

// Finanzas (transacciones)
app.use("/api/transactions", validateAuthCookie(), transactionsRoutes);

// Resumen del Dashboard
app.use("/api/dashboard", validateAuthCookie(), dashboardRoutes);

// Documentación de la API
app.use("/apiDocs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
  const status = err.status || err.http_code || (isMulter ? 400 : 500);
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? `La imagen no puede pesar más de ${err.field === "images" ? PRODUCT_IMAGE_MAX_MB : 5} MB`
      : (isMulter && MULTER_MESSAGES[err.code]) || err.message || "Error interno del servidor.";
  res.status(status).json({ message });
});

export default app;

