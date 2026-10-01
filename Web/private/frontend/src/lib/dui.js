// DUI salvadoreño. El backend lo guarda como 9 dígitos (lib/employeeFields.js);
// se muestra y se escribe como «12345678-9».

export function formatDui(dui) {
  const digits = String(dui || "").replace(/\D/g, "");
  if (digits.length !== 9) return dui || "";
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

// Máscara para el campo mientras se escribe: solo números y el guion antes
// del último dígito.
export function maskDui(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 9);
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
}

// Atributos del <input> de DUI (Field): valida «12345678-9» en el navegador.
export const DUI_INPUT_PROPS = {
  inputMode: "numeric",
  pattern: "\\d{8}-\\d",
  maxLength: 10,
  placeholder: "12345678-9",
  title: "El DUI debe tener 9 números (ej. 12345678-9)",
};
