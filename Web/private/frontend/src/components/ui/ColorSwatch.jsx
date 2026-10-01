import { PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";

/*
  Muestra de color de producto (11px por defecto, radio 3px). Usa los colores
  reales del catálogo (PRODUCT_COLOR_HEX), no tokens del tema: representan el
  color físico del producto. Sin color conocido, queda en line-soft.
*/
function ColorSwatch({ color, size = 11 }) {
  const hex = color ? PRODUCT_COLOR_HEX[color] : null;
  return (
    <span
      className={`inline-block shrink-0 rounded-[3px] border border-line ${hex ? "" : "bg-line-soft"}`}
      style={{ width: size, height: size, ...(hex ? { backgroundColor: hex } : {}) }}
    />
  );
}

export default ColorSwatch;
