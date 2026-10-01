// DUI salvadoreño, como Web/private/frontend/src/lib/dui.js. El backend lo
// guarda como 9 dígitos; se muestra y se escribe como «12345678-9».

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

// Mismo pattern que el input de la web (\d{8}-\d).
export const isValidDui = (value) => /^\d{8}-\d$/.test(value);
