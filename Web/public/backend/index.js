import app from "./app.js";
import "./database.js";
import { config } from "./config.js";

async function main() {
  const port = config.server.port;
  app.listen(port);
  console.log("Public e-commerce server on port " + port);
}

main();
