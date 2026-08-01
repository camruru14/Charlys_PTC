import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import limiter from "./src/middlewares/limiter.js";
import { validateAuthCookie } from "./src/middlewares/authMiddleware.js";

import authRoutes from "./src/routes/auth.js";
import ordersRoutes from "./src/routes/orders.js";
import productionBatchesRoutes from "./src/routes/productionBatches.js";
import employeesRoutes from "./src/routes/employees.js";
import inventoryRoutes from "./src/routes/inventory.js";
import transactionsRoutes from "./src/routes/transactions.js";
import dashboardRoutes from "./src/routes/dashboard.js";

//Ejecutar express
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    //Permitir el envío de cookies y credenciales
    credentials: true,
  }),
);

app.use(limiter);

app.use(cookieParser());

app.use(express.json());

//Creamos los endPoints
// Autenticación del panel (login / logout de empleados administrativos)
app.use("/api/auth", authRoutes);

// Pedidos provenientes del e-commerce
app.use("/api/orders", validateAuthCookie(["admin", "gerente"]), ordersRoutes);

// Lotes de fabricación
app.use(
  "/api/productionBatches",
  validateAuthCookie(["admin", "gerente", "operario"]),
  productionBatchesRoutes,
);

// Empleados (RRHH)
app.use("/api/employees", validateAuthCookie(["admin", "gerente"]), employeesRoutes);

// Inventario / Almacén
app.use("/api/inventory", validateAuthCookie(["admin", "gerente"]), inventoryRoutes);

// Finanzas (transacciones)
app.use("/api/transactions", validateAuthCookie(["admin", "gerente"]), transactionsRoutes);

// Resumen del Dashboard
app.use("/api/dashboard", validateAuthCookie(["admin", "gerente"]), dashboardRoutes);

export default app;
