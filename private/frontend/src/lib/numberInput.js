// Bloquea las teclas que permiten escribir negativos o notación científica
// en un <input type="number"> (p. ej. Meta, Producido): -, +, e, E.
export function blockNegativeKey(e) {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
}
