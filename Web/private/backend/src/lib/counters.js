import mongoose, { Schema, model } from "mongoose";

/*
  Contadores atómicos de los números correlativos (ORD-2026-0061, TRAN-2026-0007…).
  Antes cada número salía de «el último + 1» con orden de texto: dos compras a la
  vez recibían el mismo número (E11000 después de cobrar) y al llegar a 10000 el
  orden de texto ("ORD-2026-9999" > "ORD-2026-10000") dejaba de funcionar.

  IMPORTANTE: copia intencional en public/backend/src/utils/counters.js. Ambos
  backends escriben en la MISMA colección «counters» y la secuencia TRAN- la
  comparten (gastos del panel y ventas de la tienda). Si se modifica uno, hay que
  actualizar el otro.
*/
const counterSchema = new Schema({ _id: { type: String }, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.models.Counter || model("Counter", counterSchema);

// Año actual en El Salvador (no el UTC del servidor: de noche, en Render, ya sería el año siguiente).
export function currentYearSV(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/El_Salvador", year: "numeric" }).formatToParts(date);
  return parts.find((p) => p.type === "year").value;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// El número más alto que ya existe con ese prefijo («ORD-2026-») en `field` de
// `Model`, comparado como NÚMERO (no por orden de texto). 0 si no hay ninguno.
export async function maxSequence(Model, field, prefix) {
  const [row] = await Model.aggregate([
    { $match: { [field]: { $regex: `^${escapeRegex(prefix)}[0-9]+$` } } },
    { $project: { n: { $toLong: { $substrCP: [`$${field}`, prefix.length, 20] } } } },
    { $group: { _id: null, max: { $max: "$n" } } },
  ]);
  return Number(row?.max) || 0;
}

/*
  nextSequence("ORD-2026", seed) → 61
  `seed()` devuelve el número más alto que ya existe para ese prefijo; solo se
  usa la primera vez, cuando el contador todavía no existe. La siembra usa $max,
  así que es segura aunque dos procesos la hagan a la vez; el incremento es un
  solo $inc atómico.
*/
export async function nextSequence(key, seed) {
  if (typeof seed === "function" && !(await Counter.exists({ _id: key }))) {
    const max = Number(await seed()) || 0;
    await Counter.updateOne({ _id: key }, { $max: { seq: max } }, { upsert: true });
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true });
      return counter.seq;
    } catch (error) {
      // Dos procesos creando el documento a la vez: se reintenta una vez.
      if (error?.code === 11000 && attempt === 0) continue;
      throw error;
    }
  }
}

// «ORD-2026-0061»: relleno de 4 dígitos que solo crece a partir de 10000.
export const formatSequence = (key, seq) => `${key}-${String(seq).padStart(4, "0")}`;

// El siguiente código de `base` («ORD», «TRAN») del año en curso, sembrado con lo
// que ya exista en `field` de `Model`.
export async function nextCode(base, Model, field) {
  const key = `${base}-${currentYearSV()}`;
  const seq = await nextSequence(key, () => maxSequence(Model, field, `${key}-`));
  return formatSequence(key, seq);
}
