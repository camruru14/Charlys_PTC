import subcategoryModel, { NAME_COLLATION } from "../models/Subcategory.js";
import { HttpError } from "./stock.js";

/*
  El «producto» de un pedido, lote, producción diaria o artículo de Producto
  Terminado es el nombre de una subcategoría (Configuración > Subcategorías),
  guardado como texto. Esta validación acepta cualquier subcategoría que
  exista y esté activa, y responde 400 con un nombre que no exista.

  Un registro que se edita puede conservar el producto que ya tenía aunque la
  subcategoría se haya desactivado, renombrado o eliminado después (los
  registros anteriores a las subcategorías usan «Pajilla» o «Pelota»):
    current: nombre o lista de nombres que el registro ya tiene guardados.
    required: si es true, un nombre vacío o ausente es un 400 (al crear).
  Un nombre ausente (undefined) en una edición se ignora: el campo no cambia.
  Devuelve el nombre tal como está guardado en Configuración.
*/
export async function assertProductName(name, { current = [], required = false } = {}) {
  if (name === undefined && !required) return undefined;
  const wanted = typeof name === "string" ? name.trim() : "";
  if (!wanted) throw new HttpError(400, "Elige un producto.");

  const keep = (Array.isArray(current) ? current : [current]).filter((n) => typeof n === "string");
  if (keep.includes(name) || keep.includes(wanted)) return wanted;

  const sub = await subcategoryModel.findOne({ name: wanted }).collation(NAME_COLLATION);
  if (!sub) {
    throw new HttpError(400, `El producto «${wanted}» no existe. Créalo en Configuración > Subcategorías.`);
  }
  if (!sub.active) throw new HttpError(400, `El producto «${sub.name}» está inactivo.`);
  return sub.name;
}
