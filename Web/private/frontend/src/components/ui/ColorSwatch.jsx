import { PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";

/*
  Muestra de color de producto (11px, radio 3px). Usa los colores reales del
  catálogo (PRODUCT_COLOR_HEX), no tokens del tema: representan el color
  físico del producto. Sin color conocido, queda en line-soft.
*/
function ColorSwatch({ color }) {
  const hex = color ? PRODUCT_COLOR_HEX[color] : null;
  return (
    <span
      className={`inline-block h-[11px] w-[11px] shrink-0 rounded-[3px] border border-line ${hex ? "" : "bg-line-soft"}`}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

export default ColorSwatch;
