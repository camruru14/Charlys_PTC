// Bloquea las teclas que permiten escribir negativos o notación científica
// en un <input type="number"> (p. ej. Meta, Producido): -, +, e, E.
export function blockNegativeKey(e) {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
}

// Evita que la rueda del mouse cambie el valor de un <input type="number">
// mientras está enfocado (le quita el foco al hacer scroll sobre el campo).
export function blockWheel(e) {
  e.target.blur();
}
