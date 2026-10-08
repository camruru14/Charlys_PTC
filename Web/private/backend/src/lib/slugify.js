// Genera un slug simple y legible a partir del nombre del producto.
// ej. "Pelota plástica 60 mm" -> "pelota-plastica-60-mm"
export function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
