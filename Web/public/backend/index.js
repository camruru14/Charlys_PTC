import app from "./app.js";
import "./database.js";
import { config } from "./config.js";
import wompiClient from "./src/utils/wompiClient.js";
import { describePaymentsMode, getPaymentsMode } from "./src/utils/payments.js";

async function main() {
  const port = config.server.port;
  app.listen(port);
  console.log("Public e-commerce server on port " + port);
  console.log(describePaymentsMode());
  // En segundo plano: el primer cliente no espera la autenticación con Wompi. En modo demo no se
  // llama a Wompi en ningún paso, tampoco al arrancar.
  if (getPaymentsMode() !== "demo") wompiClient.warmUpAccessToken();
}

main();
