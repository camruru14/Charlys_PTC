import { useLayoutEffect, useState } from "react";

/*
  Cuántas filas de alto fijo caben en un contenedor (el área de la lista de
  una tarjeta que se estira con la pantalla). Sirve para paginar solo cuando
  los registros no caben:
    const size = useFitPageSize(listRef, 58);
  `reserved`: alto (px) dentro del contenedor que no es de filas, p. ej. el
  encabezado de columnas de una tabla (32).
    const paged = items.length > size;
  El pie de paginación va FUERA del contenedor medido: al aparecer lo achica,
  el tamaño de página baja y sigue siendo paginado (no oscila). Sin alto fijo
  (pantallas chicas) el contenedor crece con su contenido y nunca pagina.
*/
export function useFitPageSize(ref, rowHeight, reserved = 0) {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height ? Math.max(1, Math.floor((height - reserved) / rowHeight)) : Infinity;
}

export default useFitPageSize;
