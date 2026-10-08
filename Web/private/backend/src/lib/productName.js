import productModel, { NAME_COLLATION } from "../models/Product.js";
import { HttpError } from "./stock.js";

// Nombre de producto normalizado: recortado y con los espacios sobrantes
// colapsados («  Pajilla   jumbo » -> «Pajilla jumbo»). El Catálogo lo exige
// único sin distinguir mayúsculas (índice único de Product.name).
export const normalizeProductName = (name) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "");

/*
  El «producto» de un pedido, lote, producción diaria o artículo de Producto
  Terminado es el NOMBRE de un producto del Catálogo, guardado como texto. Esta
  validación acepta cualquier producto que exista en el Catálogo, esté activo o
  no (`active` solo controla si se ve en la tienda), y responde 400 con un
  nombre que no exista.

  Un registro que se edita puede conservar el producto que ya tenía aunque el
  producto se haya renombrado o eliminado después (los registros anteriores al
  Catálogo único usan «Pajilla» o «Pelota»):
    current: nombre o lista de nombres que el registro ya tiene guardados.
    required: si es true, un nombre vacío o ausente es un 400 (al crear).
  Un nombre ausente (undefined) en una edición se ignora: el campo no cambia.
  Devuelve el nombre tal como está guardado en el Catálogo.
*/
export async function assertProductName(name, { current = [], required = false } = {}) {
  if (name === undefined && !required) return undefined;
  const wanted = normalizeProductName(name);
  if (!wanted) throw new HttpError(400, "Elige un producto.");

  const keep = (Array.isArray(current) ? current : [current]).filter((n) => typeof n === "string");
  if (keep.includes(name) || keep.includes(wanted)) return wanted;

  const product = await productModel.findOne({ name: wanted }).collation(NAME_COLLATION);
  if (!product) throw new HttpError(400, `El producto «${wanted}» no existe. Agrégalo en el Catálogo.`);
  return product.name;
}
