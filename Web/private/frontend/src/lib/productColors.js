import { CATEGORICAL_COLORS, OTHERS_COLOR } from "./chartColors";

/*
  Color estable de cada producto en la dona del Dashboard: el color sigue al producto aunque cambie
  el rango. Se asigna la primera vez que el producto aparece (el primer color categórico libre entre
  los que se están mostrando) y se recuerda en localStorage. «Otros» siempre es gris.
    const colorOf = productColors(["Pajilla jumbo", "Vaso", "Otros"]);  // -> (nombre) => color
*/
const STORAGE_KEY = "dashboard.productColors";
export const OTHERS_LABEL = "Otros";

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): el color solo se recuerda mientras dure la pestaña.
  }
}

const assigned = readStored();

export function productColors(products) {
  const shown = products.filter((name) => name !== OTHERS_LABEL);
  let changed = false;
  for (const name of shown) {
    if (CATEGORICAL_COLORS.includes(assigned[name])) continue;
    const taken = new Set(shown.map((n) => assigned[n]).filter(Boolean));
    assigned[name] = CATEGORICAL_COLORS.find((c) => !taken.has(c)) || CATEGORICAL_COLORS[Object.keys(assigned).length % CATEGORICAL_COLORS.length];
    changed = true;
  }
  if (changed) writeStored(assigned);
  const snapshot = { ...assigned };
  return (name) => (name === OTHERS_LABEL ? OTHERS_COLOR : snapshot[name] || OTHERS_COLOR);
}
