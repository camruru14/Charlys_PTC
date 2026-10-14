import mongoose from "mongoose";
import { HttpError } from "./stock.js";

// Un id de la URL que no tiene forma de ObjectId es un error del que llama (400), no un «no existe»
// (404) ni un fallo del servidor (500, que es lo que da el CastError de Mongoose si llega a la consulta).
export function assertId(id, message = "Identificador inválido") {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, message);
  return id;
}
