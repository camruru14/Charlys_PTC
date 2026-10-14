/*
  Punto azul de un registro nuevo o cambiado (novedades): va a la izquierda de la fila,
  alineado con su texto principal. La fila debe ser `relative`; `className` lo
  coloca (p. ej. «left-[7px] top-[17px]»). Siempre está montado y se desvanece
  en 150 ms al marcarse visto.
*/
function UnseenDot({ show, className = "" }) {
  return (
    <span
      role={show ? "img" : undefined}
      aria-label={show ? "Nuevo" : undefined}
      aria-hidden={show ? undefined : true}
      className={`pointer-events-none absolute z-[1] h-2 w-2 rounded-full bg-primary transition-opacity duration-150 motion-reduce:transition-none ${show ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}

export default UnseenDot;
