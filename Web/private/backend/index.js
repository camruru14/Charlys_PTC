import app from "./app.js";
import "./database.js";
import { config } from "./config.js";

//Creo la función
// que se encarga de ejecutar el servidor
async function main() {
  const port = config.server.port;
  app.listen(port);
  console.log("Server on port " + port);
}

main();
