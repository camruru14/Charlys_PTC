import app from "./app.js";
import "./database.js";
import { config } from "./config.js";
import wompiClient from "./src/utils/wompiClient.js";

async function main() {
  const port = config.server.port;
  app.listen(port);
  console.log("Public e-commerce server on port " + port);
  // En segundo plano: el primer cliente no espera la autenticación con Wompi.
  wompiClient.warmUpAccessToken();
}

main();
