import { useLayoutEffect, useRef, useState } from "react";
import { useFillHeight } from "./useFillHeight";

/*
  Paginación de una lista agrupada por día (libro de movimientos de Finanzas),
  con la misma idea que usePagedRows pero con alturas distintas: cada fila mide
  `rowHeight` (más `extraOf(fila)`, p. ej. las subfilas de una venta abierta) y cada vez que cambia el día, dentro de una página, se suma el
  encabezado del día (`headerHeight`). Los grupos se arman DENTRO de cada
  página: un día que no cabe sigue en la página siguiente con su encabezado.

    const paged = usePagedGroups(rows, { rowHeight: 56, headerHeight: 32, groupOf: (r) => r.day, resetKey });
    <section ref={paged.cardRef} style={paged.cardStyle}> … <div ref={paged.areaRef}> {paged.visible} … </div>
      {paged.paged ? <Pagination page={paged.page} … pages={paged.pages} from={paged.from} to={paged.to} /> : null}

  El área de filas se mide como en useFitPageSize: el pie de paginación va
  fuera de ella, así que al aparecer la achica y la lista sigue paginada (no
  oscila). Sin alto fijo (pantallas chicas) se pagina de a `fallbackSize` filas.
  Con `fill` (true/false) el alto del contenedor lo da quien lo usa: el hook no mide
  la tarjeta (cardStyle queda sin alto) y `fill` solo indica si ese alto está activo.
*/
export function usePagedGroups(items, { rowHeight, headerHeight, groupOf, extraOf, fill, resetKey = "", fallbackSize = 10 }) {
  const cardRef = useRef(null);
  const areaRef = useRef(null);
  // Si el contenedor ya trae un alto fijo (Finanzas: la grilla mide una sola vez), no se
  // vuelve a medir aquí: `fill` dice si ese alto está activo.
  const ownHeight = useFillHeight(cardRef, fill === undefined);
  const [areaHeight, setAreaHeight] = useState(0);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const update = () => setAreaHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const filled = fill === undefined ? ownHeight != null : fill;
  const capacity = filled ? areaHeight : Infinity;

  // Reparte las filas en páginas: se llena cada una hasta el alto del área.
  const pages = [];
  let current = null;
  items.forEach((item, index) => {
    const group = groupOf(item);
    const needsHeader = !current || current.lastGroup !== group;
    const cost = rowHeight + (extraOf?.(item) ?? 0) + (needsHeader ? headerHeight : 0);
    const full = current && (filled ? current.height + cost > capacity && capacity > 0 : current.items.length >= fallbackSize);
    if (!current || full) {
      current = { items: [], height: 0, lastGroup: null, start: index };
      pages.push(current);
      current.height += headerHeight;
    } else if (needsHeader) {
      current.height += headerHeight;
    }
    current.items.push(item);
    current.height += rowHeight + (extraOf?.(item) ?? 0);
    current.lastGroup = group;
  });

  const [state, setState] = useState({ key: resetKey, page: 0 });
  const total = items.length;
  const paged = pages.length > 1;
  const page = Math.min(state.key === resetKey ? state.page : 0, Math.max(0, pages.length - 1));
  const visible = pages[page]?.items ?? [];
  const from = visible.length ? pages[page].start + 1 : 0;

  return {
    cardRef,
    areaRef,
    cardStyle: { height: ownHeight ?? undefined },
    visible,
    page,
    setPage: (p) => setState({ key: resetKey, page: p }),
    pages: Math.max(1, pages.length),
    from,
    to: from ? from + visible.length - 1 : 0,
    total,
    paged,
    filled,
  };
}

export default usePagedGroups;
