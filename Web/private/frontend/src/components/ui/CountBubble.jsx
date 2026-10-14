/*
  Burbuja con la cantidad de novedades de un módulo o pestaña (menú lateral y
  Tabs): píldora de 18 px con el número en blanco sobre el color de marca.
  No se muestra si el conteo es 0 y pasa a «99+» desde 100. Al aparecer o
  cambiar de número hace un pequeño «pop» (key = número), salvo con
  «reducir movimiento». `className` es para posicionarla (ml-auto, etc.).
*/
function CountBubble({ count, className = "" }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span
      key={n}
      role="status"
      aria-label={`${n} ${n === 1 ? "novedad" : "novedades"}`}
      className={`count-bubble inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none tabular-nums text-white ${className}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default CountBubble;
