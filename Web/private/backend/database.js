import mongoose from "mongoose";
import { config } from "./config.js";
import { ensureRouteIndexes } from "./src/lib/routeIndexes.js";
import { ensureActivityIndexes } from "./src/lib/activityIndexes.js";

mongoose.connect(config.db.URI);

const connection = mongoose.connection;

connection.once("open", () => {
  console.log("DB is connected");
  // Rutas: quita el índice (date, number) obsoleto y asegura el del código único.
  ensureRouteIndexes().catch((error) => console.log("No se pudieron ajustar los índices de rutas: " + error.message));
  // Novedades: quita el índice único (employee, key) obsoleto de ActivitySeen.
  ensureActivityIndexes().catch((error) => console.log("No se pudieron ajustar los índices de novedades: " + error.message));
});

connection.on("disconnected", () => {
  console.log("DB is disconnected");
});

connection.on("error", (error) => {
  console.log("error found" + error);
});
