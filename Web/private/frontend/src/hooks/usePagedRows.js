import { useLayoutEffect, useRef, useState } from "react";
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
  - shrink (opcional, apagado por defecto): la tarjeta solo llega hasta el
    margen inferior si los registros no caben. El tamaño de página sale del alto
    disponible (useFillHeight) menos lo que hay sobre el área de filas, el
    encabezado de columnas y la barra de paginación; NO del alto actual de la
    tarjeta (que cambia según el modo), así no oscila. Si caben todos, la
    tarjeta no fija alto (mide lo que ocupa su contenido) y no se pagina; si
    no, usa height: fillHeight y se pagina. Las tablas sin esta opción no
    cambian.
*/

// Alto de la barra de paginación (28 del botón + 16 de relleno + 1 de borde)
// más el borde inferior de la tarjeta.
const PAGINATION_HEIGHT = 46;

// Alto de lo que hay sobre el área de filas dentro de la tarjeta (encabezado
// con filtros y borde superior). No depende de si la tarjeta se encoge o se
// estira, así que no genera bucles; se vuelve a medir si el encabezado cambia
// (p. ej. al envolver sus filtros en una ventana angosta).
function useAboveAreaHeight(cardRef, areaRef, enabled) {
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const card = cardRef.current;
    const area = areaRef.current;
    if (!card || !area) return undefined;
    const update = () => setHeight(Math.round(area.getBoundingClientRect().top - card.getBoundingClientRect().top));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(card);
    return () => observer.disconnect();
  }, [cardRef, areaRef, enabled]);
  return height;
}

export function usePagedRows(items, { rowHeight, headerHeight = 0, resetKey = "", fallbackSize = 10, shrink = false }) {
  const cardRef = useRef(null);
  const areaRef = useRef(null);
  const fillHeight = useFillHeight(cardRef);
  const fitted = useFitPageSize(areaRef, rowHeight, headerHeight);
  const above = useAboveAreaHeight(cardRef, areaRef, shrink);
  const filled = fillHeight != null;
  let size = filled ? fitted : fallbackSize;
  if (shrink && filled) {
    size = above == null ? Infinity : Math.max(1, Math.floor((fillHeight - above - PAGINATION_HEIGHT - headerHeight) / rowHeight));
  }
  const [state, setState] = useState({ key: resetKey, page: 0 });

  const total = items.length;
  const paged = Number.isFinite(size) && total > size;
  const pages = paged ? Math.ceil(total / size) : 1;
  const page = Math.min(state.key === resetKey ? state.page : 0, pages - 1);
  const visible = paged ? items.slice(page * size, page * size + size) : items;

  return {
    cardRef,
    areaRef,
    cardStyle: { height: shrink && !paged ? undefined : (fillHeight ?? undefined) },
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
