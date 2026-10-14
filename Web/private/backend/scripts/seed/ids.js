import mongoose from "mongoose";
import { createRng } from "./rng.js";

/*
  ObjectId deterministas: 4 bytes de la fecha (así se ordenan por fecha como los reales), 5 bytes
  fijos derivados de la semilla y un contador de 3 bytes. Misma semilla = mismos _id.
*/
export function createIdFactory(seed) {
  const rnd = createRng((Number(seed) >>> 0) ^ 0x9e3779b9);
  const proc = Array.from({ length: 5 }, () => rnd.int(0, 255).toString(16).padStart(2, "0")).join("");
  let counter = rnd.int(0, 0xffffff);
  return (date) => {
    counter = (counter + 1) & 0xffffff;
    const seconds = Math.max(0, Math.floor(date.getTime() / 1000));
    const hex = seconds.toString(16).padStart(8, "0") + proc + counter.toString(16).padStart(6, "0");
    return new mongoose.Types.ObjectId(hex);
  };
}
