import { CATEGORICAL_COLORS, OTHERS_COLOR } from "./chartColors";
import { normalizeName } from "../hooks/useProductNames";

/*
  Color fijo de cada producto en la dona de ventas: la posición del producto en el Catálogo (orden de
  creación, que es el de su _id) decide el color, en el orden #2a78d6, #eb6834, #1baf7a, #eda100,
  #e87ba4 (y vuelve a empezar si hay más de 5). Así el color sigue al producto aunque cambie el rango.
  «Otros» es gris. Un producto que ya no está en el Catálogo toma un color según su nombre.
    const colorOf = productColors(catalogProducts);  // -> (nombre) => color
*/
export const OTHERS_LABEL = "Otros";

const key = (name) => normalizeName(name).toLocaleLowerCase("es");

export function productColors(catalog = []) {
  const byPosition = new Map(
    [...catalog]
      .sort((a, b) => (String(a._id) < String(b._id) ? -1 : 1))
      .map((p, i) => [key(p.name), CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]]),
  );
  return (name) => {
    if (name === OTHERS_LABEL) return OTHERS_COLOR;
    const found = byPosition.get(key(name));
    if (found) return found;
    let hash = 0;
    for (const ch of key(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return CATEGORICAL_COLORS[hash % CATEGORICAL_COLORS.length];
  };
}
