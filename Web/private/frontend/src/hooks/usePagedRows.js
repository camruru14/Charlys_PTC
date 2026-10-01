import { useRef, useState } from "react";
import { useFillHeight } from "./useFillHeight";
import { useFitPageSize } from "./useFitPageSize";

/*
  Paginación de una tabla o lista a ancho completo (no de un maestro-detalle),
  con la misma técnica que las listas de Configuración (ListCard): en lg la
  tarjeta llega hasta el margen inferior de la página y se muestran las filas
  que caben; el pie (components/ui/Pagination.jsx) aparece solo si no caben
  todas. En pantallas chicas, donde la tarjeta no tiene alto fijo, se pagina de
  a `fallbackSize` filas para que no crezca sin fin.

    const paged = usePagedRows(items, { rowHeight: 44, headerHeight: 32, resetKey: `${q}|${type}` });
    <section ref={paged.cardRef} style={paged.cardStyle} className="flex flex-col …">
      …encabezado de la tarjeta…
      <div ref={paged.areaRef} className="min-h-0 flex-1 overflow-y-auto">
        …encabezado de columnas (headerHeight) y paged.visible.map(fila)…
      </div>
      {paged.paged ? <Pagination page={paged.page} size={paged.size} total={paged.total} onChange={paged.setPage} noun="…" /> : …}
    </section>

  - rowHeight: alto fijo de una fila (borde incluido). headerHeight: lo del área
    que no es de filas (p. ej. el encabezado de columnas de la tabla).
  - resetKey: al cambiar (búsqueda, filtros, mes…) vuelve a la primera página.
    Si se borra el último registro de la última página, pasa a la anterior.
*/
export function usePagedRows(items, { rowHeight, headerHeight = 0, resetKey = "", fallbackSize = 10 }) {
  const cardRef = useRef(null);
  const areaRef = useRef(null);
  const fillHeight = useFillHeight(cardRef);
  const fitted = useFitPageSize(areaRef, rowHeight, headerHeight);
  const filled = fillHeight != null;
  const size = filled ? fitted : fallbackSize;
  const [state, setState] = useState({ key: resetKey, page: 0 });

  const total = items.length;
  const paged = Number.isFinite(size) && total > size;
  const pages = paged ? Math.ceil(total / size) : 1;
  const page = Math.min(state.key === resetKey ? state.page : 0, pages - 1);
  const visible = paged ? items.slice(page * size, page * size + size) : items;

  return {
    cardRef,
    areaRef,
    cardStyle: { height: fillHeight ?? undefined },
    visible,
    page,
    setPage: (p) => setState({ key: resetKey, page: p }),
    size,
    total,
    paged,
    filled,
  };
}

export default usePagedRows;
