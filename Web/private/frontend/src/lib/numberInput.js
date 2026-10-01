// Bloquea las teclas que permiten escribir negativos o notación científica
// en un <input type="number"> (p. ej. Producido, Cantidad): -, +, e, E.
export function blockNegativeKey(e) {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
}
