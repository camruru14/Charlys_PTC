// Letras (con acentos/ñ), números y espacios: sin símbolos.
const ALLOWED_TEXT = /^[\p{L}\p{N}\s]*$/u;

// Bloquea, al escribir, cualquier tecla que sea un símbolo (deja pasar
// letras, números, espacios y teclas de control como Backspace/flechas).
export function blockSymbolKey(e) {
  if (e.key.length === 1 && !ALLOWED_TEXT.test(e.key)) {
    e.preventDefault();
  }
}

// Quita símbolos de un texto ya escrito o pegado (paste, autocompletar, etc.).
export function stripSymbols(value) {
  return value.replace(/[^\p{L}\p{N}\s]/gu, "");
}
