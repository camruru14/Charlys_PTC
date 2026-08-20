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

// Cargar especificación OpenAPI 3.1.0
const openapiDoc = JSON.parse(
  fs.readFileSync(new URL("./src/docs/Charlys_documentacion.json", import.meta.url), "utf-8"),
);

//Ejecutar express
const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: allowedOrigins,
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

// Finanzas (transacciones)
app.use("/api/transactions", validateAuthCookie(), transactionsRoutes);

// Resumen del Dashboard
app.use("/api/dashboard", validateAuthCookie(), dashboardRoutes);

// Documentación de la API 
app.use("/apiDocs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default app;

