import { useLayoutEffect, useRef, useState } from "react";
import { useFillHeight } from "./useFillHeight";

/*
  Paginación de una lista agrupada por día (libro de movimientos de Finanzas),
  con la misma idea que usePagedRows pero con alturas distintas: cada fila mide
  `rowHeight` y cada vez que cambia el día, dentro de una página, se suma el
  encabezado del día (`headerHeight`). Los grupos se arman DENTRO de cada
  página: un día que no cabe sigue en la página siguiente con su encabezado.

    const paged = usePagedGroups(rows, { rowHeight: 56, headerHeight: 32, groupOf: (r) => r.day, resetKey });
    <section ref={paged.cardRef} style={paged.cardStyle}> … <div ref={paged.areaRef}> {paged.visible} … </div>
      {paged.paged ? <Pagination page={paged.page} … pages={paged.pages} from={paged.from} to={paged.to} /> : null}

  El área de filas se mide como en useFitPageSize: el pie de paginación va
  fuera de ella, así que al aparecer la achica y la lista sigue paginada (no
  oscila). Sin alto fijo (pantallas chicas) se pagina de a `fallbackSize` filas.
*/
export function usePagedGroups(items, { rowHeight, headerHeight, groupOf, resetKey = "", fallbackSize = 10 }) {
  const cardRef = useRef(null);
  const areaRef = useRef(null);
  const fillHeight = useFillHeight(cardRef);
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

  const filled = fillHeight != null;
  const capacity = filled ? areaHeight : Infinity;

  // Reparte las filas en páginas: se llena cada una hasta el alto del área.
  const pages = [];
  let current = null;
  items.forEach((item, index) => {
    const group = groupOf(item);
    const needsHeader = !current || current.lastGroup !== group;
    const cost = rowHeight + (needsHeader ? headerHeight : 0);
    const full = current && (filled ? current.height + cost > capacity && capacity > 0 : current.items.length >= fallbackSize);
    if (!current || full) {
      current = { items: [], height: 0, lastGroup: null, start: index };
      pages.push(current);
      current.height += headerHeight;
    } else if (needsHeader) {
      current.height += headerHeight;
    }
    current.items.push(item);
    current.height += rowHeight;
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
    cardStyle: { height: fillHeight ?? undefined },
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
